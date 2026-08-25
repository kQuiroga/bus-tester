# Design: Connection Status & Reconnection Visibility

## Technical Approach

Extend the existing `BusHubService` (already `providedIn: 'root'`) with a read-only `connectionState` signal wired to native SignalR lifecycle callbacks (`onreconnecting`/`onreconnected`/`onclose`) plus the `start()` outcome. `ConnectComponent` injects `BusHubService` read-only — it never calls `start()`, preserving `MessagesComponent` as the sole owner. `ConnectComponent` also gains a local `pending` signal wrapping its own POST/DELETE calls. Both signals drive one combined status region in `connect.component.html`, distinguishing broker (episodic, last-known) from hub (live) framing, using a new `warn` design-token pair. No backend change, no new service, no persistence — matches the proposal's explicit boundaries.

## Architecture Decisions

### Decision: Single boolean `pending` signal covers both connect and disconnect

**Choice**: One `pending: WritableSignal<boolean>` in `ConnectComponent`, set `true` before the POST/DELETE call and `false` in both `next`/`error` callbacks. Which action is pending is derived, not stored: `connected()` is still its pre-call value while `pending()` is true, so `pending() && !connected()` means "connecting" and `pending() && connected()` means "disconnecting".
**Alternatives considered**: A `pendingAction: 'connect' | 'disconnect' | null` signal.
**Rationale**: `connected()` already unambiguously encodes which action is in flight (a connect can only start when `!connected()`, a disconnect only when `connected()`); a second piece of state would duplicate that fact. Also naturally reuses the existing `[disabled]="connected()"` / `[disabled]="!connected()"` bindings — adding `|| pending()` to each is the only template change needed.

### Decision: Hub status hidden while `connectionState() === 'idle'`, always visible once non-idle

**Choice**: `ConnectComponent` renders the hub status line only when `busHub.connectionState() !== 'idle'`. Once `MessagesComponent` calls `start()`, the signal leaves `idle` permanently (it only ever moves among connecting/connected/reconnecting/disconnected afterward), so the hub line then renders unconditionally — independent of `connected()` (broker state), per confirmed decision #3.
**Alternatives considered**: Always render a hub status line, showing "Live feed: not started" when idle.
**Rationale**: Proposal's out-of-scope explicitly avoids implying the hub exists as a concept before any component starts it; showing "not started" for a subsystem the user never triggered is more confusing than absent.

### Decision: `connectionState` values and transition ownership live entirely in `BusHubService`

**Choice**: `type HubConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'`. `start()` sets `connecting` before calling the underlying `connection.start()`, then `connected` on resolve or `disconnected` on reject (rethrowing, preserving today's rejection contract for `MessagesComponent`'s `.catch(() => {})`). `onreconnecting` → `reconnecting`; `onreconnected` → `connected`; `onclose` → `disconnected`.
**Alternatives considered**: A separate `ConnectionStatusService` computing state from raw hub events.
**Rationale**: Explicitly rejected in the proposal (YAGNI — one consumer). Keeping state inside `BusHubService` is additive to its existing `providedIn: 'root'` surface, no new DI token.

### Decision: Extract `FakeHubConnection` into a shared test helper

**Choice**: Move the `FakeHubConnection` class out of `bus-hub.service.spec.ts` into `frontend/src/app/core/testing/fake-hub-connection.ts`, extended with `onreconnecting`/`onreconnected`/`onclose` registration plus `triggerReconnecting()`/`triggerReconnected()`/`triggerClose()` helpers. Both `bus-hub.service.spec.ts` and the new `connect.component.spec.ts` cases import it.
**Alternatives considered**: Duplicate a second fake in `connect.component.spec.ts`.
**Rationale**: `ConnectComponent` now transitively depends on `BUS_HUB_CONNECTION` (via injecting `BusHubService`), so its spec needs the same fake surface. Duplicating risks drift between the two fakes' event-handling behavior.

## Data Flow

    MessagesComponent.subscribeToQueue()
            │ busHub.start()
            ▼
    BusHubService.connectionState  ──(signal)──►  ConnectComponent (read-only)
            ▲                                            │
    onreconnecting/onreconnected/onclose                 ▼
    (native SignalR HubConnection)              combined status template
                                                  (broker: pending()/connected()/errorMessage()
                                                   + hub: connectionState())

    ConnectComponent.connect()/disconnect()
            │ api.post/delete('/api/connections')
            ▼
    pending signal ──► button [disabled], status label

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/core/bus-hub.service.ts` | Modify | Add `HubConnectionState` type, `connectionState` signal, wire `onreconnecting`/`onreconnected`/`onclose`, update `start()` to set `connecting`/`connected`/`disconnected` |
| `frontend/src/app/core/testing/fake-hub-connection.ts` | Create | Shared `FakeHubConnection` test double with reconnect/close trigger methods |
| `frontend/src/app/core/bus-hub.service.spec.ts` | Modify | Import shared fake; add `connectionState` transition tests |
| `frontend/src/app/features/connect/connect.component.ts` | Modify | Inject `BusHubService`, add `pending` signal, derive hub status label/tone |
| `frontend/src/app/features/connect/connect.component.html` | Modify | `[disabled]` += `pending()`; combined status region (broker + hub) |
| `frontend/src/app/features/connect/connect.component.spec.ts` | Modify | Provide `BUS_HUB_CONNECTION` fake; pending/reconnecting rendering tests |
| `frontend/src/styles.css` | Modify | Add `--color-status-warn`/`--color-status-warn-bg` (light + dark) |

## Interfaces / Contracts

```typescript
// bus-hub.service.ts
export type HubConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export class BusHubService {
  readonly connectionState: Signal<HubConnectionState>; // asReadonly()
  start(): Promise<void>; // unchanged signature, now also drives connectionState
}

// connect.component.ts
export class ConnectComponent {
  readonly pending: Signal<boolean>; // asReadonly()
  readonly hubConnectionState: Signal<HubConnectionState>; // = busHub.connectionState
  readonly hubStatusLabel: Signal<string | null>;   // null while idle
  readonly hubStatusClasses: Signal<string>;         // token class pair per tone
}
```

Token additions (`styles.css`, following the `ok`/`error` pattern exactly):

```css
/* @theme */
--color-status-warn: oklch(47% 0.13 70);
--color-status-warn-bg: oklch(97% 0.06 85);
/* .dark */
--color-status-warn: oklch(85% 0.15 85);
--color-status-warn-bg: oklch(30% 0.06 70);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit — `bus-hub.service.spec.ts` | `connectionState` starts `idle`; `start()` → `connecting` then `connected`; `start()` rejection → `disconnected` (rethrows); `onreconnecting`/`onreconnected`/`onclose` transitions | Shared `FakeHubConnection` with `on*`/`trigger*` methods; assert signal value pre/post-await |
| Unit — `connect.component.spec.ts` | Connect/disconnect button disables while `pending()`; error path clears `pending()`; hub status hidden while idle; hub status renders once non-idle, independent of `connected()` | `TestBed` with `provideHttpClientTesting()` + `BUS_HUB_CONNECTION` fake override; assert both component signals and rendered DOM text/class |
| Integration | None planned — no cross-service boundary beyond existing DI | N/A |
| E2E | None planned — out of scope, no test runner configured for E2E in this repo | N/A |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Purely additive signals/tokens; no persisted state, no backend contract change.

## Open Questions

None — all four proposal questions were confirmed by the user before this phase.
