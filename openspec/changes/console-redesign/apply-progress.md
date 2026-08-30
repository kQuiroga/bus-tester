# Apply Progress: console-redesign

**Mode**: Strict TDD (Vitest, `npm test -- --watch false` from `frontend/`)
**Delivery**: feature-branch-chain, PR1 of 5 → tracker `feat/console-redesign`
**Branch**: `feat/console-redesign-s1-tokens`

## Slice 1 — Graphite tokens + shell + accent seam (COMPLETE)

| Task | Status |
|------|--------|
| 1.1 RED rewrite `styles.tokens.spec.ts` | [x] |
| 1.2 RED add `broker-accent.service.spec.ts` | [x] |
| 1.3 GREEN collapse `styles.css` to one Graphite `@theme` | [x] |
| 1.4 GREEN `index.html` Google Fonts `<link>` + fallbacks | [x] |
| 1.5 GREEN create `broker-accent.service.ts` | [x] |
| 1.6 GREEN `app.{ts,html}` shell/header on surface tokens | [x] |
| 1.7 REFACTOR dedupe tokens, no hardcoded radii/colors | [x] |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/styles.tokens.spec.ts` | Unit (jsdom CSSOM) | N/A (rewrite; approval-style pins kept for palette) | ✅ 33 failing on new Graphite contract | ✅ full file green after 1.3 | ✅ palette + semantic-alias + radii + accent + dark-only + queue groups | ➖ helpers reused, already clean |
| 1.2 | `src/app/core/broker-accent.service.spec.ts` | Unit | N/A (new) | ✅ compile failure — `./broker-accent.service` missing | ✅ 6/6 after 1.5 | ✅ default + rabbitmq attr + kafka attr + switch-back + singleton | ➖ none needed |

Note on RED for 1.1: the missing service (1.2) broke the bundle first, so 1.1's assertion-level RED (33 failed) was observed on the run immediately after `broker-accent.service.ts` was created and before `styles.css` was rewritten.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command + result | `npm test -- --watch false` (from `frontend/`) → **11 files / 187 tests passed**, 0 failed |
| Runtime harness | N/A — repo has no e2e/integration harness; Vitest is the only runner (confirmed in tasks + design). `npm run build` succeeds (pre-existing 500kB bundle-budget warning, unrelated). |
| Rollback boundary | Revert `frontend/src/styles.css`, `frontend/src/styles.tokens.spec.ts`, `frontend/src/index.html`, `frontend/src/app/app.ts`, `frontend/src/app/app.html`, and delete `frontend/src/app/core/broker-accent.service.ts` + spec. No other slice touches these files. |

### Deviations

- **Spec vs design on the disconnected-accent default.** ui-presentation "Accent Color Follows the Connected Broker" says *"With no broker connected, a neutral default accent MUST apply."* Design D2/D10 and tasks 1.1/1.2 instead specify the indirection falls back to RabbitMQ amber `#e0a34a` and `BrokerAccentService.broker` stays `'rabbitmq'`. Followed design/tasks (amber fallback). If verify treats the spec literally, a neutral fallback token would be the fix; deferred as a design-owned decision.
- Radii: all four `--radius-{sm,md,lg,xl}` now alias `var(--radius-base)` (single 12px scale) rather than a stepped scale. Design says only "radii MUST derive from a 12px base token"; a stepped `calc()` scale was avoided because jsdom `getComputedStyle` does not resolve `calc()`/`var()` chains, which would make the token spec untestable.
- Token spec asserts semantic-alias and accent-indirection wiring via raw-CSS regex (not `getComputedStyle`) for the same jsdom limitation; literal palette/radii/font values are still asserted through the real CSSOM cascade.

### Slice 1 files

| File | Action |
|---|---|
| `frontend/src/styles.css` | Rewritten — single Graphite `@theme`, `.dark {}` block deleted, `[data-broker='kafka']` accent map, queue hues, 12px radius base, three font stacks |
| `frontend/src/styles.tokens.spec.ts` | Rewritten — single-mode Graphite contract, no `.dark` extraction |
| `frontend/src/index.html` | Google Fonts `<link>` + preconnect; `class="dark"` kept |
| `frontend/src/app/core/broker-accent.service.ts` | Created — `BrokerKind` signal → `<html data-broker>` via `DOCUMENT` + `effect()`, root-provided |
| `frontend/src/app/core/broker-accent.service.spec.ts` | Created |
| `frontend/src/app/app.ts` | Injects `BrokerAccentService` so the accent seam is live document-wide |
| `frontend/src/app/app.html` | Shell + sticky header on surface tokens; panels unchanged |

## Slices 2–5 — NOT STARTED
