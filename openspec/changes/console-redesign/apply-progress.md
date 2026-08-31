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

## Slice 1 correction C2 — prototype fidelity (tokens + shell)

Scoped fix on `feat/console-redesign-s1-tokens`, commit `c723a75`. Source of
truth: `docs/redesign-prototype/Main.dc.html` (the approved design canvas,
vendored in commit cba01f3). The implemented slice 1 diverged from the `graphite`
theme object and `<style>` block of that prototype in four places.

| Gap | Prototype | Was | Now |
|-----|-----------|-----|-----|
| Queue palette | `graphite.q = ['#5ac37d','#67c1c9','#b393e6','#6f9fe0','#e08a9e']` | `#e0a34a,#3d8ef0,#4cc38a,#b57bff,#e5747a,#4bb8c4` | `--color-queue-1..5` = the prototype hues exactly; `--color-queue-6` = warm coral `#e0906a` (FNV-1a is `% 6`, needs a sixth slot distinct from accent + the five) with a code comment; all six pinned in the token spec |
| Primary buttons | `.btn { background: var(--accent); color: var(--accent-ink) }` | `--color-primary: var(--color-ink)` → every button near-white | `--color-primary: var(--color-accent)`, `--color-primary-foreground: var(--color-accent-foreground)` → buttons follow the broker accent (amber RabbitMQ / blue Kafka) and stay neutral grey while disconnected (decision #167, intended) |
| Field labels | `.lbl { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color: var(--muted) }` | no reusable class | new `.field-label` in `@layer components` with exactly those rules (`color: var(--color-muted-foreground)`); slices 2-5 apply it |
| Header | top bar is a `.card` (`background: var(--panel); border: 1px solid var(--line); border-radius: 12px`, pad ~11px 15px, margin ~14px) | `border-b` strip, `bg-card/80` | `<header>` in `app.html` restyled: `rounded-xl border border-border bg-card px-[15px] py-[11px] m-4 sm:m-6`, still `sticky top-0`; `<main>` top padding dropped to avoid a double gap |

### C2 TDD Cycle Evidence

| Step | Test | RED (observed) | GREEN |
|------|------|----------------|-------|
| C2-a queue palette | `styles.tokens.spec.ts` "queue hue tokens realize the prototype Graphite palette" — 6 pinned `it.each` rows | `expected '#e0a34a' to be '#5ac37d'` … `expected '#4bb8c4' to be '#e0906a'` (6 failing) | all 6 green after `styles.css` palette edit |
| C2-b primary | `styles.tokens.spec.ts` "--color-primary follows the broker accent, not the near-white ink" + `--color-accent-foreground` semantic-alias row | `--color-primary: var(--color-accent)` regex false (1 failing) | green after `styles.css` primary edit |
| C2-c field-label | `styles.tokens.spec.ts` ".field-label component class" — @layer membership + 4 rule assertions | `selector ".field-label" not found in styles.css` (2 failing) | green after `@layer components` block added |
| C2-d header | none — style-only Tailwind classes on a component; existing `app.spec.ts` stays green | n/a | `app.spec.ts` 2/2 green |

Total C2 RED: 9 failing assertions, then 194/194 green.

### Notes for slices 2-5 (prototype token/shell layer)

- **Apply `.field-label`** to every form/section caption (prototype uses `.lbl` on send fields, "Envíos recientes", "Plantillas", connect-dialog field labels, drawer "Mensaje original" / "Correlation ID" / "Payload de respuesta"). Plain class, no `@apply` needed.
- **Primary buttons now inherit the accent automatically** via `bg-primary` / the spartan default button variant — amber/blue/grey with no per-component work. `Desconectar` stays on `--color-destructive` (`#e5484d` ≈ prototype `#e06d6d`).
- **Prototype card metrics**: `border-radius: 12px` (`rounded-xl`), `border: 1px solid var(--line)`, `background: var(--panel)`. Inner padding `18px` (panels), `22px` (connect popup, drawer). Grid gap `14px`.
- **Prototype input** `.in`: height 34px, `radius 8px`, `background: var(--panel2)`, `:focus` border → `var(--accent)`.
- **`.qpill`** (slice 4): prototype tints `background: mix(hue, ground, .82)`, text = the hue, 6px solid dot. Current `color-mix(in oklab, var(--queue-hue) 18%, transparent)` is close — keep.
- **Status dots**: prototype connected `#57d9a3`, disconnected `#e06d6d` → reuse `--color-status-ok` / `--color-status-error`.

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

### Work Unit Evidence (Slice 2)

| Evidence | Value |
|---|---|
| Focused test command + result | `npm test -- --watch false` (from `frontend/`) → **13 files / 193 tests passed**, 0 failed |
| Runtime harness | N/A — Vitest is the only runner. `npm run build` succeeds; initial bundle budget warning grew from ~500 kB to 628 kB (+128 kB) because the vendored dialog pulls in `@angular/cdk/overlay` — expected cost of design D3. |
| Rollback boundary | Revert commits `07f3401` + `9e3d001`. Delete `frontend/libs/ui/dialog/`, drop the `@spartan-ng/helm/dialog` path, restore `frontend/src/app/features/connect/*` and the `<app-connect />` grid cell. |

### Deviations from design (Slice 2)

- **Dialog vendoring method**: design D3 says the CLI vendors the lib; the CLI is nx-only and cannot run here. Hand-vendored from the CLI's own templates with the documented class substitution. No behavioural deviation.
- **Dialog header/title in the presentational child**: plain `<h2>` / `<p>` instead of `hlmDialogTitle` / `hlmDialogDescription` (those inject `BrnDialogRef` and throw in isolation). Overlay/focus-trap/close still come from `HlmDialog` / `HlmDialogContent`.
- **`changeBroker()`**: `disconnect()` + keep popup open (body shows credentials form); the tester edits fields and submits. Matches D10 without modifying `connect()`.

### Issues found (Slice 2)

- None blocking. Bundle-size budget warning noted above. Prototype-fidelity gaps fixed in correction C3 (below).

## Slice 2 correction C3 — prototype fidelity (connect popup + status pill + header)

Branch `feat/console-redesign-s2-connect` | commit `4c9fda2`.
Source of truth: `docs/redesign-prototype/Main.dc.html` top bar (lines ~44-54), CONNECT POPUP (lines ~181-204), `.pill` / `.in` / `.lbl` / `.btn` / `.ghost` style rules, and `renderVals()`. The shipped slice 2 worked but diverged from the approved prototype in four areas; all fixed RED-first (Strict TDD).

| Gap | Fix |
|-----|-----|
| Header content | `app.html` header left is now `BusTester` (17px bold display) + a mono 10px muted caption. Broker + status pills on the right inside `app-connect`. |
| Reserved broker-selector slot | `[data-testid="broker-selector-slot"]` kept for test continuity, rendered as the prototype's active-looking `.pill` (`rounded-full` panel chip, `bg-accent` 7px dot, `RabbitMQ ▾`). Stays inert — `aria-hidden`, `aria-disabled="true"`, `tabindex="-1"`, `inert`, `pointer-events-none`. Kafka track (#143) wires the click. |
| Status pill styling | `status-pill.component` dropped `hlmBadge`+icons for a plain button styled as prototype `.pill` (`inline-flex gap-[7px] px-[11px] py-[5px] rounded-full border-border bg-card text-xs`). 7px `rounded-[3px]` dot: `bg-status-ok` connected / `bg-status-error` disconnected / `bg-status-warn` pending. `endpoint` input → `Conectado · {host}:{port}`. |
| Connect dialog | Title `Conectar a RabbitMQ` / `Conexión · RabbitMQ`. Prototype disconnected hint. `.field-label` on the 4 credential labels; inputs `h-[34px] rounded-[8px] bg-muted`. Full-width outline ghost `Cambiar a Apache Kafka`, `disabled` + `title="Kafka llega en otro cambio"`. `Desconectar` → `variant="destructive"`. Dialog card `p-[22px]`, content `gap-[14px]`. |

### C3 TDD evidence
RED: 17 failing assertions across `status-pill` / `connect-dialog` / `connect` specs. GREEN: **13 files / 205 tests passed**, 0 failed (baseline 193). `npm run build` succeeds. Commits `4c9fda2` (fix) + `3137919` (docs). Rollback = revert `4c9fda2`.

### C3 Deviations
- **`Cambiar broker` → inert `Cambiar a Apache Kafka`**: switch affordance present but `disabled` pending the Kafka track; `ConnectComponent.changeBroker()` + binding retained (still unit-tested), re-enable is a one-line template change. Note for #143.
- Arbitrary Tailwind px values where the token scale has no step — consistent with slice 1 C2.

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

## STATUS: slices 1 and 2 at prototype fidelity. Slices 3-5 fidelity passes run after this (separate agents).
