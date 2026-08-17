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

## PR2: Use Cases, RabbitMqAdapter, API

### Phase 4: Use Cases (TDD, fake IBusPort first)

- [ ] 4.1 RED→GREEN: `SendMessageUseCaseTests.cs` (fake `IBusPort`, successful publish) drives `SendMessageUseCase.cs`.
- [ ] 4.2 RED→GREEN: `SendMessageUseCaseTests.cs` (invalid exchange/no connection rejected, connection stays usable) drives `BusPublishException`/`BusConnectionException` path.
- [ ] 4.3 REFACTOR: `SendMessageUseCase.cs` + command/result types.
- [ ] 4.4 RED→GREEN: `SubscribeUseCaseTests.cs` (fake `IBusPort`, valid subscribe returns handle) drives `SubscribeUseCase.cs`.
- [ ] 4.5 RED→GREEN: `SubscribeUseCaseTests.cs` (invalid queue rejected, no subscription started) drives error path.
- [ ] 4.6 REFACTOR: `SubscribeUseCase.cs` + `SubscriptionCoordinator` in-memory registry.

### Phase 5: RabbitMqAdapter (Integration, Testcontainers)

- [ ] 5.1 Add RabbitMQ.Client v7.x to Infrastructure; `Testcontainers.RabbitMq` to Infrastructure.Tests.
- [ ] 5.2 RED→GREEN: `RabbitMqAdapterTests.cs` (connect succeeds vs live container) drives `ConnectAsync`/`DisconnectAsync`.
- [ ] 5.3 RED→GREEN: unreachable host throws `BusConnectionException` within bounded timeout drives `BrokerUnreachableException` mapping.
- [ ] 5.4 RED→GREEN: `SendAsync` publishes via `BasicPublishAsync` (message-sending: successful publish).
- [ ] 5.5 RED→GREEN: missing exchange throws `BusPublishException`, connection stays usable drives error mapping.
- [ ] 5.6 RED→GREEN: `SubscribeAsync` consumes via `IAsyncBasicConsumer` callback (message-consumption: live delivery).
- [ ] 5.7 RED→GREEN: missing queue throws, no subscription started drives error mapping.
- [ ] 5.8 REFACTOR: `RabbitMqAdapter.cs` — consolidate exception mapping, dispose/cleanup.

### Phase 6: API Endpoints

- [ ] 6.1 Create `ConnectionsController.cs` (POST/DELETE `/api/connections`), `MessagesController.cs` (POST `/api/messages`), `SubscriptionsController.cs` (POST `/api/subscriptions`) mapping exceptions → problem+json (503/400).
- [ ] 6.2 Wire DI in `Program.cs`: `IBusPort`→`RabbitMqAdapter`, use cases, problem+json exception middleware.

## PR3: SignalR Hub + Angular SPA

### Phase 7: SignalR Hub & Coordinator

- [ ] 7.1 Create `BusHub.cs` (group-per-subscription) + wire `SubscriptionCoordinator`→`IHubContext<BusHub>` push; register `/hubs/bus` in `Program.cs`.
- [ ] 7.2 RED→GREEN: `SubscriptionCoordinatorTests.cs` — fake-adapter message triggers registered push callback.

### Phase 8: Angular SPA (TDD)

- [ ] 8.1 Scaffold `features/connect/` form (host/port/credentials).
- [ ] 8.2 RED→GREEN: `connect.component.spec.ts` (submit→POST `/api/connections`; unreachable-broker error, no partial connection) drives `connect.component.ts`.
- [ ] 8.3 Scaffold `features/send/` form (exchange, routing key, payload).
- [ ] 8.4 RED→GREEN: `send.component.spec.ts` (submit→POST `/api/messages` + confirms; invalid-exchange error, connection stays usable) drives `send.component.ts`.
- [ ] 8.5 Scaffold `features/messages/` live list + `bus-hub.service.ts`.
- [ ] 8.6 RED→GREEN: `bus-hub.service.spec.ts` (mocked hub, `MessageReceived` updates signal) drives `bus-hub.service.ts`.
- [ ] 8.7 RED→GREEN: `messages.component.spec.ts` (subscribe→POST `/api/subscriptions`; invalid-queue error, no row added) drives `messages.component.ts`.
- [ ] 8.8 REFACTOR: extract shared HTTP/error-mapping service across connect/send/messages (container-presentational split).

### Phase 9: End-to-End Verification

- [ ] 9.1 Verify e2e flow (connect→send→subscribe→live feed) against RabbitMQ container (message-consumption: "Live delivery").
- [ ] 9.2 Run full `dotnet test` + `npm test -- --run`; update README with run instructions.
