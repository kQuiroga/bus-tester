# Proposal: Multi-Subscription Chips with Live Counters

## Intent

Today `MessagesComponent` allows exactly one active queue subscription: the Subscribe button disables once a subscription exists, forcing a developer to unsubscribe before trying another queue. This blocks a core testing workflow — comparing traffic across multiple queues side by side — even though the backend already supports unlimited concurrent subscriptions per session with zero changes needed. This was explicitly deferred backlog item #4 ("Multi-subscription chips/counters") from the original frontend-design-system change. Implementing it now closes the last deferred item and makes multi-queue testing possible for the first time.

## Scope

### In Scope
- Replace the single `subscriptionId` signal with a list of active subscriptions (`{id, queueName}`), one chip per subscription, each with its own inline unsubscribe control.
- Live per-chip message counter, derived from `busHub.messages()` filtered by that chip's `id` (no backend change; count is a computed/derived signal).
- Fix `finishUnsubscribe()` to scope `busHub.clear()`-equivalent behavior to only the removed subscription's messages, not the entire message list (pre-existing bug that breaks multi-subscription correctness).
- Chip row responsive wrap down to ~375px, reusing the existing `flex flex-wrap items-center gap-2` pattern from the connect-status area.
- Update `messages.component.spec.ts` to cover multi-subscription flows (currently assumes single `sub-1` id).

### Out of Scope
- Backend changes (none required; `SubscriptionCoordinator`/`BusHub` already support N concurrent subscriptions).
- Persisting subscriptions/chip labels across page reload (consistent with existing session-only pattern).
- Any change to `ConnectComponent` or the `start()`/`stop()` hub-lifecycle ownership boundary established by connection-status.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `message-consumption`: "Subscribe and Receive Live Messages" requirement changes from implicit single-active-subscription to explicit multi-subscription semantics, including scoped-clear-on-unsubscribe behavior.
- `ui-presentation`: new/modified requirement for chip-row rendering, per-chip counters, and responsive wrap at ~375px (extends "Live Message Feed Renders Rows With a Scroll Cap" area).

## Approach

Move subscription state in `MessagesComponent` from a single `signal<string|null>` to a `signal<{id, queueName}[]>`. Subscribe appends a new entry (after POST + `joinSubscription`); unsubscribe removes one entry by id (after DELETE + `leaveSubscription`) and scopes any message-clearing to that id only. `visibleMessages`/per-chip counts filter `busHub.messages()` by subscription id — a cheap derived computation, no `BusHubService` API change required. Chip labels are client-tracked only (the wire `ReceivedMessage` DTO has no `queueName`), consistent with existing behavior.

## Proposal question round

**User answers (confirmed 2026-08-25)**:
1. **Duplicate queues**: not allowed — Subscribe is disabled/blocked for a `queueName` already active among current chips.
2. **Chip cap**: no hard cap for this slice; wrap/scroll absorbs overflow.
3. **Wrap/scroll at ~375px**: wrap (not horizontal scroll), reusing the existing connect-status flex-wrap pattern.
4. **Unhandled-promise fire-and-forget on `joinSubscription`/`leaveSubscription`**: fix now (add `.catch()` handling) as part of this change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/features/messages/messages.component.ts` | Modified | Multi-subscription state, chip add/remove, scoped clear, per-chip counts |
| `frontend/src/app/features/messages/messages.component.html` | Modified | Chip row UI |
| `frontend/src/app/features/messages/messages.component.spec.ts` | Modified | Multi-subscription test coverage |
| `frontend/src/app/core/bus-hub.service.ts` | Possibly Modified | Only if join/leave error handling is fixed in this change |
| `frontend/src/styles.css` | Modified | New chip-specific classes from existing tokens |
| `openspec/specs/message-consumption/spec.md` | Modified | Multi-subscription requirement delta |
| `openspec/specs/ui-presentation/spec.md` | Modified | Chip rendering/responsive requirement delta |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rebase/regression against just-merged connection-status changes in `bus-hub.service.ts`/spec/`styles.css` | Medium | Re-run full `bus-hub.service.spec.ts` suite; read current file state before editing (done) |
| Scoped-clear bug reintroduced or mis-scoped | Medium | Explicit spec scenario + unit test for "unsubscribe one chip leaves other chips' messages intact" |
| First chip/badge UI pattern in codebase — no reuse | Low | Compose from existing tokens only, no new library |

## Rollback Plan

Frontend-only, no backend/schema/migration involved. Revert the `MessagesComponent`/template/spec/`styles.css` commit(s); no data migration or backend rollback needed.

## Dependencies

None (backend already supports required behavior).

## Success Criteria

- [ ] A developer can subscribe to 2+ queues simultaneously, each rendered as its own chip.
- [ ] Each chip shows a live count of messages received for that subscription only.
- [ ] Unsubscribing one chip removes only that chip's messages from the feed and `BusHubService` state.
- [ ] Chip row remains usable (wraps, no clipping) down to ~375px viewport width.
- [ ] `bus-hub.service.spec.ts` and `messages.component.spec.ts` pass with multi-subscription coverage.
