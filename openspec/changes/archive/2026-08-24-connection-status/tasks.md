# Tasks: Connection Status & Reconnection Visibility

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250-300 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Ship `connectionState` on `BusHubService`, `pending`/hub-status on `ConnectComponent`, warn tokens | PR 1 | `npm test -- --watch=false` (frontend/) | N/A — no E2E runner configured in this repo; verified via Vitest unit specs and manual smoke (5.2) | Fully additive; revert the single PR removes all 8 file changes cleanly, no shared state to unwind. See "Budget Note" below — cumulative diff now exceeds the 400-line guard and needs a delivery-strategy decision before archive/PR. |

## Phase 1: Foundation — Shared Test Double

- [x] 1.1 Create `frontend/src/app/core/testing/fake-hub-connection.ts`: move `FakeHubConnection` out of `bus-hub.service.spec.ts`, keep existing `on/start/invoke/emit`, add `onreconnecting`/`onreconnected`/`onclose` registration plus `triggerReconnecting()`/`triggerReconnected()`/`triggerClose()`.
- [x] 1.2 Update `frontend/src/app/core/bus-hub.service.spec.ts`: import the shared fake instead of the inline class; confirm existing 8 tests stay green (no behavior change).

## Phase 2: `BusHubService.connectionState` (TDD)

- [x] 2.1 RED — `bus-hub.service.spec.ts`: add failing test — `connectionState()` starts `'idle'` (spec: "State is read-only to consumers" baseline).
- [x] 2.2 RED — add failing test — `start()` sets `connectionState` `'connecting'` while in flight, then `'connected'` on resolve (spec: "Initial start reflects connecting then connected").
- [x] 2.3 RED — add failing test — rejected `start()` sets `connectionState` `'disconnected'` and still rethrows.
- [x] 2.4 RED — add failing tests — `triggerReconnecting()` → `'reconnecting'`; `triggerReconnected()` → `'connected'`; `triggerClose()` → `'disconnected'` (spec: onreconnecting/onreconnected/onclose scenarios).
- [x] 2.5 GREEN — modify `frontend/src/app/core/bus-hub.service.ts`: add `export type HubConnectionState = 'idle'|'connecting'|'connected'|'reconnecting'|'disconnected'`, private signal + `readonly connectionState = ...asReadonly()`; wire `connection.onreconnecting/onreconnected/onclose` in the constructor; update `start()` to set `connecting` before the underlying call, `connected` on resolve, `disconnected` + rethrow on reject.
- [x] 2.6 REFACTOR — run `npm test -- --watch=false` (frontend/); confirm no public setter exists on `connectionState` (spec: "State is read-only to consumers").

## Phase 3: `ConnectComponent` Pending + Hub Status (TDD)

- [x] 3.1 RED — `connect.component.spec.ts`: provide `BUS_HUB_CONNECTION` with the shared fake; add failing test — Connect button `[disabled]` while POST pending, re-enabled after flush (spec: "Connect button disables during connecting").
- [x] 3.2 RED — add failing test — Disconnect button `[disabled]` while DELETE pending, re-enabled after flush (spec: "Disconnect button disables during disconnecting").
- [x] 3.3 RED — add failing test — `pending` clears on both success and error settlement for connect and disconnect (spec: "Pending state clears on settlement").
- [x] 3.4 RED — add failing test — hub status hidden while `connectionState()` is `'idle'`.
- [x] 3.5 RED — add failing test — hub status renders once `connectionState()` leaves idle, independent of `connected()` (spec: "Hub status renders once MessagesComponent has started it").
- [x] 3.6 RED — add failing test — `reconnecting` renders inline next to broker status, no persistent banner, using warn classes (spec: "Reconnecting renders inline, not as a banner").
- [x] 3.7 GREEN — modify `frontend/src/app/features/connect/connect.component.ts`: inject `BusHubService`; add `pending` signal (true before POST/DELETE, false in both `next`/`error`); add `hubConnectionState = busHub.connectionState`, `hubStatusLabel`/`hubStatusClasses` computed signals (null while idle).
- [x] 3.8 GREEN — modify `frontend/src/app/features/connect/connect.component.html`: add `|| pending()` to all `[disabled]` bindings (6 total: 4 inputs + 2 buttons — this task originally said "four"; actual template has 6 disable bindings, applied to all 6 for consistent lock-during-request behavior, a superset of the spec's button-only requirement); add combined status region rendering broker (`connected()`/`pending()`/`errorMessage()`) and hub (`hubStatusLabel()`/`hubStatusClasses()`) as separately labeled, distinguishable elements (`data-testid="broker-status"`/`"hub-status"`), hub inline (no banner) — both siblings inside one shared flex container.
- [x] 3.9 REFACTOR — ran `npm test -- --watch=false`; confirmed the 3 pre-existing `ConnectComponent` tests (submit/error/disconnect) still pass unchanged.

## Phase 4: Design Tokens

- [x] 4.1 Modify `frontend/src/styles.css`: add `--color-status-warn`/`--color-status-warn-bg` to `@theme` (light) and `.dark`, following the existing `--color-status-ok`/`--color-status-error` pattern.
- [x] 4.2 Confirmed 3.8's warn-state markup uses `bg-status-warn-bg`/`text-status-warn` Tailwind utility classes (auto-generated from the new tokens), matching existing `status-ok`/`status-error` naming (spec: "Warn tokens render in both themes").

## Phase 5: Verification

- [x] 5.1 Ran `npm test -- --watch=false` from `frontend/`; 63/63 tests pass (50 baseline + 12 from the first apply batch + 1 runtime ownership test added in the follow-up batch below).
- [x] 5.2 Manual smoke: no E2E/browser runtime available in this environment; substituted with grep-verified structural proof (see 5.3) plus unit coverage of `MessagesComponent`'s sole `start()` ownership and `ConnectComponent`'s independent `connectionState()` rendering (test: "renders hub status once connectionState leaves idle, independent of the broker connected() state").
- [x] 5.3 Runtime-verified `ConnectComponent` never calls `busHub.start()`/`stop()` — `connect.component.spec.ts`: "never calls BusHubService.start() — hub connection ownership stays with MessagesComponent" asserts `fakeHubConnection.started` is `false` after rendering `ConnectComponent` standalone (`fixture.detectChanges()`), added in the follow-up batch requested by `sdd-verify` (Engram id 100) to replace the original grep-only evidence with a passing runtime test. Grep-verified zero `busHub.start()`/`stop()` matches in `frontend/src/app/features/connect/`; sole caller in the whole app is `frontend/src/app/features/messages/messages.component.ts:90` (spec: "ConnectComponent never starts the hub").

## Phase 6: Re-verify Remediation (Batch 3 — closes 3 CRITICAL findings from re-verify, Engram id 100)

- [x] 6.1 RED then GREEN — `connect.component.spec.ts`: added failing test "renders the broker 'Connected' copy as a last-known snapshot, never implying live continuity" (connection-status spec: "Broker state never implies live continuity"); confirmed RED (`expected 'connected' to contain 'last known'`); GREEN via `connect.component.html` copy change `Connected` → `Connected (last known)` in the `@else if (connected())` branch.
- [x] 6.2 Characterization test (already-GREEN) — `connect.component.spec.ts`: added "renders the broker pending status with the warn token class" and "renders the hub reconnecting status with the warn token class" (ui-presentation delta spec: "Pending/reconnecting status uses the warn token"); both asserted `className` contains `text-status-warn`/`bg-status-warn-bg` and passed immediately — the implementation (`STATUS_WARN_CLASSES`/`HUB_STATUS_CLASSES`) was already correct from batch 1, only the runtime proof was missing.
- [x] 6.3 Documented, no code change — spec scenario "Warn tokens render in both themes" (ui-presentation delta) accepted as a scope exception: no theme-toggle/CSS-render test harness exists in this repo (jsdom cannot resolve `oklch()` values); this gap is pre-existing for the `ok`/`error` tokens too, not introduced by this change. User-approved 2026-08-24. To be carried into the final verify-report/archive-report as an accepted, documented limitation, not silently dropped.
- [x] 6.4 Ran `npm test -- --watch=false` (frontend/) — full suite 66/66 passed (63 → 66, +3). Ran `npm run build` — exit 0, unchanged bundle size profile.

### Status: 25/25 original tasks + 1 batch-2 remediation + 4 batch-3 remediation sub-tasks complete. 2/3 remaining CRITICAL findings closed with runtime tests; 1/3 documented as an accepted scope exception. Ready for re-verify.

## Budget Note (flag for delivery-strategy decision before archive/PR)

Cumulative diff as of end of batch 3: 7 tracked files `+333/-47` (`git diff --numstat HEAD -- frontend/`) plus 1 untracked file (`frontend/src/app/core/testing/fake-hub-connection.ts`, 64 lines, all additions) = **8 files, 444 total changed lines** — this now EXCEEDS the 400-line review budget (was 392-394 as of the prior verify pass, before this batch's 3 new tests added ~50 lines to `connect.component.spec.ts`). Delivery strategy was `ask-on-risk`/single-PR at Medium risk; this batch was executed as directed, explicit, scoped remediation of verify CRITICAL findings (2 tests) plus a documented exception (no code) — not a fresh scope expansion — but the total now needs an explicit size:exception or split decision before merge/archive, since it crosses the stated threshold. Composition: the excess is entirely test code (191 of 333 tracked insertions are in `connect.component.spec.ts`), which is lower review risk than production code, but the guard counts authored test additions in full per `sdd-phase-common.md` Section E (only generated goldens are excluded).
