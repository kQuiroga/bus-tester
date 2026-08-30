#!/usr/bin/env bash
#
# merge-stack.sh — merge a stack of chained PRs bottom-to-top without GitHub
# auto-closing the ones still pointing at a deleted base branch.
#
# GitHub closes an open PR when its base branch is deleted, and a closed PR
# whose base branch no longer exists cannot be reopened or retargeted. So the
# order matters: retarget every PR in the stack to the final base FIRST, then
# merge bottom-to-top and let each merge delete its own head branch.
#
# Usage:
#   scripts/merge-stack.sh <pr> [<pr> ...]        # bottom of the stack first
#   scripts/merge-stack.sh --base develop 27 28 29
#
# Example (stack: #27 -> #28 -> #29, all landing on main):
#   scripts/merge-stack.sh 27 28 29
#
set -euo pipefail

BASE="main"
if [[ "${1:-}" == "--base" ]]; then
  BASE="${2:?--base needs a value}"
  shift 2
fi

if [[ $# -lt 1 ]]; then
  echo "usage: $0 [--base <branch>] <pr> [<pr> ...]  (bottom of the stack first)" >&2
  exit 2
fi

PRS=("$@")

command -v gh >/dev/null || { echo "gh CLI not found" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated (run: gh auth login)" >&2; exit 1; }

echo "==> Stack: ${PRS[*]}  ->  base: $BASE"

# 1. Retarget every PR onto the final base while they are all still open.
for pr in "${PRS[@]}"; do
  current_base="$(gh pr view "$pr" --json baseRefName --jq .baseRefName)"
  if [[ "$current_base" == "$BASE" ]]; then
    echo "    #$pr already based on $BASE"
  else
    echo "    #$pr: $current_base -> $BASE"
    gh pr edit "$pr" --base "$BASE"
  fi
done

# 2. Merge bottom-to-top. Wait for each PR to report a mergeable state before
#    merging so a still-updating retarget doesn't trip us up.
for pr in "${PRS[@]}"; do
  echo "==> Merging #$pr"
  for _ in $(seq 1 30); do
    read -r mergeable state < <(gh pr view "$pr" --json mergeable,state --jq '"\(.mergeable) \(.state)"')
    [[ "$state" == "MERGED" ]] && break
    [[ "$mergeable" == "MERGEABLE" ]] && break
    if [[ "$mergeable" == "CONFLICTING" ]]; then
      echo "    #$pr has conflicts against $BASE — resolve them and re-run." >&2
      exit 1
    fi
    echo "    waiting for #$pr to become mergeable (state=$state mergeable=$mergeable)..."
    sleep 2
  done

  if [[ "$(gh pr view "$pr" --json state --jq .state)" == "MERGED" ]]; then
    echo "    #$pr already merged, skipping"
    continue
  fi

  gh pr merge "$pr" --merge --delete-branch
done

echo "==> Done. Updating local $BASE"
git checkout "$BASE"
git pull --ff-only origin "$BASE"
git remote prune origin
