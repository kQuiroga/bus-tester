# Tasks: Console Redesign (Graphite)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1930 (S1 330 / S2 500 / S3 300 / S4 350 / S5 450) |
| 400-line budget risk | High |
| 800-line budget risk (this change) | Low — largest slice 500 < 800 |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain, tracker `feat/console-redesign` (draft/no-merge) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

No slice risks the 800-line review budget (decision #150); slices chain only to keep child diffs focused. PR1 base = tracker; PR2 base = PR1; PR3 base = PR2; PR4 base = PR3; PR5 base = PR4. Retarget/rebase any child PR whose diff shows an earlier slice.

### Suggested Work Units

| Unit | Goal | PR / Base | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Graphite tokens + shell + accent seam | PR1 / tracker | `npm test -- --watch false` in `frontend/` | N/A — repo has no e2e/integration harness; Vitest is the only runner | `styles.css`, `styles.tokens.spec.ts`, `index.html`, `app.*`, `broker-accent.service*` |
| 2 | Connect popup + status pill + reserved slot | PR2 / PR1 | same | N/A (same) | `libs/ui/dialog`, `tsconfig.json` path, `features/connect/*` |
| 3 | Recent sends: cap 5, Vaciar, migration | PR3 / PR2 | same | N/A (same) | `send-history.service*`, recent-sends block of `send.component.*` |
| 4 | Messages cards + queue pill/dot | PR4 / PR3 | same | N/A (same) | `queue-color*`, `messages.component.*` |
| 5 | Reply drawer + send reply removal + D9 amend | PR5 / PR4 | same | N/A (same) | `libs/ui/sheet`, `features/reply/*`, `reply-draft.service*`, reply code in `send.component.*`, ui-presentation delta |

### Requirement → Slice

- S1: Dark Mode Is the Default Theme; Graphite Palette, Typography, and Radii; Accent Color Follows the Connected Broker
- S2: Connection UI Is a Load-Time Popup That Collapses to a Status Pill; Reserved Broker-Selector Slot
- S3: Recent Sends Are Recorded, Capped, and Recallable
- S4: Queues Are Identified by a Tinted Pill and Dot
- S5: Responder Action Opens a Reply Drawer Anchored to the Message; Overwriting Unsaved Send-Panel Edits Requires Confirmation (REMOVED); D9 amendment to "Send Panel Validates Exchange and Payload as Required"

Strict TDD: every slice runs RED → GREEN → REFACTOR against `npm test -- --watch false` (Vitest, from `frontend/`). Threat matrix: N/A per design.

## Phase 1 — Slice 1: Graphite tokens + shell + accent seam (no deps)

- [x] 1.1 RED: rewrite `frontend/src/styles.tokens.spec.ts` — remove `.dark {` extraction; assert single-mode Graphite hex values, 12px radius base, three font families, accent-indirection default.
- [x] 1.2 RED: add `frontend/src/app/core/broker-accent.service.spec.ts` — `effect()` sets `<html data-broker>`; `'kafka'` maps `--broker-accent`; default resolves RabbitMQ amber.
- [x] 1.3 GREEN: collapse `frontend/src/styles.css` to one dark `@theme` (palette, radii, queue hues, `--color-accent` indirection); delete `.dark {}`; add `[data-broker='kafka']` map; keep `@custom-variant dark`.
- [x] 1.4 GREEN: `frontend/src/index.html` — Google Fonts `<link>` + fallback stacks; keep `class="dark"`.
- [x] 1.5 GREEN: create `frontend/src/app/core/broker-accent.service.ts` (`BrokerKind` signal → `documentElement.dataset['broker']` via `DOCUMENT` + `effect()`); provide in root; stays `'rabbitmq'`.
- [x] 1.6 GREEN: `frontend/src/app/app.{ts,html}` — shell/header on surface tokens, dialog/sheet host outlets; full suite green.
- [x] 1.7 REFACTOR: dedupe token names, no hardcoded radii/colors in touched files; suite green.
- [x] C1 CORRECTION (decision #167, commit 840e319): disconnected accent is NEUTRAL, not RabbitMQ amber. `broker` signal becomes `BrokerKind | null` (initial `null`); `effect()` removes `data-broker` when `null`. `styles.css` adds `--color-accent-neutral: #9a9a9a`, `--color-accent` falls back to it, explicit `[data-broker='rabbitmq']` + `[data-broker='kafka']` maps. `styles.tokens.spec.ts` + `broker-accent.service.spec.ts` adjusted RED-first. `design.md` D2 + D10 amended. Suite: 11 files / 189 tests green.
- [x] C2 FIDELITY (prototype `docs/redesign-prototype/Main.dc.html`, commit c723a75): RED-first in `styles.tokens.spec.ts` (9 assertions) then GREEN. (a) `--color-queue-1..5` set to the prototype `graphite.q` hues `#5ac37d,#67c1c9,#b393e6,#6f9fe0,#e08a9e`; `--color-queue-6` extends with warm coral `#e0906a` (FNV-1a is `% 6`); all six pinned. (b) `--color-primary: var(--color-accent)` + `--color-primary-foreground: var(--color-accent-foreground)` (was `var(--color-ink)` / `var(--color-ground)`) so primary buttons follow the broker accent and stay neutral grey while disconnected — matches prototype `.btn`. (c) new `.field-label` class in `@layer components` (11px, `.06em` tracking, uppercase, `var(--color-muted-foreground)`) mirroring prototype `.lbl`; slices 2-5 apply it. (d) `<header>` in `app.html` restyled as a card (panel surface, full 1px border, 12px radius, `m-4`/`sm:m-6` inset) instead of a `border-b` strip; still sticky. Suite: 11 files / 194 tests green; `npm run build` succeeds.

## Phase 2 — Slice 2: Connect popup + status pill + reserved slot (deps: S1)

- [x] 2.1 RED: connect component specs — dialog auto-opens while `!connected()`; pill always rendered, click reopens same dialog; connected body shows `Desconectar` / `Cambiar broker`, no credential fields; `[data-testid="broker-selector-slot"]` present, `aria-hidden`, non-focusable; hub `reconnecting` renders inline in pill.
- [x] 2.2 GREEN: vendor `frontend/libs/ui/dialog` via spartan CLI + add `tsconfig.json` path (match existing helm libs). — CLI is nx-only; hand-vendored from CLI 1.3.3 generator templates.
- [x] 2.3 GREEN: split `features/connect/` into container + `connect-dialog` / `status-pill` presentational children; `connectDialogOpen` signal; body switches on `connected()`; `Cambiar broker` reopens credentials form, runs existing `disconnect()` → `connect()` on `/api/connections`.
- [x] 2.4 GREEN: render inert `broker-selector-slot` beside the pill; suite green.
- [x] 2.5 REFACTOR: delete the old permanent connect column; suite green.
- [x] C3 FIDELITY (prototype `docs/redesign-prototype/Main.dc.html`, commit 4c9fda2): RED-first — 17 failing specs across `status-pill` / `connect-dialog` / `connect` component suites, then GREEN 205/205; `npm run build` succeeds. (a) `status-pill` restyled to the prototype `.pill` (inline-flex, `gap-[7px]`, `px-[11px] py-[5px]`, `rounded-full`, `border-border`, `bg-card`, `text-xs`) with a 7px `rounded-[3px]` dot tinted `bg-status-ok` connected / `bg-status-error` disconnected / `bg-status-warn` on pending/hub churn; icons dropped; connected label now `Conectado · {host}:{port}` via a new `endpoint` input. (b) `connect-dialog` title `Conectar a RabbitMQ` (disconnected) / `Conexión · RabbitMQ` (connected); prototype hint `No estás conectado. El acento sigue al broker: ámbar para RabbitMQ, azul para Kafka.`; `.field-label` on all four credential labels; inputs styled to prototype `.in` (`h-[34px] rounded-[8px] bg-muted`); full-width outline ghost `Cambiar a Apache Kafka`, `disabled` + `title="Kafka llega en otro cambio"` (inert until Kafka track #143 — replaces the old functional `Cambiar broker` button; `Desconectar` now `variant="destructive"`). (c) `broker-selector-slot` kept as the test id but rendered as the prototype's active-looking pill `● RabbitMQ ▾` (`rounded-full` panel chip + `bg-accent` dot); stays inert — `aria-hidden`, `aria-disabled="true"`, `tabindex="-1"`, `inert`, `pointer-events-none`. (d) `app.html` header left: `BusTester` (17px bold display) + mono 10px caption; dialog card padding `p-[22px]`, content gap `gap-[14px]`.

## Phase 3 — Slice 3: Send panel recent sends (deps: S1)

- [ ] 3.1 RED: `send-history.service.spec.ts` — record caps at 5 with FIFO eviction; `clearRecentSends()` empties memory AND calls `removeItem('send-panel.recent-sends')`; `loadCapped()` truncates a >5 stored array and rewrites the key.
- [ ] 3.2 RED: `send.component.spec.ts` — `Vaciar` calls `clearRecentSends()`; recall populates `exchange` / `routingKey` / `payload`.
- [ ] 3.3 GREEN: `send-history.service.ts` — `RECENT_SENDS_CAP = 5`, `loadCapped()` truncate+rewrite migration, `clearRecentSends()`.
- [ ] 3.4 GREEN: `send.component.{ts,html}` — recent-sends layout (≤5) + `Vaciar` control wired to the service; suite green.
- [ ] 3.5 REFACTOR: component delegates to the service only, no storage access in the component; suite green.

## Phase 4 — Slice 4: Messages feed cards + queue pill/dot (deps: S1)

- [ ] 4.1 RED: create `frontend/src/app/features/messages/queue-color.spec.ts` — `queueColorIndex` returns 1..6, deterministic, stable across resubscribe; same queue name → same index.
- [ ] 4.2 RED: `messages.component.spec.ts` — row renders `[data-queue-color]` pill + 6px dot of the same hue; two same-queue rows match; no left color rail.
- [ ] 4.3 GREEN: create `frontend/src/app/features/messages/queue-color.ts` — pure FNV-1a (`Math.imul`) `% 6 + 1`, `QueueColor` type.
- [ ] 4.4 GREEN: `messages.component.{ts,html}` — card restyle on surface tokens; queue pill + dot via `[data-queue-color='N']` → `--queue-hue`; remove left rail; suite green.
- [ ] 4.5 REFACTOR: no dynamic Tailwind hue class strings; suite green.

## Phase 5 — Slice 5: Reply drawer + send-panel reply removal + spec amendment (deps: S3 file-level, S4 behavior)

- [ ] 5.1 RED: `reply-drawer.component.spec.ts` — opens on `respond()` with `origin` pinned at top; RK read-only = `replyTo`, CID = `correlationId` (blank when absent), Exchange empty (AMQP default, accepted), payload empty; `close()` calls `ReplyDraftService.clear()`; drawer validates its own empty exchange; POST `/api/messages` + recent-sends recording.
- [ ] 5.2 RED: `messages.component.spec.ts` — source row gets `[data-replying="true"]` while drawer open; Responder hidden when `replyTo` null; works while not subscribed.
- [ ] 5.3 RED: `send.component.spec.ts` — no reply UI / `reply-exchange-chip` / `window.confirm`; Exchange unconditionally required (empty → `exchangeError`).
- [ ] 5.4 GREEN: vendor `frontend/libs/ui/sheet` via spartan CLI + add `tsconfig.json` path.
- [ ] 5.5 GREEN: `reply-draft.service.ts` — add optional `origin?: { exchange; routingKey; payload; receivedAt }` to `ReplyTarget` (additive; existing spec stays green).
- [ ] 5.6 GREEN: create `frontend/src/app/features/reply/reply-drawer.component.{ts,html}` — right `sheet`, pinned original message, minimal reply form with its own send + validation.
- [ ] 5.7 GREEN: `messages.component.{ts,html}` — `respond(msg)` calls `request({ routingKey, correlationId, origin })`, opens the drawer, sets `data-replying`.
- [ ] 5.8 GREEN: strip D7 code from `send.component.{ts,html}`: `replyMode`, `correlationId`, `lastAppliedDraftSeq`, `applyReplyDraft`, `confirmOverwrite`, `replyDraft` effect, reply-exit branches in `onExchangeInput` / `onRoutingKeyInput`, `reply-exchange-chip` block, dead `isDirty` / `currentSnapshot` / `lastAppliedSnapshot` / `snapshotKey` / `EMPTY_SNAPSHOT` / `FormSnapshot`, reply branch in `exchangeError`; suite green.
- [ ] 5.9 GREEN: add a `MODIFIED Requirements` entry for "Send Panel Validates Exchange and Payload as Required" to `openspec/changes/console-redesign/specs/ui-presentation/spec.md` — remove the reply-mode scenarios, restore the unconditional Exchange-required rule (D9).
- [ ] 5.10 REFACTOR: no dead reply code or unused imports in `send.component.ts`; full suite green.
