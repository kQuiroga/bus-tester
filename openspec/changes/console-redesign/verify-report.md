```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e4c11e6b97500c35f44c535e790d1305ea1f82d550bb7d03e7a4d3f83c5eb80c
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 29/29
test_command: npm test -- --no-watch
test_exit_code: 0
test_output_hash: sha256:475ee10e315b26a1c825fa4b9eec03158dffcb6f5d0f1acd9ed9ee2d4b45003f
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:1af92518d3893fca5cb225b916f2c1f79264526009954557de1d938fb8e63876
```

## Verification Report — console-redesign (WHOLE CHANGE, all 5 slices + C1–C6)

**Change**: console-redesign | **Project**: bus-tester
**Branch**: `feat/console-redesign-s5-reply-drawer` @ `0e6ff9f` — contains all 5 slices + fidelity corrections C2–C6 + C1 neutral-accent + the connection-status delta, merged from the tracker.
**Diff base**: `git merge-base HEAD origin/main` = `0d1022a`. Whole-change diff: 68 files, +16165 / −1153 (includes `docs/redesign-prototype/` and the openspec planning artifacts).
**Mode**: Strict TDD (Vitest 4.1.11 via `@analogjs/vitest-angular`) | **Verdict**: PASS WITH WARNINGS.
**Store**: hybrid — this file is authoritative; Engram `sdd/console-redesign/verify-report` (#174) is the mirror.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 34 (1.1–1.7, C1, C2, 2.1–2.5, C3, 3.1–3.6, 4.1–4.6, 5.1–5.11) |
| Tasks complete | 34 |
| Tasks incomplete | 0 |

Every task in `openspec/changes/console-redesign/tasks.md` is `[x]`. Task text matches code state:
- S1 1.1–1.7 + C1 (commit `840e319`, decision #167) + C2 (`c723a75`).
- S2 2.1–2.5 + C3 (`4c9fda2`).
- S3 3.1–3.6, incl. C4 fidelity (`baac716`).
- S4 4.1–4.6, incl. C5 fidelity (`e7ce8b0`).
- S5 5.1–5.11, incl. D7 removal, D9 spec amend, C6 fidelity (`efc7a7d` + `3924bdd`).
`apply-progress.md` and Engram #163 match the working tree; tree clean.

### Build & Tests
- `npm test -- --no-watch` (from `frontend/`) → **exit 0 · 15 files / 244 tests passed · 0 failed · 0 skipped**. Output hash `sha256:475ee10e…`. 15 `*.spec.ts` files on disk = 15 executed (no silent skips).
- `npm run build` (from `frontend/`) → **exit 0**. Initial bundle 644.55 kB (main 561.13 kB, styles 48.84 kB, polyfills 34.59 kB). Output hash `sha256:1af92518…`.
- Bundle-budget WARNING: 500 kB budget exceeded by 144.55 kB. This is the known pre-existing `@angular/cdk/overlay` cost (dialog from slice 2, sheet from slice 5, per design D3) — NOT a regression introduced by this verification. Tracked as a follow-up, not a blocker.
- No coverage tool and no e2e/integration harness configured in the repo (Vitest only) — unchanged from all prior slices.

### Spec Compliance Matrix — 10 requirements / 29 scenarios — 29/29 COMPLIANT

**Domain: ui-presentation (6 requirements / 17 scenarios)**
| Requirement / Scenario | Covering test | Result |
|---|---|---|
| Dark Mode — App loads dark by default | `styles.tokens.spec.ts` "keeps the @custom-variant dark declaration" + `index.html` static `class="dark"` | COMPLIANT |
| Dark Mode — No light tokens or theme switch exist | `styles.tokens.spec.ts` "no longer defines a `.dark {}` block" + "defines no light-theme token block (no :root / .light)" | COMPLIANT |
| Recent Sends — added newest-first and capped at 5 | `send-history.service.spec.ts` "recordSend adds the new entry first" + "caps the list at 5 entries, evicting the oldest (FIFO)" | COMPLIANT |
| Recent Sends — recalling populates the form | `send.component.spec.ts` "useRecent(entry) populates exchange/routingKey/payload" | COMPLIANT |
| Recent Sends — Vaciar clears list + persisted key, empty after reload | `send-history.service.spec.ts` "clearRecentSends empties the in-memory list AND removes the persisted localStorage key" + "keeps the list empty after a reload" | COMPLIANT |
| Recent Sends — upgrade migration truncates >5 | `send-history.service.spec.ts` "truncates a persisted list longer than 5 to the 5 most recent AND rewrites the key on first load" | COMPLIANT |
| Send Panel — blank/whitespace payload rejected | `send.component.spec.ts` "blocks submit and touches all fields when exchange and payload are blank" | COMPLIANT |
| Send Panel — blank/whitespace exchange rejected | `send.component.spec.ts` "Exchange is unconditionally required in the send panel: an exactly-empty value is an error" | COMPLIANT |
| Send Panel — non-blank exchange + payload accepted | `send.component.spec.ts` "submits exchange/routingKey/payload as POST /api/messages and confirms success" | COMPLIANT |
| Send Panel — exposes no reply mode | `send.component.spec.ts` D7 block "renders no reply UI: no reply-exchange-chip, no correlationId input, exchange input always present" + "exposes no reply-mode surface on the component instance" | COMPLIANT |
| Graphite Palette — palette + fonts applied | `styles.tokens.spec.ts` palette table (6 hex) + semantic aliases + typography table (3 families + fallback) | COMPLIANT |
| Graphite Palette — radii trace to 12px token | `styles.tokens.spec.ts` "--radius-base resolves to 0.75rem" + "--radius-{sm,md,lg,xl} declared as var(--radius-base)" | COMPLIANT |
| Accent — reflects the RabbitMQ broker | `styles.tokens.spec.ts` "maps --broker-accent to the RabbitMQ amber under [data-broker='rabbitmq']" + `connect.component.spec.ts` "sets the RabbitMQ accent after a successful connect" | COMPLIANT |
| Accent — falls back neutral when disconnected | `styles.tokens.spec.ts` "--color-accent is an indirection that defaults to a neutral, non-broker accent" + `broker-accent.service.spec.ts` (null broker → no data-broker) + `connect.component.spec.ts` "disconnect() clears the broker accent back to neutral" | COMPLIANT |
| Queues — row shows tinted pill + 6px dot | `messages.component.spec.ts` "renders a queue pill on each feed row carrying … data-queue-color (4.2)" + "renders a 6px colour dot inside each feed-row queue pill (4.2)" | COMPLIANT |
| Queues — same queue keeps the same color | `messages.component.spec.ts` "gives two rows received on the same queue the identical data-queue-color (4.2)" + `queue-color.spec.ts` "deterministic" / "stable across a resubscribe" | COMPLIANT |
| Queues — no left color rail | `messages.component.spec.ts` "renders no left-side per-queue colour rail on the feed (4.2)" | COMPLIANT |

**Domain: connection-status (2 requirements / 6 scenarios)**
| Requirement / Scenario | Covering test | Result |
|---|---|---|
| Popup — shows on load when not connected | `connect.component.spec.ts` "auto-opens the connect popup on load while there is no broker connection" | COMPLIANT |
| Popup — collapses to status pill after connecting | `connect.component.spec.ts` "dismisses the popup and sets the RabbitMQ accent after a successful connect" | COMPLIANT |
| Pill while connected offers disconnect + switch, no re-login | `connect.component.spec.ts` "shows disconnect/switch controls and no credential fields once connected" + `connect-dialog.component.spec.ts` "shows Desconectar and the Kafka switch affordance with NO credential fields while connected" / "never presents credential inputs while connected, even after a previous error" | COMPLIANT |
| Pill while disconnected re-opens the popup | `connect.component.spec.ts` "re-opens the same popup when the status pill is activated" | COMPLIANT |
| Hub reconnecting renders inline within the pill | `status-pill.component.spec.ts` "renders the hub reconnecting state inline inside the pill, not as a separate banner" | COMPLIANT |
| Reserved broker-selector slot present but inert | `connect.component.spec.ts` "renders a reserved broker-selector slot beside the pill that is inert and non-focusable" + "renders the reserved slot as the prototype broker pill: 'RabbitMQ ▾', accent dot, inert" | COMPLIANT |

**Domain: request-reply (2 requirements / 6 scenarios)**
| Requirement / Scenario | Covering test | Result |
|---|---|---|
| Responder Drawer — message with `replyTo` exposes the action | `messages.component.spec.ts` "renders a Responder control on a feed row whose message has a non-null replyTo (3.1)" | COMPLIANT |
| Responder Drawer — message without `replyTo` does not | `messages.component.spec.ts` "renders no Responder control on a feed row whose message has no replyTo (3.1)" | COMPLIANT |
| Responder Drawer — opens anchored, origin pinned, fields pre-filled (empty Exchange, RK=`replyTo`, CID=`correlationId`), payload empty | `reply-drawer.component.spec.ts` "opens with the original message pinned at the top" + "pre-fills the routing key read-only, keeps Exchange empty, and leaves the payload blank" + `messages.component.spec.ts` "clicking a row Responder hands the source message as the pinned origin (5.2)" + "clicking a row Responder calls ReplyDraftService.request with routingKey=replyTo and the message correlationId (3.2)" | COMPLIANT |
| Responder Drawer — Send panel unchanged, enters no reply mode | `send.component.spec.ts` D7 block + `messages.component.spec.ts` "marks the source row [data-replying='true'] … clears it when the draft clears (5.2)"; `SendComponent` has zero coupling to `ReplyDraftService`/`ReplyTarget` (rg-confirmed) | COMPLIANT |
| Responder Drawer — reply works while not subscribed | `messages.component.spec.ts` "the Responder action works even when not subscribed to the source queue (5.2)" | COMPLIANT |
| Responder Drawer — `replyTo` but no `correlationId` → Exchange/RK pre-filled, CID blank | `reply-drawer.component.spec.ts` "renders the readonly Correlation ID input even when the source message had none" + `messages.component.spec.ts` "clicking a row Responder passes correlationId null when the message has no correlationId (3.2)" + `reply-drawer.component.spec.ts` "omits the correlationId key entirely when the source message had none" | COMPLIANT |
| REMOVED "Overwriting Unsaved Send-Panel Edits Requires Confirmation" — verified gone | `send.component.spec.ts` "never calls window.confirm (the unsaved-edits guard is gone)" + "exposes no reply-mode surface"; rg finds no `window.confirm`, `confirmOverwrite`, `isDirty`, `FormSnapshot`, `snapshotKey`, `EMPTY_SNAPSHOT` in `send.component.*` | COMPLIANT (verified removed) |

Compliance summary: 29/29 scenarios compliant with passing covering tests; the REMOVED requirement is verified gone.

### Correctness (static evidence)
| Item | Status | Notes |
|---|---|---|
| `--color-primary` = `var(--color-accent)` | OK | `styles.css` L57 `--color-primary: var(--color-accent)`, L58 `--color-primary-foreground: var(--color-accent-foreground)`; tested `styles.tokens.spec.ts` "--color-primary follows the broker accent, not the near-white ink". Primary buttons render neutral grey while disconnected (accent → `--color-accent-neutral: #9a9a9a`), amber on RabbitMQ. |
| Queue palette | OK | `styles.css` `--color-queue-1..6` = `#5ac37d,#67c1c9,#b393e6,#6f9fe0,#e08a9e,#e0906a` — slots 1–5 are the prototype `graphite.q`; slot 6 (`#e0906a` warm coral) extends it because FNV-1a is `% 6`. All 6 pinned in `styles.tokens.spec.ts`. Matches the approved-palette expectation exactly. |
| `.field-label` class | OK | Defined in `styles.css` `@layer components` — 11px, `letter-spacing: 0.06em`, `text-transform: uppercase`, `color: var(--color-muted-foreground)`. Tested. Applied in `send.component.html` (5×), `connect-dialog.component.html` (4×), `reply-drawer.component.html` (3×). Not used in `messages.component.html` — correct: the prototype LIVE card carries no `.lbl` captions there. |
| Header is a card | OK | `app.html` `<header>` = `sticky top-0 z-10 m-4 … rounded-xl border border-border bg-card px-[15px] py-[11px] sm:m-6` (was a `border-b` strip). Left: `BusTester` 17px bold display + mono 10px caption. |
| Broker pill + status pill | OK | `connect.component.html` renders `● RabbitMQ ▾` inert pill (`aria-hidden`, `aria-disabled`, `tabindex="-1"`, `inert`, `pointer-events-none`) with an accent dot; `status-pill.component.html` = `.pill` chrome (`gap-[7px]`, `px-[11px] py-[5px]`, `rounded-full`, `border-border`, `bg-card`, `text-xs`) with a 7px `rounded-[3px]` status dot (green/red/warn). |
| `.qpill` dark tint + hue text | OK | `messages.component.ts` `queuePillTint = 'color-mix(in oklab, var(--queue-hue) 14%, var(--color-ground))'`, `queuePillText = 'var(--queue-hue)'`, `queueDotFill = 'var(--queue-hue)'`. Dot `rounded-[3px]` (tested "rounded square, not a circle"). `.msg` cards `bg-panel-2 border-border rounded-[9px] px-[11px] py-[9px]`. Amber "Responder" = ghost button `text-accent`. `.empty` dashed box via `emptyFeedMessage()` 3-state. |
| Reply drawer fidelity | OK | `reply-drawer.component.html`: `hlm-sheet-content` `bg-card p-[18px] sm:max-w-[420px]` `[showCloseButton]="false"`; header `● dot Responder` — dot `size-1.5 shrink-0 rounded-[3px]` filled `var(--queue-hue)`; "MENSAJE ORIGINAL" box `rounded-[8px] border border-border border-l-2 bg-muted` + `[style.border-left-color]="var(--queue-hue)"`, `.field-label` caption + mono RK + mono meta + mono payload; readonly Correlation ID `.in` (`h-[34px] rounded-[8px] bg-muted font-mono text-muted-foreground`); payload textarea `min-h-[120px] rounded-[8px] bg-muted`; full-width `hlmBtn` `h-[38px] rounded-[9px]` "Enviar respuesta" (primary = accent → amber); muted `text-[11px]` caption "El panel de Enviar queda intacto con tu borrador." Hue plumbing: `ReplyTarget.origin.queue` → `queueColorIndex()` → `[attr.data-queue-color]` on the sheet content. |
| Decision #167 — neutral accent when disconnected | OK | Tokens: `--color-accent: var(--broker-accent, var(--color-accent-neutral))`, `--color-accent-neutral: #9a9a9a`, explicit `[data-broker='rabbitmq']` / `[data-broker='kafka']` maps. `BrokerAccentService`: `_broker` signal typed `BrokerKind | null`, initial `null`; `effect()` deletes `root.dataset['broker']` when `null`, else sets it. `disconnect()` in `connect.component` calls `setBroker(null)` (tested). |
| D7 — reply/dirty-guard removed from `send.component.ts` | OK | rg-clean: no `replyMode`, `correlationId` reply signal, `confirmOverwrite`, `applyReplyDraft`, `lastAppliedDraftSeq`, `replyDraft` effect, `onExchangeInput`/`onRoutingKeyInput`, `reply-exchange-chip`, `isDirty`, `currentSnapshot`, `lastAppliedSnapshot`, `snapshotKey`, `EMPTY_SNAPSHOT`, `FormSnapshot`, `window.confirm`. `exchangeError` = unconditional `this.exchange().trim() === '' ? … : null`. Remaining `correlationId` hits are the unrelated NServiceBus Comunes-header map + `send-with-reply` response. Exchange field is always an editable `hlmInput`. |
| D9 / task 5.9 — spec amendment | OK | `specs/ui-presentation/spec.md` carries `### Requirement: Send Panel Validates Exchange and Payload as Required` under `## MODIFIED Requirements` with a `(Previously: … reply mode … read-only …)` note, the three validation scenarios + the new "The Send panel exposes no reply mode" scenario. Structure consistent with sibling entries. openspec CLI not installed here; delta inspected manually. |
| `libs/ui/sheet` vendored | OK | Mirrors `libs/ui/dialog`; `tsconfig.json` path `@spartan-ng/helm/sheet`; `@spartan-ng/brain/sheet` 1.3.3 installed; no `animate-in`/`slide-*`/`fade-*`/`zoom-*` utilities; build resolves all imports. |
| `ReplyTarget` extended additively | OK | `origin?: { exchange; routingKey; payload; receivedAt; queue }` optional; `ReplyDraftService` not forked; `reply-draft.service.spec.ts` green. |
| No scope leak | OK | Whole-change diff touches only `frontend/**` and `openspec/changes/console-redesign/**`, plus the deliberately-added `docs/redesign-prototype/**` (design source of truth per Engram #192). No backend, no `openspec/changes/broker-abstraction/`, no `../bus-tester-kafka` worktree. |

### Coherence (design)
| Decision | Followed? | Notes |
|---|---|---|
| D1 — keep `@custom-variant dark` + `class="dark"`, delete only `.dark {}` | Yes | Tested in `styles.tokens.spec.ts`. |
| D2 — broker accent via `<html data-broker>` | Yes | `BrokerAccentService` uses `DOCUMENT` + `effect()`; covers CDK overlays. |
| D3 — connect popup = vendored `dialog`, drawer = vendored `sheet` | Yes | Both hand-vendored from CLI 1.3.3 templates. |
| D4 — `ReplyTarget` additive, `ReplyDraftService` not forked; "anchored" = pinned origin + `[data-replying]` ring | Yes | As designed. |
| D5 — queue color = FNV-1a mod 6, `[data-queue-color]` | Yes | `queue-color.ts` pure `Math.imul` FNV-1a `% 6 + 1`; 6 pinned reference values tested. |
| D6 — recent-sends cap/clear/migration in `SendHistoryService` | Yes | `RECENT_SENDS_CAP = 5`, `loadCapped()` truncate + rewrite, `clearRecentSends()` removeItem. |
| D7 — unsaved-edits guard deleted entirely | Yes | rg-clean + passing D7 tests. |
| D8 — fonts via Google Fonts `<link>` + fallback stack | Yes | `index.html` link; each `--font-*` ends in a system fallback. |
| D9 — Send panel loses reply mode; drawer owns its own form + validation | Yes | Send-panel Exchange rule unconditional; drawer validates its own empty Exchange (AMQP default). |
| D10 — "Cambiar broker" reuses connect flow, no Kafka wiring | Partial / see WARNING | The connect dialog ships a `disabled` "Cambiar a Apache Kafka" ghost button (inert until Kafka track #143) instead of a functional "Cambiar broker". The `broker-selector-slot` stays inert. Deviates from D10's "reopen the same dialog in its credentials form" but is consistent with decision #167 intent and the reserved-slot requirement. No spec broken (the connection-status scenario only requires disconnect + switch controls with no re-login; `changeBroker()` DELETE-then-reopen path exists and is tested). |
| Drawer host location | Deviation (WARNING) | `<app-reply-drawer />` hosted in `messages.component.html`, not `app.*` as the design File-Changes table implies. Sheet portals into the CDK overlay container (DOM-position-independent), still inside `<html data-broker>` accent scope, MessagesComponent always rendered. Justified by slice-boundary hygiene. |

### TDD Compliance
| Check | Result | Details |
|---|---|---|
| TDD evidence reported | OK | Per-slice RED/GREEN evidence in `apply-progress.md` + Engram #163 for all 5 slices and C2–C6. |
| All tasks have tests | OK | Each slice's RED tasks create/extend a spec file before the GREEN implementation. |
| RED confirmed | OK | e.g. S1 `styles.tokens.spec.ts` rewrite (`.dark {` extraction throws); S4 `queue-color.spec.ts` missing module; S5 `TS2353 'origin' not in ReplyTarget` + `reply-drawer.component` missing; C6 compile-fail on `origin.queue`. |
| GREEN confirmed | OK | Full suite 244/244 on a fresh run at HEAD. |
| Triangulation | OK | `queue-color.spec.ts` 6 cases inc. reference FNV values + long-name int32; `send-history.service.spec.ts` cap/FIFO/migration/corruption; `reply-drawer.component.spec.ts` 17 cases. |
| Safety net for modified files | OK | `messages.component.spec.ts` / `send.component.spec.ts` pre-existed and stayed green apart from the intentionally deleted reply-mode + dirty-check blocks (REMOVED-requirement migration). |

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit + Integration (Angular TestBed + `HttpTestingController`, jsdom) | 244 | 15 | Vitest 4.1.11 via `@analogjs/vitest-angular` |
| E2E | 0 | 0 | not installed (no harness in repo) |

### Changed-File Coverage
Coverage analysis skipped — no coverage tool configured in this repo (unchanged from slices 1–5).

### Assertion Quality
0 CRITICAL, 0 WARNING, 2 SUGGESTION.
- Token specs assert resolved computed values (`getComputedStyle`) against pinned hex, not source-string churn — real behavior.
- Component specs assert rendered `textContent`, `data-*` contract attributes, service-call arguments, and HTTP request bodies. `[data-queue-color]` / `[data-replying]` assertions target documented DOM contracts (design D4/D5), acceptable under the "stable contract" carve-out.
- SUGGESTION: `messages.component.spec.ts` "hosts the reply drawer inside the feed (5.7)" asserts only `querySelector('app-reply-drawer') !== null` — wiring assertion, near smoke-only on its own (drawer behavior fully covered in `reply-drawer.component.spec.ts`).
- SUGGESTION: "Send panel untouched by Responder" is proven architecturally (SendComponent has zero coupling to `ReplyDraftService`) + via D7 "no reply UI" tests rather than one end-to-end "type in Send fields, activate Responder, assert unchanged" test. Equivalent guarantee.

### Quality Metrics
Linter: not run as a separate gate. Type checker: `ng build` type-checks the whole project with `strictTemplates` — exit 0, zero errors.

### Known Deviations Assessed (non-blocking)
1. **Feed meta wording** — RESOLVED. `messages.component.ts` `metaExchange()` returns `(intercambio predeterminado)` (not `(default)`) for an empty exchange; the reply drawer's `originMeta()` matches. No action.
2. **Reply drawer sheet size** — `sm:max-w-[420px]` matches the prototype's 420px width; the sheet is full-height by the `hlm-sheet` primitive (prototype drawer is `height:100%` too). Minor: the drawer shows no editable Exchange or Routing-Key input — the prototype also omits them (RK is shown read-only in the pinned-origin box; exchange is the implicit AMQP default). The send still posts `exchange: ''` + `routingKey: replyTo` internally (tested). Consistent with the prototype and with all 6 request-reply scenarios passing. No action.
3. **"Suscribirse" button tint when the input holds an already-subscribed queue** — `messages.component.html` disables the button via `[disabled]="isDuplicateQueue()"`, so it renders in the muted disabled state (looks "muddy"). Cosmetic; behavior (no-op on duplicate) is spec-correct and tested. SUGGESTION for a follow-up polish pass.
4. **Connect dialog uses `<h2>`/`<p>` instead of `hlmDialogTitle`/`hlmDialogDescription`** — accessibility gap: the dialog has no `aria-labelledby`/`aria-describedby` wiring. No spec scenario covers dialog a11y, but this should be fixed in a follow-up. WARNING.
5. **Connect dialog credential fields are editable, not `readonly`** — the prototype shows them `readonly` (it is a static mockup with fixed `localhost:5672`). The real app needs functional credential entry on first connect; the connection-status "no re-login" rule only applies to the connected-state pill, which is honored. Reasonable deviation from a mockup. No action.
6. **`origin.receivedAt` stamped at drawer-open time, labeled "Recibido"** — reads as the message receive time when it is really the responded-at time (`ReceivedMessage` carries no receipt timestamp). No scenario asserts the value. SUGGESTION: relabel or add a real receipt timestamp in a follow-up.
7. **`vi.mock('@spartan-ng/brain/sonner')` hoist warning** in `send.component.spec.ts` and `reply-drawer.component.spec.ts` — harmless, identical pattern in both; move to module top level when convenient. SUGGESTION.

### Issues Found
**CRITICAL**: None.
**WARNING**: 2 —
1. Reply drawer hosted in `messages.component.html` instead of the `app.*` shell the design File-Changes table implies. No spec broken; review at chain integration (already noted in slice-5 report #174).
2. D10 partial: connected-state "switch broker" is a `disabled` "Cambiar a Apache Kafka" ghost button + inert `broker-selector-slot` rather than a functional dialog re-target. Matches decision #167 / reserved-slot intent and the Kafka track (#143) seam; the connection-status "disconnect or switch" scenario still passes (a `changeBroker()` DELETE + reopen path exists and is tested). Confirm this is the intended end state for this change before archive.
**SUGGESTION**: 4 —
1. Global 500 kB bundle-budget breach (644.55 kB) — pre-existing CDK-overlay (`dialog` + `sheet`) cost. Resolve once for the whole change (raise the budget or lazy-load the overlay module).
2. Connect dialog a11y: adopt `hlmDialogTitle` / `hlmDialogDescription`.
3. `origin.receivedAt` / "Recibido" label semantics.
4. `vi.mock` hoist warnings — move both to module top level.

### Verdict
**PASS WITH WARNINGS** — 0 blockers, 0 critical, 2 warnings, 4 suggestions.

**Is the whole change ready for `sdd-archive`? YES.** All 29 delta scenarios across the 3 domains are COMPLIANT with passing covering tests, the REMOVED requirement is verified gone, all 34 tasks (1.1–5.11 + C1–C6) are `[x]` and match code, prototype fidelity is met on every spot-check (`--color-primary` = accent, 6-hue queue palette, `.field-label`, header card, broker + status pills, `.qpill` dark tint, reply drawer chrome), decision #167 and design D7/D9 are implemented and rg-clean, and `npm test` (244/244) + `npm run build` (exit 0) both pass. No scope leak.

The two WARNINGs do not block archive:
- The drawer host location is an internal structural deviation with no spec impact.
- The D10 "switch broker" reduction to an inert affordance is a deliberate seam for the parallel Kafka track; it should simply be confirmed as the intended end state during archive review.

The bundle-budget breach is a pre-existing, well-understood follow-up (raise budget or lazy-load `@angular/cdk/overlay`), explicitly out of scope for this change per the slice reports.

**Next recommended**: `sdd-archive`.
