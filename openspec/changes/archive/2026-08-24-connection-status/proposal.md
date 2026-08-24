# Proposal: Connection Status & Reconnection Visibility

## Intent

Today `ConnectComponent` shows only a boolean `connected`/error state for the broker REST call, with no in-flight "connecting" feedback, and it has zero visibility into the SignalR hub socket (`BusHubService`) even though the hub already configures `.withAutomaticReconnect()` but never surfaces `onreconnecting`/`onreconnected`/`onclose` anywhere. A developer testing message flows currently has no way to tell that the live feed silently dropped and is retrying versus genuinely working — this is the explicit deferred backlog item "Live connection-status indicator/reconnection banner" from `2026-08-18-frontend-design-system`. This change closes that gap.

## Scope

### In Scope
- `BusHubService` exposes a read-only hub connection-state signal (idle/connecting/connected/reconnecting/disconnected), wired from `onreconnecting`/`onreconnected`/`onclose` and the initial `start()` outcome.
- `ConnectComponent` gains an explicit "connecting" pending state around the broker POST/DELETE, replacing the current synchronous-looking button state.
- `ConnectComponent` observes (does not start) hub connection state and renders a combined status affordance distinguishing broker state (episodic, last-known) from hub state (live).
- New `--color-status-warn`/`--color-status-warn-bg` design tokens (light + dark) in `frontend/src/styles.css`, following the existing ok/error pattern.
- Test coverage: `bus-hub.service.spec.ts` (fake `HubConnection` state transitions) and `connect.component.spec.ts` (pending/reconnecting rendering).

### Out of Scope
- Any backend change (no health-check/polling endpoint for broker liveness) — broker state remains a snapshot of the last REST response, never implied continuous.
- Changing which component calls `BusHubService.start()` — `MessagesComponent` keeps sole ownership; `ConnectComponent` only reads state, avoiding a double-start race.
- A shared `ConnectionStatusService`/state-machine layer spanning multiple components (YAGNI, no second consumer today).
- Persisting connection status across reload/restart (violates session-only invariant).

## Capabilities

### New Capabilities
- `connection-status`: SignalR hub connection-state observability (connecting/connected/reconnecting/disconnected) exposed from `BusHubService`, plus an explicit broker "connecting" pending state during in-flight connect/disconnect, rendered as a combined status affordance in `ConnectComponent`.

### Modified Capabilities
- `ui-presentation`: "Status Messages Are Visually Differentiated" extends from a 2-state (ok/error) to a 3-state model, adding a pending/reconnecting "warn" token pair.

## Approach

Extend `BusHubService` (already `providedIn: 'root'`) with a `connectionState` signal wired to native SignalR lifecycle events — additive only, no new DI surface. `ConnectComponent` injects it read-only. Keep `MessagesComponent` as the sole `start()` caller to avoid ownership conflicts. Follow existing template-driven/signal idioms; no new architectural layer.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/core/bus-hub.service.ts` (+ spec) | Modified | Add `connectionState` signal, wire reconnect/close handlers |
| `frontend/src/app/features/connect/connect.component.ts` (+ .html, + spec) | Modified | Pending state for broker call, observe hub state, combined status render |
| `frontend/src/styles.css` | Modified | Add `--color-status-warn`/`-bg` tokens (light+dark) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double-start race between `ConnectComponent` and `MessagesComponent` | Low | `ConnectComponent` never calls `start()`, only reads signal |
| UI implies broker liveness beyond last response | Med | Explicit "Broker: last known" vs "Live feed: <hub state>" copy distinction |

## Rollback Plan

Revert the three touched files; no backend/data changes, no migrations, no persisted state to unwind.

## Dependencies

None — reuses existing `.withAutomaticReconnect()` and design-token conventions.

## Success Criteria

- [ ] Broker connect shows a visible "connecting" state during the in-flight request
- [ ] Hub reconnect/close is visible in `ConnectComponent` without a new `start()` call site
- [ ] New warn tokens render correctly in light and dark themes
- [ ] No claim of continuous broker liveness beyond the last REST response

## Proposal question round

Since interactive confirmation wasn't available in this executor turn, these are open product questions for user review before spec/design lock-in (answer, skip, or reframe):

1. **Business rule**: Should the "connecting" broker state disable the Connect button / block duplicate submits, or just be informational?
2. **Product outcome**: Should hub "reconnecting" show a persistent banner, or only inline next to the broker status (lower visual weight)?
3. **Edge case**: If the hub is reconnecting but the broker was never connected (or was disconnected), should the hub status still render, or stay hidden until broker connects?
4. **Scope boundary**: Is disconnect's UX (no pending state today, per explore) also expected to get a "disconnecting" pending state in this change, or is that explicitly deferred?

**User answers (confirmed 2026-08-24)**:
1. Connect button disables during the "connecting" pending state (prevents duplicate submits).
2. Hub "reconnecting" renders inline next to broker status, not as a persistent banner.
3. Hub status always renders once `MessagesComponent` starts it, independent of broker state.
4. Disconnect gets the same pending-state treatment as connect, for consistency.
