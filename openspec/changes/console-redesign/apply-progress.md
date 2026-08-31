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

## Slice 2 — Connect popup + status pill + reserved slot (COMPLETE)

**Branch**: `feat/console-redesign-s2-connect` (child of `feat/console-redesign-s1-tokens`)
**Delivery**: feature-branch-chain, PR2 of 5 → targets `feat/console-redesign-s1-tokens`
**Commits**: `9e3d001` vendor dialog lib, `07f3401` connect popup + pill + slot

| Task | Status |
|------|--------|
| 2.1 RED connect / connect-dialog / status-pill specs | [x] |
| 2.2 GREEN vendor `libs/ui/dialog` + `tsconfig.json` path | [x] |
| 2.3 GREEN container + `connect-dialog` / `status-pill` split, `connectDialogOpen` signal | [x] |
| 2.4 GREEN inert `broker-selector-slot` beside the pill | [x] |
| 2.5 REFACTOR delete the old permanent connect column (moved pill to header) | [x] |

### How the dialog lib was vendored

`@spartan-ng/cli` 1.3.3 is installed but its `ui` generator requires `@nx/devkit`
and an nx workspace; this `frontend/` is a plain Angular CLI project, so
`nx g @spartan-ng/cli:ui dialog` / `ng g @spartan-ng/cli:ui dialog` cannot run.
Vendored **by hand** from the CLI's own generator templates at
`node_modules/@spartan-ng/cli/src/generators/ui/libs/dialog/files/**/*.template`:

- Copied all 11 files into `frontend/libs/ui/dialog/src/` (`index.ts` + 10 `lib/*.ts`),
  matching the existing `libs/ui/{button,card,…}` structure (tabs, `src/index.ts`,
  `src/lib/`, `HlmDialogImports` barrel).
- Replaced the `<%- importAlias %>` placeholder with `@spartan-ng/helm`.
- Replaced the template's `spartan-dialog-*` utility classes (which need a
  `@spartan-ng/cli` `style-*.css` preset this project does not import) with the
  equivalent expanded Tailwind utilities taken from the CLI's `style-vega.css`
  (minus the `tw-animate-css` `animate-in`/`zoom`/`fade` classes, which are not
  imported here). Same approach the vendored `button`/`card` libs already use.
- brain `@spartan-ng/brain/dialog` 1.3.3 API matches the templates exactly
  (`BrnDialog`, `BrnDialogContent`, `injectBrnDialogContext`,
  `provideBrnDialogDefaultOptions`, `cssClassesToArray` re-exported from
  `/dialog`, `injectCustomClassSettable` from `/core`).
- Added `"@spartan-ng/helm/dialog": ["./libs/ui/dialog/src/index.ts"]` to
  `frontend/tsconfig.json` `paths`.

Commands actually run:
- `gentle-ai sdd-attempt acquire --change console-redesign --token … --request-id … --work-unit slice-2-connect-popup-status-pill --evidence-goal …` → `state: proceed`
- `npm test -- --watch false` (from `frontend/`) — repeatedly, RED then GREEN
- `npm run build` (from `frontend/`)
- No `ng g` / `nx g` invocation (would fail; see above).

### Component architecture (design D3 / D10)

| File | Action | What |
|---|---|---|
| `frontend/libs/ui/dialog/src/**` (12 files) | Create | Vendored spartan dialog helm lib |
| `frontend/tsconfig.json` | Modify | `@spartan-ng/helm/dialog` path |
| `frontend/src/app/features/connect/connect.component.{ts,html}` | Modify | Now a container: `connectDialogOpen` signal (starts open — no connection on load), `<hlm-dialog [state]>` + `*hlmDialogPortal` host, header pill + inert slot. `connect()` success → `BrokerAccentService.setBroker('rabbitmq')` + close popup; `disconnect()` → `setBroker(null)`; `changeBroker()` → `disconnect()` and keep popup open (D10). Still never starts the hub. |
| `frontend/src/app/features/connect/connect.component.spec.ts` | Rewrite | Container contract: auto-open, close-on-connect + rabbitmq accent, reopen via pill, connected body has no inputs, `changeBroker` DELETE + popup stays open + neutral accent, inert slot fires no HTTP, never starts hub. |
| `frontend/src/app/features/connect/status-pill.component.{ts,html}` (+ spec) | Create | Presentational always-visible pill; `activate` output; broker vs hub state kept visually distinct; hub `reconnecting` inline via `[data-testid="hub-state-inline"]`; warn/ok/error/neutral token classes. |
| `frontend/src/app/features/connect/connect-dialog.component.{ts,html}` (+ spec) | Create | Presentational body; switches on `connected()` — 4-field credentials form + `Conectar` while disconnected, `Desconectar` / `Cambiar broker` (no inputs) while connected; `model()` two-way for host/port/username/password; `connectSubmit` / `disconnect` / `changeBroker` outputs. |
| `frontend/src/app/app.html` | Modify | Connect column removed from the `<main>` grid (3-col → 2-col), `<app-connect />` moved into the `<header>`. |

### Stable DOM contracts asserted (not class strings)

`[data-testid="broker-status-pill"]` (always a `<button>`), `[data-testid="hub-state-inline"]`,
`[data-testid="broker-selector-slot"]` (`aria-hidden="true"`, `tabindex="-1"`, `inert`),
`[data-testid="connect-dialog-status"]`, `[data-testid="connect-dialog-error"]`,
`input[data-slot="input"]` counts (4 disconnected / 0 connected), button text
`Conectar` / `Desconectar` / `Cambiar broker`, `app-connect-dialog` presence in the
CDK overlay while `connectDialogOpen()`.

### TDD Cycle Evidence

| Task | Test File(s) | Layer | RED | GREEN | REFACTOR |
|------|--------------|-------|-----|-------|----------|
| 2.1 | `connect.component.spec.ts` (rewrite), `status-pill.component.spec.ts` (new), `connect-dialog.component.spec.ts` (new) | Unit (TestBed + jsdom; CDK overlay verified working in a throwaway spike) | ✅ compile failure — `./status-pill.component` / `./connect-dialog.component` missing, `connectDialogOpen` / `openConnectDialog` / `changeBroker` absent on `ConnectComponent` | ✅ 23 slice-2 tests green after 2.2–2.4 | ➖ helpers already minimal |
| 2.2 | (compile gate) | — | ✅ `Cannot find package '@spartan-ng/helm/dialog'` | ✅ path added, lib resolves | ➖ |
| 2.3 | container + child specs | Unit | ✅ (same as 2.1) | ✅ signal transitions + child inputs pass | ➖ |
| 2.4 | `connect.component.spec.ts` slot test | Unit | ✅ `[data-testid=broker-selector-slot]` null | ✅ present, aria-hidden, tabindex -1, no HTTP on click | ➖ |
| 2.5 | full suite + `app.spec.ts` | Unit | n/a (refactor) | ✅ 13 files / 193 tests green after moving the pill to the header | ✅ grid 3-col → 2-col, no dead connect-column markup |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command + result | `npm test -- --watch false` (from `frontend/`) → **13 files / 193 tests passed**, 0 failed (was 11 files / 189; net +4: `status-pill` +7, `connect-dialog` +7, `connect` container −10 obsolete permanent-column tests) |
| Runtime harness | N/A — repo has no e2e/integration harness; Vitest is the only runner. `npm run build` succeeds; initial bundle budget warning grew from ~500 kB to 628 kB (+128 kB) because the vendored dialog pulls in `@angular/cdk/overlay` — expected cost of design D3, not a regression in app code. |
| Rollback boundary | Revert commits `07f3401` + `9e3d001`. Files: delete `frontend/libs/ui/dialog/`, drop the `@spartan-ng/helm/dialog` line from `frontend/tsconfig.json`, restore `frontend/src/app/features/connect/*` and the `<app-connect />` grid cell in `frontend/src/app/app.html`. No other slice touches these. |

### Changed-line count (this slice, committed)

| Bucket | Added | Deleted | Total |
|---|---|---|---|
| Vendored (`frontend/libs/ui/dialog/**`) | 272 | 0 | 272 |
| Authored (connect feature + app.html + tsconfig) | 405 | 409 | 814 |
| **Slice total** | **677** | **409** | **1086** |

Authored deletions are almost entirely the obsolete `connect.component.spec.ts`
(−268) that characterised the removed permanent-column connect flow, plus the
`connect.component.{ts,html}` rewrite. Net new authored lines ≈ 268. The vendored
CLI output alone (272) did **not** push the authored diff toward the 800 budget
(decision #150); the authored figure is inflated by the mandated spec rewrite
(task 2.1 RED) and the mandated column deletion (task 2.5). Flagged for the
PR-time `ask-on-risk` review-workload decision.

### Deviations from design

- **Dialog vendoring method**: design D3 says "the CLI vendors `libs/ui/{dialog,sheet}`". The CLI cannot run here (nx-only). Hand-vendored from the CLI's own templates with the documented class substitution. Output is structurally identical to a CLI run against a spartan-configured workspace. No behavioural deviation.
- **Dialog header/title inside the presentational child**: used plain `<h2>` / `<p>` instead of `hlmDialogTitle` / `hlmDialogDescription`, because those directives inject `BrnDialogRef` and throw when the child is rendered in isolation (its own spec). The dialog chrome (overlay, focus trap, close button) still comes from the vendored `HlmDialog` / `HlmDialogContent` in the container.
- **`changeBroker()`**: implemented as `disconnect()` + keep popup open (body then shows the credentials form because `connected()` is false). Does not auto-fire `connect()` — the tester edits the fields and submits. Matches task 2.3 intent ("reopens credentials form, runs existing `disconnect()` → `connect()`") and D10 without modifying `connect()`.

### Issues found

- None blocking. Bundle-size budget warning noted above.

## Slice 3 — Send panel recent sends: cap 5, Vaciar, first-load migration (COMPLETE)

**Branch**: `feat/console-redesign-s3-send` (child of `feat/console-redesign-s2-connect`)
**Delivery**: feature-branch-chain, PR3 of 5 → targets `feat/console-redesign-s2-connect`
**Commit**: `feat(send): cap recent sends at 5 with Vaciar control and first-load migration`

| Task | Status |
|------|--------|
| 3.1 RED `send-history.service.spec.ts` — cap 5 FIFO, `clearRecentSends()` memory + `removeItem`, first-load truncate+rewrite | [x] |
| 3.2 RED `send.component.spec.ts` — `Vaciar` → `clearRecentSends()`, recall populates exchange/routingKey/payload | [x] |
| 3.3 GREEN `send-history.service.ts` — `RECENT_SENDS_CAP = 5`, `loadCappedRecentSends()` migration, `clearRecentSends()` | [x] |
| 3.4 GREEN `send.component.{ts,html}` — recent-sends layout rework + `Vaciar` control wired to the service | [x] |
| 3.5 REFACTOR component delegates to the service only, no storage access in the component | [x] |

### What changed (design D6, decisions #152.2 / #152.3)

| File | Action | What |
|---|---|---|
| `frontend/src/app/features/send/send-history.service.ts` | Modify | `RECENT_SENDS_CAP` 20 → 5. New module fn `loadCappedRecentSends()` — reads the persisted list; when `length > 5` truncates to the first 5 (newest-first) AND rewrites `send-panel.recent-sends`, otherwise returns it untouched. `_recentSends` signal now initializes from it. New `clearRecentSends()` — `_recentSends.set([])` + `localStorage.removeItem('send-panel.recent-sends')`. `recordSend` already `.slice(0, CAP)`, so cap-5 FIFO is automatic. Templates untouched. |
| `frontend/src/app/features/send/send-history.service.spec.ts` | Modify | "caps at 20" test rewritten to cap 5 (6 records → 5, `orders.5`..`orders.1`). Added: `clearRecentSends` empties memory + removes key; stays empty after reload; oversized (8-entry) persisted list truncated to 5 most recent + key rewritten on first inject; ≤5 list left untouched. |
| `frontend/src/app/features/send/send.component.ts` | Modify | Added thin `clearRecent()` delegating to `history.clearRecentSends()` (mirrors existing `deleteTemplate`). No storage access in the component (3.5). Reply-mode / dirty-guard code (D7) left untouched — that is slice 5. |
| `frontend/src/app/features/send/send.component.html` | Modify | Recent-sends block reworked: header row with `Envíos recientes` + live `N/5` count + a `[data-testid="recent-sends-clear"]` ghost `Vaciar` button (`lucideTrash2`) shown only while entries exist; rows are two-line (`exchange` over `routingKey`, `(intercambio predeterminado)` placeholder for empty exchange) `[data-testid="recent-send-row"]` cards on `bg-background/60` + `rounded-lg`; `track recent.sentAt` → `track $index`. Load button (`lucideDownload` + "Cargar") unchanged. Container gets `[data-testid="recent-sends"]`. |
| `frontend/src/app/features/send/send.component.spec.ts` | Modify | Added: `clearRecent()` delegates to the service; `Vaciar` control hidden with no entries, shown with entries, click calls `clearRecentSends()`. Updated the row-actions button count 5 → 6 (Vaciar added; row-action filter by "Cargar"/"Eliminar" text still 3). |

### Stable DOM contracts asserted (not class strings)

`[data-testid="recent-sends"]`, `[data-testid="recent-sends-clear"]` (button, text `Vaciar`, only while `recentSends().length > 0`), `[data-testid="recent-send-row"]`, `button` text `Cargar` + `ng-icon[name="lucideDownload"]`.

### TDD Cycle Evidence

| Task | Test File(s) | Layer | RED | GREEN | REFACTOR |
|------|--------------|-------|-----|-------|----------|
| 3.1 | `send-history.service.spec.ts` | Unit (TestBed, jsdom localStorage) | ✅ compile failure — `Property 'clearRecentSends' does not exist on type 'SendHistoryService'` | ✅ 4 new + 1 rewritten service test green after 3.3 | ➖ module fn mirrors existing `readArray` helper |
| 3.2 | `send.component.spec.ts` | Unit (TestBed + jsdom DOM) | ✅ same compile gate (`clearRecent` / `clearRecentSends` absent) | ✅ `clearRecent()` delegate + `Vaciar` show/hide/click tests green after 3.4 | ➖ |
| 3.3 | `send-history.service.ts` | — | (driven by 3.1) | ✅ cap 5, `loadCappedRecentSends()`, `clearRecentSends()` | ➖ |
| 3.4 | `send.component.{ts,html}` | — | (driven by 3.2) | ✅ layout rework + `Vaciar` wired | ➖ |
| 3.5 | full suite | Unit | n/a (refactor) | ✅ 13 files / 199 tests green; `rg localStorage src/app/features/send/send.component.*` → no matches (component holds zero storage access) | ✅ nothing to extract — component already delegates |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command + result | `npm test -- --watch false` (from `frontend/`) → **13 files / 199 tests passed**, 0 failed (baseline 13 / 193; net +6: service +4, component +2) |
| Runtime harness | N/A — repo has no e2e/integration harness; Vitest is the only runner (confirmed in tasks + design). `npm run build` (from `frontend/`) succeeds; initial bundle 630.24 kB (was ~628 kB after slice 2; +~2 kB from the reworked template). The 500 kB budget warning is pre-existing from slice 2's vendored `@angular/cdk/overlay` (design D3), not a slice-3 regression. |
| Rollback boundary | Revert the single slice-3 commit. Files: `frontend/src/app/features/send/send-history.service.{ts,spec.ts}` and `frontend/src/app/features/send/send.component.{ts,html,spec.ts}` — no other slice touches the recent-sends block or `SendHistoryService`. Slice 5 also edits `send.component.{ts,html}` but only the reply-mode / dirty-guard regions, which slice 3 did not touch. |

### Changed-line count (this slice)

| Bucket | Added | Deleted | Total |
|---|---|---|---|
| Authored (`frontend/src/app/features/send/**`) | 173 | 15 | 188 |
| SDD docs (`tasks.md` checkbox flips) | 5 | 5 | 10 |
| **Slice total** | **178** | **20** | **198** |

No vendored output this slice. Well under the 800-line review budget (decision #150) and even the 400 default.

### Deviations from design

- None. `loadCapped()` is realized as a module-level function `loadCappedRecentSends()` (same pattern as the existing `readArray` helper) rather than a service method — behavior is identical and it runs at construction time via the `_recentSends` signal initializer, matching D6 ("construction-time `loadCapped()`") and the spec scenario ("WHEN the send panel initializes for the first time after the upgrade").
- D7 reply-mode / unsaved-edits guard code in `send.component.ts` was left fully intact — that removal is slice 5 (task 5.8), out of scope here.

### Issues found

- None.

## Slice 4 — Messages feed cards + queue pill/dot (COMPLETE)

**Branch**: `feat/console-redesign-s4-messages` (child of `feat/console-redesign-s3-send`)
**Delivery**: feature-branch-chain, PR4 of 5 → targets `feat/console-redesign-s3-send`
**Commit**: `f4bc7d7` feat(messages): identify queues with a deterministic tinted pill and dot

| Task | Status |
|------|--------|
| 4.1 RED `queue-color.spec.ts` — `queueColorIndex` 1..6, deterministic, stable across resubscribe, int32 for long names | [x] |
| 4.2 RED `messages.component.spec.ts` — feed row + chip render `[data-queue-color]` pill + 6px dot; same queue matches; different queues differ; no left rail | [x] |
| 4.3 GREEN create `queue-color.ts` — pure FNV-1a (`Math.imul`) `% 6 + 1`, `QueueColor` type | [x] |
| 4.4 GREEN `messages.component.{ts,html}` + `styles.css` — card restyle, queue pill + dot via `[data-queue-color='N']` → `--queue-hue` | [x] |
| 4.5 REFACTOR no dynamic Tailwind hue class strings; DRY tint literals to component fields; suite green | [x] |

### What changed (design D5)

| File | Action | What |
|---|---|---|
| `frontend/src/app/features/messages/queue-color.ts` | Create | `queueColorIndex(queueName): QueueColor` — FNV-1a 32-bit over UTF-16 code units (`h = 0x811c9dc5`; per char `h ^= c; h = Math.imul(h, 0x01000193)`), `((h >>> 0) % 6) + 1`. Named constants `FNV_OFFSET_BASIS` / `FNV_PRIME` / `PALETTE_SLOTS`. Exported `QueueColor = 1|2|3|4|5|6`. Pure, zero deps. |
| `frontend/src/app/features/messages/queue-color.spec.ts` | Create | 6 tests: range 1..6 (incl. `''` + a 53-char name), determinism (50 calls), resubscribe stability, 6 reference FNV-1a values (`orders`→3, `payments`→1, `shipping-queue`→4, `orders-queue`→5, `orders.created`→5, `orders.updated`→6), spread across all 6 slots for a realistic set, `Math.imul` int32 for 5000- and 2006-char names. |
| `frontend/src/app/features/messages/messages.component.ts` | Modify | New `queueNameById` computed (`subscriptionId` → queue name map from `subscriptions()`); `queueNameOf(message)` resolves a row's queue; `queueColor(name)` delegates to `queueColorIndex`. Static `queuePillTint` (`color-mix(in oklab, var(--queue-hue) 18%, transparent)`) + `queueDotFill` (`var(--queue-hue)`) fields — hue arrives via the data attribute, not a class. |
| `frontend/src/app/features/messages/messages.component.html` | Modify | Feed rows: `[data-testid="message-row"]`, `rounded-lg` surface card, header line holding a `[data-testid="queue-pill"]` (`[attr.data-queue-color]`, `[style.background-color]="queuePillTint"`) with a `[data-testid="queue-dot"]` `size-1.5` (6px) solid dot, then routing key + dimmed `(exchange)`, then Responder. Payload `<pre>` below. Subscription chips: same queue-pill + dot injected into the `hlmBadge`. No left colour rail added (design rejected it). |
| `frontend/src/styles.css` | Modify | Added 6 rules `[data-queue-color='N'] { --queue-hue: var(--color-queue-N); }` after the `[data-broker]` map. The `--color-queue-1..6` tokens already existed from slice 1. |
| `frontend/src/app/features/messages/messages.component.spec.ts` | Modify | +6 tests (`renderTwoQueueFeed` / `feedRowPills` helpers): per-row pill carries `data-queue-color = queueColorIndex(name)` + name text; 6px dot present per pill; two same-queue rows identical; two different-queue rows differ; subscription chips carry the matching `data-queue-color`; `[data-testid="queue-color-rail"]` absent. |

### Stable DOM contracts asserted (not class strings)

`[data-testid="message-row"]`, `[data-testid="queue-pill"]` with `[data-queue-color]` in `1..6` (string), `[data-testid="queue-dot"]`, `span[data-slot="badge"] [data-testid="queue-pill"]` for chips, absence of `[data-testid="queue-color-rail"]`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `queue-color.spec.ts` | Unit (pure fn) | N/A (new) | ✅ `Cannot find module './queue-color'` | ✅ 6/6 after 4.3 | ✅ 6 cases — range, determinism, resubscribe, reference values, 6-slot spread, int32 long-name | ➖ constants extracted in 4.3 already |
| 4.2 | `messages.component.spec.ts` | Unit (TestBed + jsdom DOM) | ✅ 34/34 pre-existing green | ✅ `Cannot find module './queue-color'` (compile gate) | ✅ 6/6 after 4.4 | ✅ same-queue-match + different-queue-differ + chip pill = distinct code paths | ➖ helpers minimal |
| 4.3 | (driven by 4.1) | — | — | — | ✅ pure FNV-1a impl | ➖ | ➖ named constants, no magic numbers |
| 4.4 | (driven by 4.2) | — | ✅ full suite pre-check | — | ✅ pill + dot + card restyle + styles.css hue map | ➖ | — |
| 4.5 | full suite | Unit | n/a (refactor) | n/a | ✅ 14 files / 211 green | n/a | ✅ inline `color-mix` / `var(--queue-hue)` literals hoisted to `queuePillTint` / `queueDotFill`; `rg` confirms zero dynamic class interpolation / `[class]` / `ngClass` in the template |

### Test Summary

- Total tests written: 12 (queue-color 6, messages.component 6)
- Total tests passing: 211 (14 files) — baseline 199 / 13 files
- Layers used: Unit (12)
- Approval tests: None — no refactoring of existing production logic
- Pure functions created: 1 (`queueColorIndex`)

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command + result | `npm test -- --watch false` (from `frontend/`) → **14 files / 211 tests passed**, 0 failed (baseline 13 / 199; net +12). Focused: `npm test -- --watch false --include 'src/app/features/messages/**/*.spec.ts'` → 3 files / 49 passed. |
| Runtime harness | N/A — repo has no e2e/integration harness; Vitest is the only runner (confirmed in tasks + design). `npm run build` (from `frontend/`) succeeds; initial bundle 632.87 kB (was 630.24 kB after slice 3; +2.6 kB from the added markup + 6 CSS rules). The 500 kB budget warning is pre-existing from slice 2's vendored `@angular/cdk/overlay` (design D3), not a slice-4 regression. |
| Rollback boundary | Revert commit `f4bc7d7`. Delete `frontend/src/app/features/messages/queue-color.{ts,spec.ts}`; restore `messages.component.{ts,html,spec.ts}`; drop the 6 `[data-queue-color='N']` rules from `frontend/src/styles.css`. Slice 5 also edits `messages.component.{ts,html}` but only the reply-drawer trigger / `data-replying` regions, which slice 4 did not touch. |

### Changed-line count (this slice)

| Bucket | Added | Deleted | Total |
|---|---|---|---|
| Authored — `queue-color.ts` + `.spec.ts` (new) | 112 | 0 | 112 |
| Authored — `messages.component.{ts,html,spec.ts}` | 143 | 12 | 155 |
| Authored — `styles.css` (6 hue-map rules + comment) | 11 | 0 | 11 |
| SDD docs — `tasks.md` checkbox flips | 5 | 5 | 10 |
| **Slice total** | **271** | **17** | **288** |

Authored total ≈ 278 (SDD docs 10). No vendored output this slice. Under the 800-line review budget (decision #150) and near the 400 default (test-heavy, per strict TDD).

### Deviations from design

- None. `styles.css` gained the `[data-queue-color='N'] → --queue-hue` map exactly as design D5 / the slice-4 prompt describe ("CSS maps to `--color-queue-N`, those tokens already exist from slice 1"). The pill tint / dot fill are bound as constant inline `background-color` strings (not Tailwind arbitrary classes) so the hue stays in a custom property and no build-invisible class is generated — satisfies D5's "dynamic class strings are rejected" and task 4.5.
- Design D5 shows `queueColorIndex` inline; realized 1:1 with named constants for the FNV basis/prime/slot count (strict-TDD "extract magic numbers").
- Queue pill added to subscription chips as well as feed rows, matching the ui-presentation requirement ("Each message row **and each subscription chip** MUST identify its queue"). The tasks table named only `messages.component.*`, which is where the change lives.

### Issues found

- None. The `--include 'src/app/features/messages/**'` glob (without `/*.spec.ts`) makes the Angular test builder try to load `.html` as a spec — use `--include '…/**/*.spec.ts'` for focused runs.

---

## Slice 5 — Reply drawer + send-panel reply removal + D9 spec amendment (COMPLETE)

**Branch**: `feat/console-redesign-s5-reply-drawer` (child of `feat/console-redesign-s4-messages`) → PR5 of 5, targets `feat/console-redesign-s4-messages`.

| Task | Status |
|------|--------|
| 5.1 RED `reply-drawer.component.spec.ts` | [x] |
| 5.2 RED `messages.component.spec.ts` (data-replying, origin, not-subscribed, drawer host) | [x] |
| 5.3 RED `send.component.spec.ts` (no reply UI / no window.confirm / unconditional Exchange) | [x] |
| 5.4 GREEN vendor `frontend/libs/ui/sheet` + `tsconfig.json` path | [x] |
| 5.5 GREEN `reply-draft.service.ts` additive `origin?` on `ReplyTarget` | [x] |
| 5.6 GREEN create `reply-drawer.component.{ts,html}` | [x] |
| 5.7 GREEN `messages.component.{ts,html}` respond() → drawer + `data-replying` | [x] |
| 5.8 GREEN strip D7 code from `send.component.{ts,html}` | [x] |
| 5.9 GREEN D9 amend `specs/ui-presentation/spec.md` | [x] |
| 5.10 REFACTOR no dead reply code / unused imports in `send.component.ts` | [x] |

### How `libs/ui/sheet` was vendored (task 5.4)

The `@spartan-ng/cli` `ui-sheet` generator is Nx-only and cannot run in this plain Angular CLI
project (same situation as `dialog` in slice 2). Hand-vendored from
`node_modules/@spartan-ng/cli/src/generators/ui/libs/sheet/files/**/*.template` (CLI 1.3.3):

- Copied all 11 files verbatim (`index.ts` + `lib/hlm-sheet{,-close,-content,-description,-footer,-header,-overlay,-portal,-title,-trigger}.ts`).
- Replaced every `<%- importAlias %>` placeholder with `@spartan-ng/helm` (→ `@spartan-ng/helm/button`, `@spartan-ng/helm/utils`).
- Expanded the CLI preset utility classes (`spartan-sheet-*`) into real Tailwind, taken from the
  CLI's own nova style-map (`style-nova.css` `.spartan-sheet-*` `@apply` rules — exactly what
  `createStyleMap` inlines during a real generate), and **dropped the animation utilities**
  (`data-open:animate-in`, `data-closed:animate-out`, `slide-*`, `fade-*`, `zoom-*`) to match the
  already-vendored `dialog` lib — this project ships no `tw-animate-css` / `tailwindcss-animate`,
  so those classes do not exist. Result per slot:
  - content: `bg-popover text-popover-foreground ring-foreground/10 fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg ring-1 outline-none` + the four `data-[side=…]` positioning groups (`data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:sm:max-w-sm`, etc.)
  - overlay: `fixed inset-0 z-50 bg-black/50 supports-backdrop-filter:backdrop-blur-xs` (mirrors the vendored `hlm-dialog-overlay`)
  - header `flex flex-col gap-0.5 p-4`, footer `mt-auto flex flex-col gap-2 p-4`, title `text-foreground text-base font-medium`, description `text-muted-foreground text-sm`, close `absolute end-3 top-3`
- Added `"@spartan-ng/helm/sheet": ["./libs/ui/sheet/src/index.ts"]` to `frontend/tsconfig.json`
  (`tsconfig.app.json` / `tsconfig.spec.json` both `extends` it — no other path map to touch).
- `@spartan-ng/brain/sheet` 1.3.3 export check: `BrnSheet, BrnSheetClose, BrnSheetContent,
  BrnSheetDescription, BrnSheetOverlay, BrnSheetTitle, BrnSheetTrigger` — matches the CLI templates
  1:1. `@spartan-ng/brain/core` provides `injectExposedSideProvider` / `injectExposesStateProvider`
  used by `hlm-sheet-content`. No interactive input required; generator was never invoked.

### Reply drawer (tasks 5.5–5.7, design D3/D4/D9)

- **`ReplyTarget`** gains optional `origin?: { exchange; routingKey; payload; receivedAt }` — additive,
  `reply-draft.service.spec.ts` untouched and green.
- **`ReplyDrawerComponent`** (`app-reply-drawer`, new `features/reply/`): right-side `hlm-sheet`
  (`side="right"`), driven by `[state]="open() ? 'open' : 'closed'"` off `ReplyDraftService.draft()`
  (mirrors the `connect` dialog pattern). Pins `origin` at the top (`[data-testid="reply-origin"]`).
  Minimal form: Routing Key read-only input (`[data-testid="reply-routing-key"]`, `readonly`),
  Correlation ID read-only (only when present), Exchange is a static "(intercambio predeterminado)"
  chip, payload editable. `exchangeError` accepts `''` (AMQP default) and rejects whitespace;
  `payloadError` unconditional. `send()` issues its **own** `POST /api/messages`
  (`{ exchange: '', routingKey, payload, headers: {}, correlationId? }`), toasts, calls
  `SendHistoryService.recordSend(...)`, then `close()`. `close()` / `onStateChange('closed')` call
  `ReplyDraftService.clear()`. A `seq`-keyed `effect` resets a stale payload on a new target.
  Hosted at the end of `messages.component.html` (`<app-reply-drawer />`), inside slice 5's declared
  touch set — `app.*` untouched.
- **`MessagesComponent.respond(msg)`** now sends `{ routingKey, correlationId, origin }` where
  `origin` = `{ message.exchange, message.routingKey, message.payload, receivedAt }` and sets
  `replyingSeq`. `isReplying(msg)` drives `[data-replying="true"]` + accent ring
  (`ring-2 ring-accent border-accent`) on the source `[data-testid="message-row"]`. A constructor
  `effect` clears `replyingSeq` as soon as `ReplyDraftService.draft()` goes null (drawer close).

### D7 removal from `send.component.*` (task 5.8)

Removed: `replyMode`, `correlationId` signal, `lastAppliedDraftSeq`, `applyReplyDraft`,
`confirmOverwrite`, the `replyDraft` `effect` + `ReplyDraftService`/`ReplyTarget` imports + injection,
`onExchangeInput` / `onRoutingKeyInput` (Exchange/RK now bind straight to `signal.set`), the
`reply-exchange-chip` + reply Correlation ID template blocks, and the dead dirty-check machinery
(`isDirty`, `currentSnapshot`, `lastAppliedSnapshot`, `snapshotKey`, `captureSnapshot`,
`EMPTY_SNAPSHOT`, `FormSnapshot`). Unused imports dropped: `effect`, `untracked`. `exchangeError` is
now the unconditional `value.trim() === '' → error`. `useRecent` / `useTemplate` / `send()` lost
their `captureSnapshot()` / `replyMode.set(false)` calls. Constructor is gone entirely.
`send.component.spec.ts` lost the `reply mode (Responder pre-fill)` + `dirty-check and overwrite
confirmation` describe blocks (~19 tests) and the `ReplyDraftService` import; gained a
`reply composition has fully left the Send panel (D7)` block (4 tests).

### D9 spec amendment (task 5.9)

Appended a `## MODIFIED Requirements` entry to
`openspec/changes/console-redesign/specs/ui-presentation/spec.md` for **"Send Panel Validates
Exchange and Payload as Required"**: Exchange + payload are both unconditionally required in the Send
panel; the reply-mode scenarios ("Reply-mode empty exchange is accepted", "Editing exchange or
routing key leaves reply mode") are gone; a new scenario asserts the Send panel exposes no reply-mode
surface. The drawer owns its own empty-Exchange acceptance.

### TDD Cycle Evidence

| Task | RED (test first, observed failing) | GREEN | REFACTOR |
|---|---|---|---|
| 5.1 | `reply-drawer.component.spec.ts` — `TS2307 Cannot find module './reply-drawer.component'` + `TS2353 'origin' does not exist in type 'ReplyTarget'` (build failed) | 12/12 green after 5.5/5.6 | — |
| 5.2 | `messages.component.spec.ts` — same build gate (`origin` type, missing drawer) | +6 messages tests green | — |
| 5.3 | `send.component.spec.ts` — new D7 block failing (`replyMode` chip still rendered, `window.confirm` still wired) | 4 D7 tests green after 5.8 | — |
| 5.4 | n/a (infra) — enables 5.6 compile | `@spartan-ng/helm/sheet` resolves, `hlm-sheet` renders in the overlay | — |
| 5.5 | driven by 5.1/5.2 | `ReplyTarget.origin?` added; `reply-draft.service.spec.ts` still 6/6 green | — |
| 5.6 | driven by 5.1 | 12/12 reply-drawer tests green | — |
| 5.7 | driven by 5.2 | messages spec green (49 → focused 3 files) | — |
| 5.8 | driven by 5.3 | send spec green | — |
| 5.10 | n/a refactor | `rg` confirms no `replyMode|replyDraft|snapshot|confirmOverwrite|onExchangeInput` in `send.component.{ts,html}`; build has zero NG unused-import / NG8113 warnings | full suite 15 files / 215 green |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command + result | `npm test -- --watch false --include 'src/app/features/send/send.component.spec.ts' --include 'src/app/features/messages/messages.component.spec.ts' --include 'src/app/features/reply/reply-drawer.component.spec.ts'` → **3 files / 95 tests passed**, 0 failed. |
| Full suite | `npm test -- --watch false` (from `frontend/`) → **15 files / 215 tests passed**, 0 failed (baseline slice 4: 14 / 211; net +4 tests, +1 spec file). |
| Runtime harness | N/A — repo has no e2e/integration harness; Vitest is the only runner. `npm run build` (from `frontend/`) succeeds; initial bundle 644.93 kB (was ~632.87 kB after slice 4; +~12 kB from the vendored sheet lib + drawer). The 500 kB budget warning is pre-existing from slice 2's vendored `@angular/cdk/overlay` (design D3), not a slice-5 regression. |
| Rollback boundary | Revert the 4 slice-5 commits. Delete `frontend/libs/ui/sheet/**` and its `tsconfig.json` path; delete `frontend/src/app/features/reply/**`; revert `reply-draft.service.ts` (`origin?` line), `messages.component.{ts,html,spec.ts}` (respond origin, `replyingSeq`/`isReplying`, `data-replying`, `<app-reply-drawer />`, spec updates), `send.component.{ts,html,spec.ts}` (restore D7 reply mode + dirty guard), and the `ui-presentation` delta MODIFIED entry. No other slice touches `features/reply/**` or `libs/ui/sheet/**`. |

### Changed-line count (this slice, `git diff --stat` vs `feat/console-redesign-s4-messages` @ a633f2f)

| Bucket | Files | ~Added | ~Deleted | ~Total |
|---|---|---|---|---|
| Vendored — `libs/ui/sheet/**` (11 files) + `tsconfig.json` path | 12 | 244 | 0 | 244 |
| Authored app — `reply-drawer.component.{ts,html}`, `reply-draft.service.ts`, `messages.component.{ts,html}`, `send.component.{ts,html}` | 8 | ~290 | ~135 | ~425 |
| Test — `reply-drawer.component.spec.ts` (new), `messages.component.spec.ts`, `send.component.spec.ts` | 3 | ~300 | ~205 | ~505 |
| SDD docs — `specs/ui-presentation/spec.md`, `tasks.md`, `apply-progress.md` | 3 | ~29 + progress | ~10 | — |
| **Total (`git diff --stat`)** | **24** | **874** | **389** | **1263** |

**Budget**: 1263 changed lines is over the change's 800-line review budget (decision #150). This was
called out in the slice-5 prompt as expected (vendored sheet lib + the large D7 spec-mandated
deletions across `send.component.*` + both spec-mandated spec rewrites + verbose progress doc). The
`sdd-attempt settle` is filed honestly with `outcome: passed` and the real line count; the
maintainer decision (raise budget / accept `size:exception` / reset) is handled by the orchestrator,
same as slice 2 (Engram #179). Commits are valid strict-TDD work units and should stay.

### Deviations from design

- **`origin.receivedAt`**: design D4 types it as a required `string`, but `ReceivedMessage` carries
  no receipt timestamp (checked `bus-hub.service.ts` — only `seq`). `respond()` stamps
  `new Date().toISOString()` at drawer-open time and the drawer labels it "Recibido". No spec
  scenario asserts the value; the field shape matches D4.
- **Drawer host**: mounted inside `messages.component.html` (`<app-reply-drawer />`) rather than
  `app.html`. Keeps the change inside slice 5's declared touch set (`app.*` was slice 1's rollback
  boundary) and matches "anchored to the message". `app.html` already carried a "reply drawer
  (slice 5)" comment on the toaster host; left as-is.
- **`data-replying` mechanism**: design says "source row gets `[data-replying="true"]` with an accent
  ring while its reply is active". Realized with a `replyingSeq` signal set in `respond()` and
  cleared by an `effect` watching `ReplyDraftService.draft()` — `origin` carries no `seq`, so matching
  on `seq` locally is cleaner than comparing the whole origin object.
- Sheet animation utilities dropped (see vendoring note) — consistent with the vendored `dialog`.

### Issues found

- None blocking. `vi.mock('@spartan-ng/brain/sonner')` emits a Vitest "not at top level" hoist
  warning in `reply-drawer.component.spec.ts` — identical to the pre-existing pattern in
  `send.component.spec.ts`, harmless, hoisting still happens first.
