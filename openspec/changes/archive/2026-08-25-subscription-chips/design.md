# Design: Multi-Subscription Chips with Live Counters

## Technical Approach

`MessagesComponent` moves subscription state from `signal<string | null>` to `signal<Subscription[]>`. Each successful POST `/api/subscriptions` + `joinSubscription()` appends a `{id, queueName}` entry; each unsubscribe removes one entry by `id` after DELETE + `leaveSubscription()`. The message feed (`visibleMessages`) filters `busHub.messages()` by the set of active subscription ids instead of a single id, so it aggregates traffic across all active chips. A separate `computed` derives per-chip live counts from the same `busHub.messages()` signal — no new BusHubService read API. The pre-existing full-wipe bug is fixed by replacing `BusHubService.clear()` with `clearSubscription(id)`, so unsubscribing one chip only removes that chip's messages from the shared store. `joinSubscription`/`leaveSubscription` calls get a `.catch()` at the call site that sets `errorMessage`, surfacing the failure in the existing status area — reusing `ConnectComponent`'s established `errorMessage: signal<string | null>` pattern rather than the silent `start().catch(() => {})` convention, per explicit user decision (2026-08-25): a silent join failure would leave a chip rendered as subscribed while receiving no messages, which is more confusing than a visible error.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Scoped clear-on-unsubscribe | Rename `BusHubService.clear()` → `clearSubscription(id)`, filtering `_messages` by id | Keep `clear()` full-wipe and filter only in the component's `visibleMessages` view | Success criteria requires messages removed from BusHubService state itself, not just hidden from the view; the array is the single source of truth so the fix belongs there. `clear()` had no other callers. |
| Duplicate-queue guard | `isDuplicateQueue` computed (`Set<queueName>` membership) drives both `[disabled]` on Subscribe and an early-return guard inside `subscribeToQueue()` | UI-only disable (template-level) | Defense-in-depth: the method can be called directly (as tests already do), so template-only disabling isn't sufficient. |
| Join/leave error handling | `.catch((err) => this.errorMessage.set(...))` at each call site in `messages.component.ts`, reusing the existing `errorMessage` signal/status-area rendering | Silent `.catch(() => {})` matching `start()`'s convention | User decision (2026-08-25): a silent join failure leaves a chip rendered as subscribed while receiving no messages — more confusing than a visible error. Reuses the already-rendered `errorMessage` status area, no new UI element. Keeps `BusHubService`'s public promise-returning contract unchanged for other/future callers and tests. |
| Chip visual style | Compose `rounded-full` pill from existing tokens only: `border-border`, `bg-card`, `text-card-foreground`; count badge `bg-primary/10 text-primary`; unsubscribe control hover uses `text-status-error` | Add new `--color-secondary`/`--color-muted` tokens | `styles.css` has no secondary/muted tokens today (verified); adding tokens for one component is out of scope and risks inconsistency. Opacity modifiers (`/10`) on existing tokens avoid new theme additions. |
| Feed scope with multiple subs | `visibleMessages` filters by `Set` of all active subscription ids (combined feed) | Per-chip separate feeds/tabs | Matches proposal intent ("compare traffic across multiple queues") and keeps one feed list + pause/search/highlight logic unchanged. |

## Data Flow

    Subscribe form ──POST /api/subscriptions──▶ API
         │                                        │
         │◀──────────── {id} ─────────────────────┘
         ▼
    subscriptions.update(add {id, queueName}) ──▶ busHub.joinSubscription(id).catch(err => errorMessage.set(...))
         │
         ▼
    chipCounts = computed(subscriptions × busHub.messages() grouped by id)
    visibleMessages = computed(busHub.messages() filtered by active ids)  ──▶ feed/search/pause pipeline (unchanged)

    Chip [×] ──DELETE /api/subscriptions/:id──▶ API
         ▼
    finishUnsubscribe(id): busHub.leaveSubscription(id).catch(err => errorMessage.set(...))
                            busHub.clearSubscription(id)   // scoped, not full wipe
                            subscriptions.update(remove id)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/core/bus-hub.service.ts` | Modify | Replace `clear()` with `clearSubscription(subscriptionId: string): void` (filters `_messages` by id) |
| `frontend/src/app/core/bus-hub.service.spec.ts` | Modify | Replace `'clear() resets the messages signal'` with `clearSubscription()` scoped-removal + sibling-preserved tests |
| `frontend/src/app/features/messages/messages.component.ts` | Modify | `subscriptions` signal, `chipCounts`/`visibleMessages` computed, `isDuplicateQueue`, per-id `unsubscribe(id)`, join/leave `.catch()` reusing the existing `errorMessage` signal |
| `frontend/src/app/features/messages/messages.component.html` | Modify | Chip row (`flex flex-wrap items-center gap-2`), remove single-sub input/button disabling and the old global Unsubscribe button |
| `frontend/src/app/features/messages/messages.component.spec.ts` | Modify | Multi-subscription flows, duplicate-block test, scoped-clear-on-unsubscribe test |

## Interfaces / Contracts

```typescript
// messages.component.ts
interface Subscription { id: string; queueName: string }

readonly subscriptions = signal<Subscription[]>([]);
// errorMessage already exists (used today for the "Invalid queue" POST-failure scenario);
// join/leave .catch() reuses this same signal, no new signal or status element added.
readonly isDuplicateQueue = computed(() =>
  this.subscriptions().some((s) => s.queueName === this.queueName()));

readonly chipCounts = computed(() => {
  const msgs = this.busHub.messages();
  return this.subscriptions().map((s) => ({
    id: s.id,
    queueName: s.queueName,
    count: msgs.filter((m) => m.subscriptionId === s.id).length,
  }));
});

readonly visibleMessages = computed(() => {
  const ids = new Set(this.subscriptions().map((s) => s.id));
  return this.busHub.messages().filter((m) => ids.has(m.subscriptionId));
});

subscribeToQueue(): void; // early-returns if isDuplicateQueue()
unsubscribe(id: string): void;
private finishUnsubscribe(id: string): void;

// bus-hub.service.ts
clearSubscription(subscriptionId: string): void; // replaces clear()
```

Chip row template (per chip): pill with `{{ chip.queueName }}`, count badge `{{ chip.count }}`, and an unsubscribe `<button (click)="unsubscribe(chip.id)">` with `aria-label="Unsubscribe from {{ chip.queueName }}"`. Row wrapper: `flex flex-wrap items-center gap-2`, matching `connect.component.html`'s existing status-row pattern. Subscribe button gains `[disabled]="isDuplicateQueue()"`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (bus-hub.service.spec.ts) | `clearSubscription(id)` removes only that id's messages, leaves others | Emit messages for two ids, call `clearSubscription`, assert remaining array |
| Unit (messages.component.spec.ts) | Two concurrent subscriptions render two chips; feed shows both; duplicate queueName blocks Subscribe; unsubscribing one chip removes only its messages/chip and calls `leaveSubscription`+`clearSubscription` with that id; join/leave rejection sets `errorMessage` and renders in the status area, no unhandled rejection | Fake `BusHubService` with `clearSubscription` spy; reject `joinSubscription`/`leaveSubscription` mocks once and assert `errorMessage()`/rendered status text, not just that `.catch()` was reached |
| Integration | N/A — no cross-service integration surface changes beyond the unit boundaries above | — |
| E2E | N/A — out of scope for this frontend-only slice per proposal | — |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Frontend-only, no persisted/schema changes; revert is a straight commit revert per proposal's rollback plan.

## Open Questions

None — all ambiguities from the proposal's question round were resolved (no duplicate queueName chips, no hard cap, wrap not scroll, join/leave `.catch()` fix in scope). One spec/design drift surfaced during review — the initial design draft used a silent `.catch(() => {})` for join/leave, but the spec's "Failures Are Handled Without Unhandled Rejections" requirement demands UI status reflection; resolved by explicit user decision (2026-08-25) in favor of visible errors, and this design was corrected to match before tasks.
