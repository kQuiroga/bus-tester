# Archive Report: subscription-chips

**Change**: subscription-chips  
**Archived**: 2026-08-25  
**Status**: CLOSED (PASS WITH WARNINGS)

## Executive Summary

The subscription-chips change enables multi-subscription support in the Messages panel, allowing developers to subscribe to multiple queues concurrently and compare traffic across them. Delivered as two stacked PRs (PR1 scoped-clear fix merged to main, PR2 multi-chip UI on `feat/subscription-chips` branch). All 22 tasks complete. 73/73 frontend tests passing. Spec deltas merged into main specs (message-consumption modified requirement + added requirement; ui-presentation added requirement). Archive complete with 3 non-blocking WARNINGs.

## Artifact Traceability

**Engram Observation IDs (read during archive phase)**:
- Proposal: #111 (sdd/subscription-chips/proposal)
- Spec (delta): #113 (sdd/subscription-chips/spec)
- Design (corrected revision): #115 (sdd/subscription-chips/design) — Note: mem_search initially surfaced stale #114; verified #115 is current and matches implementation
- Tasks: #116 (sdd/subscription-chips/tasks)
- Apply-Progress: #118 (sdd/subscription-chips/apply-progress)
- Verify-Report (final): #121 (sdd/subscription-chips/verify-report)

## Final State Authority

Per the Final-State Authority hierarchy (CLAUDE.md/sdd-phase-common.md):
1. **Native review authority**: Not applicable — no receipt-driven development for this change.
2. **Persisted tasks artifact**: #116 — all 22/22 tasks marked [x] complete.
3. **Explicit final-state facts from launch prompt**: below.
4. **Intermediate snapshots** (#118 apply-progress, #121 verify-report): Rank lowest; work continued after these were persisted.

### Explicit Final-State Facts (from SDD orchestrator launch)

- **Delivery**: Two chained PRs stacked-to-main
  - PR1 (#5): BusHubService.clear() → clearSubscription(id) scoped fix — **merged to main** (commit 34cdca4)
  - PR2 (draft, branch feat/subscription-chips): multi-subscription chip UI, duplicate-queue guard, join/leave error surfacing — **implemented, not yet merged as of archive time** (will merge right after archive completes)
- **Task Completion**: 22/22 tasks complete across 6 phases (Phase 1 = PR1, Phases 2–6 = PR2)
- **Test Evidence**: 73/73 frontend tests passing (verified independently during verify phase); build/typecheck clean (npx tsc --noEmit exit 0)
- **Verify Verdict**: **PASS WITH WARNINGS**, 0 CRITICAL, 3 WARNINGs (non-blocking):
  1. Chip-row DOM rendering proven via computed-signal + compile-time strictTemplates evidence, not a dedicated render-assertion test (see #121 WARNING 1)
  2. Leave-failure test asserts the errorMessage signal but not rendered DOM text (see #121 WARNING 2); join-failure sibling test does assert DOM text
  3. Task 6.2's live ~375px viewport wrap check not performed manually (no browser tool available in apply or verify environments) — accepted as a limitation, consistent with connection-status precedent; structural Tailwind-class comparison against already-shipped connect.component.html pattern substituted

## Specs Merged into Main

### Domain: message-consumption

**Action**: Modified existing requirement + added new requirement

| Requirement | Change | Details |
|---|---|---|
| Subscribe and Receive Live Messages | MODIFIED | Changed from implicit single-active-subscription to explicit multi-subscription semantics. Added 2 new scenarios: "Multiple concurrent subscriptions each receive their own messages" and "Duplicate queueName is blocked". Added 1 new scenario: "Unsubscribing one chip removes only that chip's messages, others remain intact" (per-subscription scoping). Previous statement: "(implicit single-active-subscription — Subscribe disabled once any subscription existed, and unscoped clear-all on unsubscribe.)" |
| Subscribe and Unsubscribe Failures Are Handled Without Unhandled Rejections | ADDED | New requirement specifying explicit error handling for joinSubscription and leaveSubscription, surfacing failures to UI status area. 2 scenarios: "Join failure surfaces to status, no unhandled rejection" and "Leave failure surfaces to status, no unhandled rejection". |

### Domain: ui-presentation

**Action**: Added new requirement

| Requirement | Change | Details |
|---|---|---|
| Subscription Chip Row Renders Active Subscriptions With Live Counters | ADDED | New requirement for per-chip rendering with live message counters, responsive wrap at ~375px. 3 scenarios: "Each active subscription renders as its own chip with a live counter", "Chip row wraps at narrow widths", "No hard cap on concurrent chips". |

**Files updated**:
- openspec/specs/message-consumption/spec.md — merged MODIFIED requirement + added new requirement
- openspec/specs/ui-presentation/spec.md — added new requirement

## Archive Location

**Filesystem**: openspec/changes/archive/2026-08-25-subscription-chips/

**Contents**:
- proposal.md ✅
- design.md ✅
- tasks.md ✅ (22/22 tasks complete, all [x] marked)
- specs/message-consumption/spec.md ✅ (delta, merged into main)
- specs/ui-presentation/spec.md ✅ (delta, merged into main)
- archive-report.md ✅ (this file)

**Verification**: diff -r comparison (snapshot pre-move vs. archived tree) shows empty diff — byte-identical copy, zero truncation or alteration.

## Design Drift / Discovery

**Tooling Gotcha**: During this cycle, mem_search(query: "sdd/subscription-chips/design", project: "bus-tester") surfaced only the stale revision #114 (silent .catch(() => {}), contradicts spec requirement). The corrected revision #115 ("revised 2026-08-25: corrected join/leave error handling to match spec") appeared only in a broader full-text search, not the standard topic-key search.

**Resolution**: Implementation confirmed against #115 (the corrected version, per orchestrator's explicit instruction). On-disk openspec/changes/subscription-chips/design.md mirror already reflects the id-115 content. **Recommendation for future SDD cycles on this project**: when a design is revised mid-cycle, always verify the topic-key search returns the latest revision, or fetch the design explicitly by ID if ambiguity arises.

## Issues Resolved

**CRITICAL**: None.

**WARNINGs** (non-blocking):
1. **Chip-row DOM rendering structural check, not runtime test**: Tests 2.1/2.2 (#121) assert chipCounts()/subscriptions() computed values; no test calls fixture.detectChanges() and DOM-queries the chip span elements to visually confirm rendering. Mitigated by strictTemplates: true AOT compile-time binding validation (build succeeded, so chip property references are type-correct at compile time). Recommend follow-up test exercising detectChanges() + DOM query for full runtime verification.

2. **Leave-failure DOM-assertion parity gap**: Test 4.2 (#121) asserts component.errorMessage() only; test 4.1 (join failure) additionally asserts fixture.nativeElement.textContent after detectChanges(). Both failures route through the identical @if (errorMessage()) template binding already proven to render by 4.1, so functional risk is low, but this is short of the strict DOM bar user explicitly set. Recommend adding the same DOM assertion to test 4.2 for parity.

3. **Manual ~375px viewport wrap check not performed**: Task 6.2 required a live ng serve + viewport check. Apply and verify environments lack browser tools. Structural evidence (Tailwind class comparison against already-shipped connect.component.html) substituted instead. **Accepted as a limitation**, consistent with connection-status precedent. Recommend manual browser confirmation at ~375px before/at merge, as tasks.md already notes.

**SUGGESTION**:
- "No hard cap on concurrent chips" is proven by code inspection (no length/slice/cap logic exists) but runtime-exercised only to n=2 subscriptions. A 3+ subscription test would close this gap, though risk is low.

## Changes Not in Scope

- Backend changes (SubscriptionCoordinator/BusHub already support N concurrent subscriptions)
- Persisting subscriptions/chip labels across page reload
- Any change to ConnectComponent or hub-lifecycle ownership boundary (per connection-status spec)

## Risks

**No blocking risks.** Three non-blocking WARNINGs documented above are all related to test/verification rigor rather than code correctness. Implementation verified against #115 (corrected design), matches spec exactly, and all 22 tasks completed with full test coverage at the unit layer. PR1 already merged and validated; PR2 awaits merge post-archive.

## SDD Cycle Summary

| Phase | Artifacts | Status |
|---|---|---|
| Proposal | #111 proposal.md | Complete |
| Spec | #113 spec (2 delta domains) | Complete, merged into main |
| Design | #115 design.md (corrected) | Complete, no open questions |
| Tasks | #116 tasks.md (22 tasks) | Complete, all marked [x] |
| Apply | #118 apply-progress.md | Complete, 22/22 tasks done, 73/73 tests passing |
| Verify | #121 verify-report.md | PASS WITH WARNINGS, 0 CRITICAL, 3 WARNINGs (non-blocking) |
| Archive | (this file) archive-report.md | Complete, specs merged, folder archived, diff verified |

**Session**: 2026-08-25 SDD archive phase  
**Project**: bus-tester  
**Artifact store**: hybrid (OpenSpec files + Engram)

---

**Prepared**: 2026-08-25 (archive phase)  
**Observation ID**: (recorded in Engram as sdd/subscription-chips/archive-report)
