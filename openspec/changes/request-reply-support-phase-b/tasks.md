# Tasks: Request-Reply Support Phase B (temp reply queue, auto-subscribe, RPC UI)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~820–950 (additions+deletions across 5 layers) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 (sequential, layer-by-layer) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Size drivers (measured against current file sizes): `RabbitMqAdapter.cs` (183 lines) needs its
first `QueueDeclareAsync` call plus a shared consumer-wiring extraction (~+50); the new
`SendMessageWithReplyUseCaseTests.cs` covers 4 scenarios from scratch (~+180); live-broker
`RabbitMqAdapterTests.cs` additions need real declare/publish/teardown assertions (~+100);
`messages.component.ts/.html` (153+72 lines) and `send.component.ts/.html` (94+126 lines) each
gain a new panel/toggle plus specs (~+180 combined). No single file crosses 400 alone, but the
5-layer touch (Application/Infrastructure/Api/Frontend service/Frontend UI) sums well past it.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `IBusPort` gains `DeclareTemporaryReplyQueueAndSubscribeAsync`; `RabbitMqAdapter` implements it; `FakeBusPort`/`StubBusPort` updated to keep the solution compiling | PR 1 | `dotnet test tests/BusTester.Infrastructure.Tests/BusTester.Infrastructure.Tests.csproj` | Live RabbitMQ via Testcontainers/Docker (existing `RabbitMqContainerFixture`) | Revert `IBusPort.cs`, `RabbitMqAdapter.cs`, `FakeBusPort.cs`, `StubBusPort.cs`, new test file — nothing else references the method yet |
| 2 | `SendMessageWithReplyCommand`/`SendMessageWithReplyUseCase` (CorrelationId gen, ReplyTo wiring, subscribe-before-send, unsubscribe-on-failure) | PR 2 | `dotnet test tests/BusTester.Application.Tests/BusTester.Application.Tests.csproj` | N/A — pure unit tests against `FakeBusPort`, no broker needed | Revert the 2 new Application files + test file; PR 1's port capability stays unused but intact |
| 3 | `POST /api/messages/with-reply` on `MessagesController`, DI wiring | PR 3 | `dotnet test tests/BusTester.Api.Tests/BusTester.Api.Tests.csproj` | N/A — `StubBusPort` in-memory, no broker | Revert the new controller action/records and test additions; use case from PR 2 stays valid but unreachable via HTTP |
| 4 | `ReceivedMessage`/`IncomingMessage` gain `replyTo`/`correlationId`; new `ReplySubscriptionService` | PR 4 | `ng test` (frontend, scoped to `bus-hub.service.spec.ts` + `reply-subscription.service.spec.ts`) | N/A — Jasmine/Karma with fake `BUS_HUB_CONNECTION` | Revert field additions in `bus-hub.service.ts`; delete `reply-subscription.service.ts` + spec |
| 5 | `SendComponent` "expect a reply" toggle; `MessagesComponent` reply panel filtered by `correlationId` | PR 5 | `ng test` (frontend, scoped to `send.component.spec.ts` + `messages.component.spec.ts`) | N/A — component specs with `HttpTestingController` | Revert `send.component.ts/.html`, `messages.component.ts/.html` + spec additions; PR 3/4 stay but unused by UI |

If **stacked-to-main**: each PR merges to `main` directly in order 1→5.
If **feature-branch-chain**: PR 1 base = tracker branch; PR 2 base = PR 1 branch; PR 3 base = PR 2
branch; PR 4 base = PR 3 branch; PR 5 base = PR 4 branch — retarget/rebase if a child diff shows
a prior PR's changes.

## Phase 1: PR 1 — Bus Port Capability (Foundation)

- [x] 1.1 RED: Add a failing test in `tests/BusTester.Infrastructure.Tests/RabbitMqAdapterTests.cs` — `DeclareTemporaryReplyQueueAndSubscribeAsync` declares an exclusive/auto-delete queue with a broker-generated name and delivers a published message via `onMessage`.
- [x] 1.2 Add `Task<(SubscriptionHandle Handle, string QueueName)> DeclareTemporaryReplyQueueAndSubscribeAsync(Func<BusMessage, CancellationToken, Task> onMessage, CancellationToken ct = default)` to `src/BusTester.Application/Ports/IBusPort.cs`.
- [x] 1.3 GREEN: Implement in `src/BusTester.Infrastructure/RabbitMqAdapter.cs` via `channel.QueueDeclareAsync(queue: "", durable: false, exclusive: true, autoDelete: true)` + extract/reuse the consumer-wiring block shared with `SubscribeAsync`.
- [x] 1.4 Implement the new method on `tests/BusTester.Application.Tests/Fakes/FakeBusPort.cs` (record requests) and `tests/BusTester.Api.Tests/Testing/StubBusPort.cs` (in-memory stub) so both test projects compile.
- [x] 1.5 RED: Add a test asserting the declared queue disappears once the owning channel closes (auto-delete on consumer cancel — spec: "Auto-delete relies on broker cleanup alone").
- [x] 1.6 REFACTOR: run existing `SubscribeAsync` tests to confirm the shared-helper extraction changed no behavior.

## Phase 2: PR 2 — Send-With-Reply Use Case

- [x] 2.1 RED: Add `tests/BusTester.Application.Tests/UseCases/SendMessageWithReplyUseCaseTests.cs` — CorrelationId generated server-side when blank.
- [x] 2.2 RED: same file — caller-supplied CorrelationId is preserved unchanged.
- [x] 2.3 RED: same file — ReplyTo is set to the declared queue name; subscribe happens before send.
- [x] 2.4 RED: same file — a `SendAsync` failure triggers `UnsubscribeAsync` + `Unregister` on the just-created handle before rethrowing.
- [x] 2.5 Create `src/BusTester.Application/UseCases/SendMessageWithReplyCommand.cs` (`Exchange`, `RoutingKey`, `Payload`, `CorrelationId?`).
- [x] 2.6 GREEN: Create `src/BusTester.Application/UseCases/SendMessageWithReplyUseCase.cs` implementing design's Data Flow steps 1–4; registers with `SubscriptionCoordinator`.
- [x] 2.7 REFACTOR: confirm no duplication regression vs. `SubscribeUseCase`/`SendMessageUseCase`.

## Phase 3: PR 3 — API Endpoint

- [x] 3.1 RED: Add a case in `tests/BusTester.Api.Tests/Controllers/MessagesControllerTests.cs` — `POST /api/messages/with-reply` returns 200 with `{subscriptionId, correlationId}`.
- [x] 3.2 RED: same file — blank vs. supplied `correlationId` is reflected correctly in the response.
- [x] 3.3 GREEN: Add `SendWithReply` action + `SendMessageWithReplyRequest`/`SendWithReplyResponse` records to `src/BusTester.Api/Controllers/MessagesController.cs`, wired to `SendMessageWithReplyUseCase` via DI.

## Phase 4: PR 4 — Frontend Core State

- [ ] 4.1 RED: Extend `frontend/src/app/core/bus-hub.service.spec.ts` — an incoming message with `replyTo`/`correlationId` is exposed unchanged on `ReceivedMessage`.
- [ ] 4.2 GREEN: Add `replyTo?: string`, `correlationId?: string` to `ReceivedMessage`/`IncomingMessage` in `frontend/src/app/core/bus-hub.service.ts`.
- [ ] 4.3 RED: Create `frontend/src/app/core/reply-subscription.service.spec.ts` — `add()`/`remove()` update the `pending()` signal.
- [ ] 4.4 GREEN: Create `frontend/src/app/core/reply-subscription.service.ts` (`ReplySubscriptionService`, root-provided signal service, mirrors `SendHistoryService` pattern).

## Phase 5: PR 5 — Frontend UI Wiring

- [ ] 5.1 RED: Extend `frontend/src/app/features/send/send.component.spec.ts` — toggling "expect a reply" posts to `/api/messages/with-reply` and calls `replySubscriptions.add(...)`.
- [ ] 5.2 GREEN: Add the toggle + with-reply POST branch to `send.component.ts`; markup in `send.component.html`.
- [ ] 5.3 RED: Extend `frontend/src/app/features/messages/messages.component.spec.ts` — reply panel shows only messages whose `correlationId` is pending; shows "no reply yet" when none match.
- [ ] 5.4 GREEN: Add a reply-panel computed signal (filters `busHub.messages()` by pending `correlationId`s) + markup in `messages.component.ts/.html`; unsubscribe removes the pending entry.

## Phase 6: Cross-Cutting Verification

- [ ] 6.1 Run full backend suite: `dotnet test BusTester.sln` (all 4 test projects, Docker required for `BusTester.Infrastructure.Tests`).
- [ ] 6.2 Run full frontend suite: `npm test` (`ng test`) in `frontend/`.
- [ ] 6.3 Confirm plain send and manual-subscription flows are unaffected (spec: "Not requesting a reply is unaffected").
