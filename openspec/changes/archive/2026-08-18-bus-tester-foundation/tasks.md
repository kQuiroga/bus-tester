# Tasks: BusTester Foundation — Hexagonal Walking Skeleton with RabbitMQ

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~300-450, PR2 ~500-700, PR3 ~400-600 |
| 400-line budget risk | Medium (PR1), High (PR2), Medium-High (PR3) |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**PR2 budget outcome**: forecast confirmed — 858 changed lines (mostly hand-authored: use cases, adapter, tests, controllers; only ~5 lines are `.csproj` package-reference additions, no lockfiles this time). `gentle-ai sdd-attempt settle` returned `changed_line_budget_exceeded: true`, `decision_required: true`, `next_action: "reset"`. Work is complete and green (42/42 tests) but the attempt is **blocked on a maintainer decision** (rescope/reset the objective, or accept the overage as PR1's was) — not auto-approved, since this is real hand-written code, not generated/vendored content.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Solution/Angular scaffold + Domain entities + `IBusPort` contract | PR 1 | `dotnet test tests/BusTester.Domain.Tests`; `npm test -- --run` | N/A — domain-only, no broker | Revert scaffold commit; no downstream PR depends on runtime behavior |
| 2 | Use cases (fake-first) + `RabbitMqAdapter` + API controllers | PR 2 | `dotnet test tests/BusTester.Application.Tests`; `dotnet test tests/BusTester.Infrastructure.Tests` | Testcontainers RabbitMQ (Docker required) | Revert use cases/adapter/controllers; Domain/`IBusPort` (PR1) unaffected |
| 3 | SignalR hub + Angular SPA (connect/send/messages) | PR 3 | `npm test -- --run` (Vitest) | Local RabbitMQ + `dotnet run` Api + Angular dev server, manual connect→send→subscribe→feed check | Revert hub/SPA; backend (PR1+PR2) still independently testable via HTTP client |

## PR1: Scaffold, Domain, IBusPort

### Phase 1: Foundation

- [x] 1.1 Create `BusTester.sln` + `src/BusTester.{Domain,Application,Infrastructure,Api}` csproj (net8, hex refs: Api→App+Infra, Infra→App, App→Domain).
- [x] 1.2 Create xUnit `tests/BusTester.{Domain,Application,Infrastructure}.Tests`, each referencing its target project; add to `.sln`.
- [x] 1.3 Scaffold Angular workspace in `frontend/` (standalone), configure Vitest as test runner.
- [x] 1.4 Verify `dotnet test` (3 empty projects) and `npm test -- --run` both green — CI-ready smoke check.

### Phase 2: Domain Entities (TDD)

- [x] 2.1 RED→GREEN: `BusMessageTests.cs` (payload/exchange/routingKey required) drives `BusMessage.cs`.
- [x] 2.2 REFACTOR: `BusMessage.cs` — clean up, tests stay green.
- [x] 2.3 RED→GREEN: `BusConnectionConfigTests.cs` (host/port/credentials required) drives `BusConnectionConfig.cs`.
- [x] 2.4 REFACTOR: `BusConnectionConfig.cs`.
- [x] 2.5 RED→GREEN: `SubscriptionTests.cs` (queue name required, handle equality) drives `Subscription.cs`.
- [x] 2.6 REFACTOR: `Subscription.cs`.

### Phase 3: IBusPort Contract

- [x] 3.1 Define `src/BusTester.Application/Ports/IBusPort.cs` (Connect/Disconnect/Send/Subscribe/UnsubscribeAsync) + `SubscriptionRequest`/`SubscriptionHandle` types per design.
- [x] 3.2 RED→GREEN: assembly-reference test asserting Domain/Application have no RabbitMQ.Client dependency (bus-connection: "Adapter is swappable").

## PR2: Use Cases, RabbitMqAdapter, API — COMPLETE (16/16), branch bus-tester-foundation/pr2-usecases-adapter off pr1-scaffold, unpushed

### Phase 4: Use Cases (TDD, fake IBusPort first)

- [x] 4.1 RED→GREEN: `SendMessageUseCaseTests.cs` (fake `IBusPort`, successful publish) drives `SendMessageUseCase.cs`.
- [x] 4.2 RED→GREEN: `SendMessageUseCaseTests.cs` (invalid exchange/no connection rejected, connection stays usable) drives `BusPublishException`/`BusConnectionException` path.
- [x] 4.3 REFACTOR: `SendMessageUseCase.cs` + command/result types.
- [x] 4.4 RED→GREEN: `SubscribeUseCaseTests.cs` (fake `IBusPort`, valid subscribe returns handle) drives `SubscribeUseCase.cs`.
- [x] 4.5 RED→GREEN: `SubscribeUseCaseTests.cs` (invalid queue rejected, no subscription started) drives error path.
- [x] 4.6 REFACTOR: `SubscribeUseCase.cs` + `SubscriptionCoordinator` in-memory registry.

### Phase 5: RabbitMqAdapter (Integration, Testcontainers)

- [x] 5.1 Add RabbitMQ.Client v7.x to Infrastructure; `Testcontainers.RabbitMq` to Infrastructure.Tests.
- [x] 5.2 RED→GREEN: `RabbitMqAdapterTests.cs` (connect succeeds vs live container) drives `ConnectAsync`/`DisconnectAsync`.
- [x] 5.3 RED→GREEN: unreachable host throws `BusConnectionException` within bounded timeout drives `BrokerUnreachableException` mapping.
- [x] 5.4 RED→GREEN: `SendAsync` publishes via `BasicPublishAsync` (message-sending: successful publish).
- [x] 5.5 RED→GREEN: missing exchange throws `BusPublishException`, connection stays usable drives error mapping. (Real RED found live against Docker: `basic.publish` has no synchronous ack, so this needed a passive `ExchangeDeclarePassiveAsync` check before publish, not just a try/catch around `BasicPublishAsync`.)
- [x] 5.6 RED→GREEN: `SubscribeAsync` consumes via `IAsyncBasicConsumer` callback (message-consumption: live delivery).
- [x] 5.7 RED→GREEN: missing queue throws, no subscription started drives error mapping.
- [x] 5.8 REFACTOR: `RabbitMqAdapter.cs` — consolidate exception mapping, dispose/cleanup.

### Phase 6: API Endpoints

- [x] 6.1 Create `ConnectionsController.cs` (POST/DELETE `/api/connections`), `MessagesController.cs` (POST `/api/messages`), `SubscriptionsController.cs` (POST/DELETE `/api/subscriptions`) mapping exceptions → problem+json (503/400).
- [x] 6.2 Wire DI in `Program.cs`: `IBusPort`→`RabbitMqAdapter`, use cases, problem+json exception middleware.
- [x] 6.3 *(added post-hoc per user request, not in original Phase 6 scope)* `tests/BusTester.Api.Tests/` — `WebApplicationFactory<Program>` integration tests for all three controllers against a `StubBusPort` (12 tests): success paths (connect/send/subscribe/unsubscribe) + exception-mapping paths (503 broker-unreachable, 400 broker-rejected, 400 domain-validation), asserting exact status code + `application/problem+json` body. Retrofit characterization — all 12 passed on first run, no behavioral bug found vs. spec.

## PR3: SignalR Hub + Angular SPA — COMPLETE (12/12), branch bus-tester-foundation/pr3-signalr-ui off pr2-usecases-adapter, unpushed

### Phase 7: SignalR Hub & Coordinator

- [x] 7.1 Create `BusHub.cs` (group-per-subscription) + wire `SubscriptionCoordinator`→`IHubContext<BusHub>` push; register `/hubs/bus` in `Program.cs`. *(Implemented via an `IMessageBroadcaster` seam in Application, implemented by `SignalRMessageBroadcaster` in Infrastructure, so Application still never references SignalR — mirrors the `IBusPort` broker-agnostic pattern.)*
- [x] 7.2 RED→GREEN: `SubscriptionCoordinatorTests.cs` — fake-adapter message triggers registered push callback (via `FakeMessageBroadcaster`).

### Phase 8: Angular SPA (TDD)

- [x] 8.1 Scaffold `features/connect/` form (host/port/credentials).
- [x] 8.2 RED→GREEN: `connect.component.spec.ts` (submit→POST `/api/connections`; unreachable-broker error, no partial connection) drives `connect.component.ts`.
- [x] 8.3 Scaffold `features/send/` form (exchange, routing key, payload).
- [x] 8.4 RED→GREEN: `send.component.spec.ts` (submit→POST `/api/messages` + confirms; invalid-exchange error, connection stays usable) drives `send.component.ts`.
- [x] 8.5 Scaffold `features/messages/` live list + `bus-hub.service.ts`.
- [x] 8.6 RED→GREEN: `bus-hub.service.spec.ts` (mocked hub, `MessageReceived` updates signal) drives `bus-hub.service.ts`.
- [x] 8.7 RED→GREEN: `messages.component.spec.ts` (subscribe→POST `/api/subscriptions`; invalid-queue error, no row added) drives `messages.component.ts`.
- [x] 8.8 REFACTOR: extract shared HTTP/error-mapping service across connect/send/messages (container-presentational split) — `core/api-client.service.ts`.

### Phase 9: End-to-End Verification

- [x] 9.1 Verify e2e flow (connect→send→subscribe→live feed) against RabbitMQ container (message-consumption: "Live delivery"). Verified live: Docker RabbitMQ + `dotnet run` (http profile) + a Node script using the installed `@microsoft/signalr` client joined the hub group and received the `MessageReceived` push seconds after a message was published — full RabbitMQ → RabbitMqAdapter → SubscriptionCoordinator → SignalRMessageBroadcaster → BusHub → client round trip confirmed.
- [x] 9.2 Run full `dotnet test` + `npm test -- --run`; update README with run instructions. All non-Docker-dependent suites green (29+10+12 .NET, 17 Vitest); root `README.md` added with backend/frontend run + test instructions.

## Post-Verify Remediation: restart/no-persistence regression coverage

`sdd-verify` found 7/9 spec scenarios had runtime test coverage; the 2 remaining ("No state survives restart", "Feed resets on restart") had only static architectural evidence, not a runtime test. Added regression coverage for both without requiring an actual OS-level process restart:

- [x] R.1 `tests/BusTester.Api.Tests/Controllers/RestartRegressionTests.cs` — connects + subscribes + delivers a message on a `BusTesterApiFactory` instance, disposes it, then boots a brand-new `BusTesterApiFactory` (fresh DI container, same code a real restart would boot) and asserts its `SubscriptionCoordinator` and `IBusPort` have zero knowledge of the prior instance's state. RED confirmed meaningful (temporarily made `SubscriptionCoordinator`'s backing dictionary `static` — test failed as expected — then reverted).
- [x] R.2 `frontend/src/app/core/bus-hub.service.spec.ts` — pre-populates `localStorage`/`sessionStorage` with fake messages, then builds a fresh `BusHubService` instance via a reset `TestBed` module (simulating an app reload) and asserts the `messages` signal still starts empty. RED confirmed meaningful (temporarily made the service read its initial signal value from `localStorage` — test failed as expected — then reverted).
