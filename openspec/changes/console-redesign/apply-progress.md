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
| C1 CORRECTION neutral accent when no broker connected (decision #167) | [x] |

## Slice 1 correction C1 — neutral disconnected accent (decision #167)

Scoped fix on the same branch `feat/console-redesign-s1-tokens`. Resolves the
spec-vs-design deviation recorded below: the ui-presentation spec ("with no
broker connected, a neutral default accent MUST apply") is authoritative; design
D2/D10 and the original slice-1 implementation wrongly fell back to RabbitMQ
amber `#e0a34a`.

| Step | Change |
|------|--------|
| RED | `broker-accent.service.spec.ts` — initial state asserts `service.broker()` is `null` and `<html>` has **no** `data-broker`; set-then-clear removes the attribute. `styles.tokens.spec.ts` — accent indirection must fall back to `--color-accent-neutral` (a non-broker hex), plus a `[data-broker='rabbitmq']` map assertion. Observed RED: `TS2345` compile failure (`setBroker(null)`) + neutral-token assertions. |
| GREEN | `broker-accent.service.ts` — `_broker` signal is `BrokerKind \| null`, initial `null`; `effect()` does `delete root.dataset['broker']` when `null`, sets it otherwise; `setBroker` accepts `BrokerKind \| null`. `styles.css` — added `--color-accent-neutral: #9a9a9a` in `@theme`, changed `--color-accent` to `var(--broker-accent, var(--color-accent-neutral))`, added an explicit `[data-broker='rabbitmq']` accent map (RabbitMQ can no longer rely on the fallback). |
| REFACTOR | None needed — service stayed minimal, `styles.css` accent block stayed consistent. |
| Docs | `design.md` D2 + D10 amended: documented fallback is the neutral token; `BrokerAccentService.broker` stays `null` until slice 2 wires a real connection. |
| app.ts | No change — it never forced `broker = 'rabbitmq'` on init, it only injects the service. |

### Correction test evidence
`npm test -- --watch false` (from `frontend/`) → **11 files / 189 tests passed**, 0 failed (baseline before C1 was 187; the two reshaped specs net +2). Runtime harness: N/A — no e2e/integration harness in repo; the Vitest run rebuilds the bundle successfully.
Rollback boundary for C1: revert `frontend/src/styles.css`, `frontend/src/styles.tokens.spec.ts`, `frontend/src/app/core/broker-accent.service.ts`, `frontend/src/app/core/broker-accent.service.spec.ts`, and the D2/D10 hunks of `openspec/changes/console-redesign/design.md`.

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

- **Spec vs design on the disconnected-accent default — RESOLVED by correction C1 (decision #167).** ui-presentation "Accent Color Follows the Connected Broker" says *"With no broker connected, a neutral default accent MUST apply."* The original slice-1 implementation followed the (wrong) design D2/D10 amber fallback. Decision #167 ruled the spec authoritative; C1 amends `styles.css`, `broker-accent.service.ts`, both specs, and design D2/D10 to a neutral `--color-accent-neutral` fallback with `broker` starting `null`. No open deviation remains here.
- Radii: all four `--radius-{sm,md,lg,xl}` now alias `var(--radius-base)` (single 12px scale) rather than a stepped scale. Design says only "radii MUST derive from a 12px base token"; a stepped `calc()` scale was avoided because jsdom `getComputedStyle` does not resolve `calc()`/`var()` chains, which would make the token spec untestable.
- Token spec asserts semantic-alias and accent-indirection wiring via raw-CSS regex (not `getComputedStyle`) for the same jsdom limitation; literal palette/radii/font values are still asserted through the real CSSOM cascade.

### Slice 1 files

| File | Action |
|---|---|
| `frontend/src/styles.css` | Rewritten — single Graphite `@theme`, `.dark {}` block deleted, queue hues, 12px radius base, three font stacks. C1 — `--color-accent-neutral: #9a9a9a`, accent falls back to it, explicit `[data-broker='rabbitmq']` + `[data-broker='kafka']` maps |
| `frontend/src/styles.tokens.spec.ts` | Rewritten — single-mode Graphite contract, no `.dark` extraction. C1 — accent indirection expects the neutral token; `[data-broker='rabbitmq']` map asserted |
| `frontend/src/index.html` | Google Fonts `<link>` + preconnect; `class="dark"` kept |
| `frontend/src/app/core/broker-accent.service.ts` | Created; C1 — signal is `BrokerKind \| null` (initial `null`), `effect()` deletes `data-broker` when `null` |
| `frontend/src/app/core/broker-accent.service.spec.ts` | Created; C1 — initial state = no broker / no attribute, set-then-clear removes it |
| `frontend/src/app/app.ts` | Injects `BrokerAccentService` so the accent seam is live document-wide |
| `frontend/src/app/app.html` | Shell + sticky header on surface tokens; panels unchanged |

## Slices 2–5 — NOT STARTED
