# Tasks: Multi-Subscription Chips with Live Counters

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300-350 (PR1 ~50-70, PR2 ~230-280) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (BusHubService scoped clear) -> PR 2 (component multi-chip UI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Resolved — stacked-to-main, PR1 = Phase 1 (this batch)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Fix full-wipe bug: `BusHubService.clearSubscription(id)` scoped removal | PR 1 | `npm test -- bus-hub.service.spec.ts` (frontend/) | N/A — pure signal unit logic, no live hub needed | Revert `bus-hub.service.ts`, `bus-hub.service.spec.ts`, and the 1-line call-site update in `messages.component.ts`; single-sub behavior unaffected |
| 2 | Multi-subscription chips: model, duplicate guard, error surfacing, scoped unsubscribe wiring | PR 2 | `npm test -- messages.component.spec.ts` | Manual dev-server smoke (`ng serve` + backend, subscribe 2 queues) — no automated E2E harness exists per design | Revert `messages.component.ts/.html/.spec.ts` only; PR 1's scoped-clear fix stays on main |

## Phase 1: Scoped Unsubscribe Fix (PR 1)

- [x] 1.1 RED `bus-hub.service.spec.ts`: add `clearSubscription(id)` removes only that id's messages + sibling-preserved test; drop old `'clear() resets the messages signal'` test
- [x] 1.2 GREEN `bus-hub.service.ts`: rename `clear()` -> `clearSubscription(subscriptionId: string): void`, filtering `_messages` to exclude that id
- [x] 1.3 `messages.component.ts`: update `finishUnsubscribe` call site `busHub.clear()` -> `busHub.clearSubscription(subscriptionId)` (single-sub behavior preserved)
- [x] 1.4 Run `npm test -- bus-hub.service.spec.ts`, confirm green

## Phase 2: Subscription Model + Chip Rendering (PR 2)

- [ ] 2.1 RED `messages.component.spec.ts`: two concurrent subscriptions render two chips, feed shows both messages (spec: "Multiple concurrent subscriptions each receive their own messages")
- [ ] 2.2 RED `messages.component.spec.ts`: chip counter reflects only that subscription's messages
- [ ] 2.3 GREEN `messages.component.ts`: add `Subscription {id, queueName}` interface, `subscriptions = signal<Subscription[]>([])`, `chipCounts` computed, update `visibleMessages` to filter by Set of active ids
- [ ] 2.4 GREEN `messages.component.html`: chip row (`flex flex-wrap items-center gap-2`), per-chip pill + count badge + unsubscribe button with `aria-label="Unsubscribe from {{ chip.queueName }}"`

## Phase 3: Duplicate-Queue Guard (PR 2)

- [ ] 3.1 RED `messages.component.spec.ts`: duplicate `queueName` blocks Subscribe, no duplicate chip (spec: "Duplicate queueName is blocked")
- [ ] 3.2 GREEN `messages.component.ts`: `isDuplicateQueue` computed; `[disabled]="isDuplicateQueue()"` on Subscribe button; early-return guard inside `subscribeToQueue()`

## Phase 4: Join/Leave Error Surfacing (PR 2)

- [ ] 4.1 RED `messages.component.spec.ts`: `joinSubscription` rejection sets `errorMessage()` and renders in status area, no unhandled rejection (spec: "Join failure surfaces to status")
- [ ] 4.2 RED `messages.component.spec.ts`: `leaveSubscription` rejection sets `errorMessage()` and renders in status area (spec: "Leave failure surfaces to status")
- [ ] 4.3 GREEN `messages.component.ts`: add `.catch((err) => this.errorMessage.set(...))` at both `joinSubscription`/`leaveSubscription` call sites (reuses existing `errorMessage` signal)

## Phase 5: Scoped Unsubscribe Wiring (PR 2)

- [ ] 5.1 RED `messages.component.spec.ts`: unsubscribing one chip removes only its messages/chip, calls `leaveSubscription` + `clearSubscription` with that id, sibling chip stays intact (spec: "Unsubscribing one chip removes only that chip's messages, others remain intact")
- [ ] 5.2 GREEN `messages.component.ts`: `unsubscribe(id)` + `finishUnsubscribe(id)` using `busHub.clearSubscription(id)` and `subscriptions.update(remove id)`
- [ ] 5.3 GREEN `messages.component.html`: remove old global Unsubscribe button and single-sub input `[disabled]` binding

## Phase 6: Verification

- [ ] 6.1 Run `npm test` (frontend/) full suite, confirm all green
- [ ] 6.2 Manual dev-server smoke: two subscriptions, verify chip row wraps with no clipping at ~375px viewport (spec: "Chip row wraps at narrow widths")
- [ ] 6.3 Review diffs for stray `clear()` references or dead single-subscription comments/JSDoc
