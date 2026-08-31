```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3a119c50b62269c1e182cc79a7d430b3f52a7facc0ef534911ebc7282ed06026
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 2/2
scenarios: 5/5
test_command: npm test -- --watch false
test_exit_code: 0
test_output_hash: sha256:62c7c64f0e2d14be23e857c50ad1a260043e7876b16bb29b76d9997192565dfb
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:aa4c62537019aeafc653c261bd17da9f082f92d830ff0c1c0a7e5ff97f86af88
```

## Verification Report — console-redesign SLICE 2 only (PR2)

**Change**: console-redesign
**Slice**: 2 — Connect popup + status pill + reserved broker-selector slot
**Branch**: `feat/console-redesign-s2-connect` @ `8acd4ff` (child of `feat/console-redesign-s1-tokens`)
**Version**: connection-status delta (ADDED: 2 requirements / 5 scenarios)
**Mode**: Strict TDD (Vitest)
**Verdict**: PASS WITH WARNINGS — slice 2 is ready to open as PR2 targeting `feat/console-redesign-s1-tokens`.

### Completeness
| Metric | Value |
|--------|-------|
| Slice-2 tasks total | 5 (2.1-2.5) |
| Slice-2 tasks complete | 5 |
| Slice-2 tasks incomplete | 0 |
| Slices 3-5 | Not started — out of scope for this verification |

All of 2.1-2.5 are `[x]` in `tasks.md` and match code state:
- 2.1 RED: `connect.component.spec.ts` (rewrite), `status-pill.component.spec.ts` (new), `connect-dialog.component.spec.ts` (new) — present, passing.
- 2.2 GREEN: `frontend/libs/ui/dialog/` vendored (12 files) + `@spartan-ng/helm/dialog` path in `frontend/tsconfig.json` — present.
- 2.3 GREEN: `features/connect/` split into container (`ConnectComponent`) + `ConnectDialogComponent` / `StatusPillComponent`; `connectDialogOpen` signal; body switches on `connected()`; `changeBroker()` runs `disconnect()` on `/api/connections` and keeps the popup open — present.
- 2.4 GREEN: inert `[data-testid="broker-selector-slot"]` beside the pill — present.
- 2.5 REFACTOR: permanent connect column removed from `app.html`; `<app-connect />` moved into `<header>`; `<main>` grid is 2-track — confirmed.

### Build & Tests Execution
**Build**: PASS — `npm run build` (from `frontend/`), exit 0.
```text
Initial total | 628.09 kB | 149.84 kB
WARNING bundle initial exceeded maximum budget. Budget 500.00 kB was not met by 128.09 kB (total 628.09 kB).
Application bundle generation complete. [exit 0]
```
The +128 kB over budget is `@angular/cdk/overlay`, pulled in by the vendored dialog. Expected cost of design D3, not an app-code regression. Baseline slice-1 warning was ~500 kB.

**Tests**: PASS — `npm test -- --watch false` (from `frontend/`), exit 0.
```text
Test Files  13 passed (13)
     Tests  193 passed (193)
```
Was 11 files / 189 (slice-1 baseline). Net +4: `status-pill.component.spec.ts` +7, `connect-dialog.component.spec.ts` +6, `connect.component.spec.ts` net -9 (about 10 obsolete permanent-column characterization tests removed, 9 container tests retained/added).

**Coverage**: Not available — repo has no coverage tool configured; no e2e/integration harness (Vitest is the only runner, per design + tasks).

### Spec Compliance Matrix (connection-status delta)
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Connection UI Is a Load-Time Popup That Collapses to a Status Pill | Popup shows on load when not connected; no permanent column | `connect.component.spec.ts > auto-opens the connect popup on load while there is no broker connection` | COMPLIANT |
| " | Popup collapses to the status pill after connecting | `connect.component.spec.ts > dismisses the popup and sets the RabbitMQ accent after a successful connect` | COMPLIANT |
| " | Clicking the pill while connected offers disconnect and switch, not re-login | `connect.component.spec.ts > shows disconnect/switch controls and no credential fields once connected`; `connect-dialog.component.spec.ts > shows Desconectar and Cambiar broker with NO credential fields while connected` | COMPLIANT |
| " | Clicking the pill while disconnected re-opens the popup | `connect.component.spec.ts > re-opens the same popup when the status pill is activated`; `status-pill.component.spec.ts > emits activate when the pill is clicked` | COMPLIANT |
| Reserved Broker-Selector Slot | The slot is present but inert (no broker change, no request) | `connect.component.spec.ts > renders a reserved broker-selector slot beside the pill that is inert and non-focusable` | COMPLIANT |

**Compliance summary**: 5/5 scenarios compliant.

Bonus (behavior in the Engram spec artifact #153 but not in the authoritative delta file — see SUGGESTION S3): hub `reconnecting` renders inline in the pill — covered by `status-pill.component.spec.ts > renders the hub reconnecting state inline inside the pill, not as a separate banner`. COMPLIANT.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Load-time popup, one `connectDialogOpen` signal | Implemented | `connect.component.ts:44` signal starts `true`; `<hlm-dialog [state]>` bound in `connect.component.html`; auto-open verified. Matches D3. |
| Popup collapses to always-visible pill | Implemented | `StatusPillComponent` always rendered in `connect.component.html` (not conditional on state); `connect()` success sets `connectDialogOpen.set(false)`. |
| Pill reopens same dialog, state-agnostic | Implemented | `openConnectDialog()` sets the one signal; body switches on `connected()` in `connect-dialog.component.html`. |
| Connected body = Desconectar / Cambiar broker, never re-login | Implemented | `connect-dialog.component.html` `@if (!connected())` guards the 4-field form; connected branch has zero inputs. |
| "Cambiar broker" = disconnect then reconnect via `/api/connections`, no Kafka wiring | Implemented | `changeBroker()` -> `disconnect()` (DELETE `/api/connections`) + keeps popup open so the body reverts to the credentials form; tester re-submits `connect()`. No Kafka path. Matches D10 intent (see SUGGESTION S1 on literal wording). |
| Reserved slot: `aria-hidden`, non-focusable, no wiring | Implemented | `connect.component.html`: `aria-hidden="true"`, `tabindex="-1"`, `inert`, `pointer-events-none`; click triggers no HTTP (tested). |
| `BrokerAccentService` wiring (slice-1 handoff) | Implemented | `setBroker('rabbitmq')` on connect success (`connect.component.ts:62`); `setBroker(null)` in `settleDisconnect()` (`:84`), reached by both `disconnect()` and `changeBroker()`. Tested both directions. |
| Hub ownership unchanged | Implemented | Container reads `busHub.connectionState` read-only; never starts the hub (tested: `never starts the SignalR hub`). |
| Permanent connect column removed | Implemented | `app.html`: `<app-connect />` is in `<header>`; `<main>` grid is `lg:grid-cols-[minmax(320px,420px)_minmax(360px,1fr)]` — 2 tracks (`app-send`, `app-messages`). |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D3: vendored spartan `dialog`; `connectDialogOpen` auto-opens while `!connected()`; pill always in header; body switches on `connected()`; reserved slot `aria-hidden` non-focusable `[data-testid="broker-selector-slot"]` | Yes (1 documented sub-deviation) | Dialog vendored by hand from the CLI's own templates (`node_modules/@spartan-ng/cli/src/generators/ui/libs/dialog/files/**`) — the CLI generator is nx-only and cannot run in this plain Angular CLI project. Byte-compared all 12 files against the templates: identical except the documented `spartan-dialog-*` preset-class -> expanded-Tailwind substitution (same technique the existing vendored `button`/`card` libs use). Structure matches the other 10 `libs/ui/*` helm libs (`src/index.ts` + `src/lib/*.ts` + `HlmDialogImports` barrel). `frontend/tsconfig.json` has the `@spartan-ng/helm/dialog` path. |
| D3 sub-deviation: dialog title/description | Deviation (acceptable) | `connect-dialog.component.html` uses plain `<h2>` / `<p>` instead of `hlmDialogTitle` / `hlmDialogDescription`. Those directives inject `BrnDialogRef` and throw when the presentational child is rendered in isolation (its own spec). Overlay, backdrop, focus trap and the close button all still come from `HlmDialog` / `HlmDialogContent` / `HlmDialogOverlay` (which host `BrnDialog` / `BrnDialogOverlay`) in the container — verified in source. Functional impact: none. A11y impact: the dialog has no `aria-labelledby` / `aria-describedby` association with its heading. See WARNING W1. |
| D10: "Cambiar broker" = `disconnect()` then `connect()` against `/api/connections`, no Kafka wiring | Yes | Implemented as `disconnect()` + keep popup open; `connect()` fires on the tester's explicit re-submit rather than automatically. See SUGGESTION S1. |
| Strict TDD RED-GREEN per slice | Yes | `apply-progress.md` has the slice-2 TDD Cycle Evidence table; RED = compile failure (missing child components / signal), GREEN = 23 slice-2 tests. Test files exist and pass on re-run. |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | Slice-2 table in `apply-progress.md` + Engram #163 |
| All tasks have tests | Yes | 2.1-2.4 covered by the 3 spec files; 2.5 is a refactor covered by the full suite + `app.spec.ts` |
| RED confirmed (tests exist) | Yes | 3/3 slice-2 spec files present on disk |
| GREEN confirmed (tests pass) | Yes | 13 files / 193 tests pass on independent re-run |
| Triangulation adequate | Yes | e.g. `input` count 4 (disconnected) vs 0 (connected); accent `rabbitmq` vs `null`; tone `warn`/`ok`/`error`/`neutral` |
| Safety net for modified files | Yes | Slice-1 baseline suite (189) run before slice-2 edits; net +4 after |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (TestBed + jsdom, incl. CDK overlay) | ~22 slice-2 | 3 | Vitest 4.1.11 |
| Integration | 0 | 0 | not installed |
| E2E | 0 | 0 | not installed |
| Total (whole suite) | 193 | 13 | |

### Assertion Quality
Scanned `connect.component.spec.ts`, `connect-dialog.component.spec.ts`, `status-pill.component.spec.ts`.
- No tautologies, no ghost loops, no orphan empty-collection checks (the `querySelectorAll('input').length === 0` connected assertion has a companion `=== 4` disconnected assertion).
- Every assertion follows a production-code call (`connect()`, `changeBroker()`, `pill.click()`, `setInput`, form submit) or a real DOM/HTTP expectation (`httpMock.expectNone`, `expectOne`).
- Minor: a few assertions check token CSS classes (`className` contains `text-status-warn` / `text-status-ok`). These are semantic design tokens, consistent with the design's `data-*` + token-class contract strategy — not churn-prone utility strings. Not flagged.

**Assertion quality**: All assertions verify real behavior. 0 CRITICAL, 0 WARNING.

### Quality Metrics
**Linter**: Not run (no lint script wired into this verification; `ng build` AOT + strict TS compiled clean).
**Type Checker**: No errors — `ng build` and `ng test` both compile under strict TS with exit 0.

### Scope Leak Check (slices 3-5)
`git diff --stat 938e732..8acd4ff` (slice-2-only range) touches only: `frontend/libs/ui/dialog/**`, `frontend/src/app/features/connect/*`, `frontend/src/app/app.html`, `frontend/tsconfig.json`, and the SDD docs (`apply-progress.md`, `tasks.md`). No changes to `send-history.service`, `send.component`, `messages.component`, `queue-color`, `reply/*`, `reply-draft.service`, or `specs/ui-presentation`. No scope leak. Working tree is clean.

### Coverage-Parity Check (removed permanent-column tests)
The obsolete `connect.component.spec.ts` (-268 lines) characterized the removed always-visible connect column. Behavior that still matters migrated and is covered:
- credential form fields / `Conectar` submit -> `connect-dialog.component.spec.ts`
- connect POST `/api/connections` + success/error handling -> `connect.component.spec.ts`
- disconnect DELETE -> `connect.component.spec.ts`
- hub never started -> `connect.component.spec.ts`
- pill states / labels / hub-inline -> `status-pill.component.spec.ts`
Tests that only asserted the permanent-column layout are legitimately dead (that UI was removed by design). No real coverage loss.

### Issues Found
**CRITICAL**: None.

**WARNING**:
- W1 — Dialog heading not associated for a11y. `connect-dialog.component.html` uses plain `<h2>`/`<p>` instead of `hlmDialogTitle`/`hlmDialogDescription`, so the CDK dialog has no `aria-labelledby`/`aria-describedby`. Overlay/focus-trap/close-button are unaffected (they come from the container's `HlmDialog`/`HlmDialogContent`/`HlmDialogOverlay`). Documented and justified (the directives throw in isolated child specs). Not a spec break; recommend restoring labelling in a later slice via manual `aria-labelledby` or by hoisting the title into the container.
- W2 — Slice-2 changed-line ledger is ~1341 (926+/415-), over the 800 review budget. ACCEPTED as `size:exception` by the maintainer (objective reset). Inflation: 272 vendored dialog lib + the mandated task-2.1 RED spec rewrite (-268 obsolete permanent-column spec) + the mandated task-2.5 column deletion + ~109 lines of SDD progress docs. Net-new authored logic ~270. Recorded here as context only — not a blocker to PR2.

**SUGGESTION**:
- S1 — D10 literal wording vs implementation. D10 says "Cambiar broker = `disconnect()` then `connect()`". The implementation runs `disconnect()` and returns the tester to the credentials form to re-submit `connect()` explicitly, rather than auto-firing it. This is arguably better UX (the tester can change host/vhost) and stays within D10's "re-target of the same RabbitMQ flow" intent. Consider tightening the D10 text.
- S2 — No `App`-level test asserts "no permanent column". `app.spec.ts` only checks `app-connect` exists. The popup-vs-column behavior is verified at the component level and structurally in `app.html`. Consider an assertion that no connect form renders inline outside the overlay while disconnected.
- S3 — Spec artifact drift. Engram `sdd/console-redesign/spec` (#153) lists a 5th scenario for the popup requirement ("Hub `reconnecting` renders inline within the pill, not as a full-width banner") that is absent from the authoritative delta file `openspec/changes/console-redesign/specs/connection-status/spec.md`. The behavior is implemented and tested. Reconcile the delta file to include that scenario before archive.

### Verdict
**PASS WITH WARNINGS** — All 5 connection-status scenarios have passing covering tests; build and full suite green (13 files / 193 tests, exit 0); tasks 2.1-2.5 complete and consistent with code; no scope leak into slices 3-5. The two warnings (a11y labelling deviation W1, accepted size:exception W2) do not block. Slice 2 is ready to open as PR2 targeting `feat/console-redesign-s1-tokens`.
