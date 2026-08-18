# Design: BusTester Foundation — Hexagonal Walking Skeleton with RabbitMQ

## Technical Approach

Single ASP.NET Core 8 host (Kestrel) + Angular SPA, four-layer hexagonal solution. Domain and Application never reference RabbitMQ.Client or SignalR. The sole seam is `IBusPort`, shaped to hide **both** RabbitMQ's async push-consumer model and Kafka's synchronous poll-loop model behind one callback-based contract, so the future Kafka adapter is additive. State (connections, subscriptions) lives in a singleton in-memory registry — no persistence.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Layering | Hexagonal/Clean: Domain → Application → Infrastructure → Presentation | Layered MVC without ports | Already-decided constraint; keeps broker swap (Kafka later) additive, testable without a live broker |
| `IBusPort` shape | Callback-based: `SubscribeAsync` registers a `Func<BusMessage,Task>` handler and returns a `SubscriptionHandle` immediately; the adapter decides internally how messages reach that handler | Adapter returns `IAsyncEnumerable<BusMessage>` (pull stream) | `IAsyncEnumerable` fits RabbitMQ naturally but forces Application to "pull" — awkward for Kafka's blocking `Consume()` loop, which must push into a channel from a dedicated thread anyway. A registered callback is symmetric: RabbitMQ invokes it from `IAsyncBasicConsumer.HandleBasicDeliverAsync`; Kafka (future) invokes it from a `BackgroundService`-owned thread running a blocking `while` + `Consume()` loop that marshals each result into the same callback. Application layer never knows which model produced the call. |
| Consumption threading | Adapter owns its own dispatch thread/loop; `SubscribeAsync` never blocks the caller | Application layer manages threads per adapter | Keeps thread/poll-loop lifecycle an Infrastructure concern — required for Kafka's blocking API, harmless for RabbitMQ's event model |
| Live push to UI | SignalR hub (`BusHub`) fed by the subscription coordinator | Raw WebSockets; client polling | Built into ASP.NET Core, first-class Angular client (`@microsoft/signalr`), automatic reconnection — polling adds latency and load for a "live feed" requirement |
| Persistence | None — in-memory `ConcurrentDictionary`-backed registries | SQLite/EF Core for connections | Proposal explicitly defers persistence (`bus-tester-persistence`); avoids DB migrations/schema churn in the walking skeleton |
| Angular test runner | Vitest | Jest, Karma | Karma deprecated by Angular team; Jest experimental; Vitest is Angular's stated direction (per exploration) |

## Data Flow

**Send flow**
```
Angular (send form) --POST /api/messages--> MessagesController
  --> SendMessageUseCase.Handle(SendMessageCommand)
  --> IBusPort.SendAsync(BusMessage)                 [Application depends only on port]
  --> RabbitMqAdapter --> IChannel.BasicPublishAsync  --> RabbitMQ broker
  <-- ack/exception -- adapter -- use case -- controller -- 200 OK | 4xx/5xx problem+json -- UI
```

**Receive flow**
```
RabbitMQ broker --delivers--> RabbitMqAdapter (IAsyncBasicConsumer.HandleBasicDeliverAsync)
  --> invokes registered onMessage(BusMessage) callback
  --> SubscriptionCoordinator (Application) appends to in-memory buffer
  --> IHubContext<BusHub>.Clients.Group(subId).SendAsync("MessageReceived", dto)
  --> Angular BusHubService (SignalR client) --> signal/store update --> live message list re-renders
```

## File Changes (solution/project structure)

```
BusTester.sln
src/BusTester.Domain/            BusMessage, BusConnectionConfig, Subscription (entities/VOs)
src/BusTester.Application/       IBusPort, SendMessageUseCase, SubscribeUseCase, SubscriptionCoordinator, in-memory registries
src/BusTester.Infrastructure/    RabbitMqAdapter (IBusPort impl), BusHub (SignalR)
src/BusTester.Api/               Program.cs, Controllers (or minimal-API endpoints), DI wiring, wwwroot (built SPA)
tests/BusTester.Domain.Tests/
tests/BusTester.Application.Tests/   fake IBusPort for use-case tests
tests/BusTester.Infrastructure.Tests/  RabbitMqAdapter integration tests (Testcontainers RabbitMQ)
frontend/src/app/features/connect/    connect form
frontend/src/app/features/send/       send form
frontend/src/app/features/messages/   live message list, SignalR service
frontend/src/app/**/*.spec.ts         Vitest
```

## Interfaces / Contracts

```csharp
public interface IBusPort
{
    Task ConnectAsync(BusConnectionConfig config, CancellationToken ct = default);
    Task DisconnectAsync(CancellationToken ct = default);
    Task SendAsync(BusMessage message, CancellationToken ct = default);
    Task<SubscriptionHandle> SubscribeAsync(
        SubscriptionRequest request,
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct = default);
    Task UnsubscribeAsync(SubscriptionHandle handle, CancellationToken ct = default);
}
```
`SubscribeAsync` returns as soon as the adapter has *started* consuming (RabbitMQ: consumer registered; future Kafka: background poll-loop thread launched) — never blocks on the first message. `UnsubscribeAsync` cancels the adapter's internal loop/consumer via `ct`/handle, regardless of push or poll origin.

**Error handling**: `IBusPort` methods throw typed domain exceptions (`BusConnectionException`, `BusPublishException`) that the adapter maps from broker exceptions (`BrokerUnreachableException`, `OperationInterruptedException` for missing exchange/queue). `MessagesController`/`SubscriptionsController` catch these and return `problem+json` (503 for unreachable broker, 400 for invalid exchange/queue/routing key). No retry logic in v1 — surface the failure to the UI immediately.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (Domain) | `BusMessage`/`BusConnectionConfig` validation | xUnit, no I/O |
| Unit (Application) | Use cases against a fake `IBusPort` | xUnit, TDD-first — proves port shape before adapter exists |
| Integration (Infrastructure) | `RabbitMqAdapter` connect/send/consume | xUnit + Testcontainers RabbitMQ |
| Frontend unit | Forms, SignalR service message handling | Vitest, mocked hub connection |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Rollout is PR-chained (see below) since scaffold + adapter + use cases + SignalR + UI + 2 test projects exceeds the 400-changed-line budget:
- **PR1**: solution scaffold, `.sln`/csproj skeletons, Domain entities, `IBusPort` contract, empty Application project + xUnit test project shells.
- **PR2**: `SendMessageUseCase`/`SubscribeUseCase` (fakes-first TDD), `RabbitMqAdapter` + Infrastructure integration tests, API controllers.
- **PR3**: SignalR `BusHub` + coordinator wiring, Angular SPA (connect/send/messages features) + Vitest specs.

## Open Questions

- [ ] Confirm Vitest vs Jest (carried from proposal, not yet answered).
- [ ] Confirm chained 3-PR delivery vs single PR (carried from proposal).
- [ ] Confirm flexible exchange/queue/routing-key entry vs simplified "queue name only" UI (carried from proposal).
