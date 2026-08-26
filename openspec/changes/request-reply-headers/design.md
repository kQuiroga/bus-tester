# Design: Request-Reply Headers (Phase A)

## Technical Approach

`BusMessage` (Domain) gains two nullable trailing properties, `ReplyTo` and `CorrelationId`, set via optional constructor parameters so every existing 3-arg call site keeps compiling unchanged. Because `BusMessage` is already the single value type used for both send and receive (`RabbitMqAdapter.SubscribeAsync` builds one from each delivery), extending it — rather than the `IBusPort` interface — makes the fields flow through `SendAsync`, `SubscribeAsync`'s callback, `SubscriptionCoordinator`, and `IMessageBroadcaster` with zero interface or port signature changes. `SendMessageCommand` and `SendMessageRequest` (API DTO) mirror the same two optional trailing fields. `RabbitMqAdapter.SendAsync` builds a `RabbitMQ.Client.BasicProperties` only when either field is non-null and calls the properties-aware `BasicPublishAsync` overload; otherwise it keeps today's 4-arg call untouched. On receive, the adapter reads `args.BasicProperties.ReplyTo`/`CorrelationId` (type `IReadOnlyBasicProperties`) into the new `BusMessage` constructor args. `MessageReceivedDto` (SignalR payload) gets the same two nullable fields so they reach any consumer without new correlation logic.

## Architecture Decisions

### Decision: Extend `BusMessage` via optional constructor params, not an overload or wrapper type

| Option | Tradeoff | Decision |
|---|---|---|
| Optional params on the existing constructor | Zero new call-site friction, keeps single-constructor-with-validation style already used | **Chosen** |
| New 5-arg constructor overloading the 3-arg one | Duplicate validation surface, no added safety over optional params | Rejected |
| Separate `ReceivedBusMessage : BusMessage` wrapper for receive-side headers | `BusMessage` is already symmetric (send and receive share one type); a subtype forks that symmetry and forces new casts at every callback site | Rejected |

### Decision: No `IBusPort` signature change — headers ride inside `BusMessage`

**Choice**: `SendAsync(BusMessage, CancellationToken)` and the `SubscribeAsync` callback stay exactly as declared today.
**Alternatives considered**: Add a `RabbitMQ.Client.BasicProperties?` parameter to `IBusPort.SendAsync`.
**Rationale**: `IBusPort`'s own doc comment states Domain/Application code must never depend on a broker-specific client library; leaking `BasicProperties` (a RabbitMQ.Client type) into the port would break that boundary and block a future Kafka adapter. Carrying the fields on `BusMessage` keeps the port fully broker-agnostic and needs no fake/stub signature changes.

### Decision: Conditional `BasicProperties` construction in `RabbitMqAdapter.SendAsync`

**Choice**: Build `BasicProperties` and use the properties-aware overload only when `ReplyTo` or `CorrelationId` is set; otherwise keep the existing 4-arg `BasicPublishAsync` call.
**Alternatives considered**: Always construct `BasicProperties` (empty when unset) and always call the properties-aware overload.
**Rationale**: Matches the proposal's explicit intent to avoid behavior drift on the default (headerless) send path, which is exercised by all existing adapter/API tests.

## Data Flow

    Send:    MessagesController → SendMessageCommand → SendMessageUseCase
             → new BusMessage(ex, rk, payload, replyTo?, correlationId?)
             → IBusPort.SendAsync → RabbitMqAdapter builds BasicProperties (if set)
             → RabbitMQ.Client.BasicPublishAsync

    Receive: RabbitMQ delivery (IReadOnlyBasicProperties) → RabbitMqAdapter
             → new BusMessage(ex, rk, payload, props.ReplyTo, props.CorrelationId)
             → SubscriptionCoordinator.OnMessageReceivedAsync
             → IMessageBroadcaster.BroadcastAsync → MessageReceivedDto (SignalR)

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `src/BusTester.Domain/BusMessage.cs` | Modify | Add `string? ReplyTo = null, string? CorrelationId = null` params/properties |
| `src/BusTester.Application/UseCases/SendMessageCommand.cs` | Modify | Add same two optional trailing fields |
| `src/BusTester.Application/UseCases/SendMessageUseCase.cs` | Modify | Pass fields into `new BusMessage(...)` |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modify | Conditional `BasicProperties` on send; read properties on receive |
| `src/BusTester.Infrastructure/SignalRMessageBroadcaster.cs` | Modify | `MessageReceivedDto` gets `ReplyTo`/`CorrelationId` |
| `src/BusTester.Api/Controllers/MessagesController.cs` | Modify | `SendMessageRequest` gets optional fields; pass into `SendMessageCommand` |
| `tests/BusTester.Domain.Tests/BusMessageTests.cs` | Modify | Cover with/without headers, existing 3-arg ctor unaffected |
| `tests/BusTester.Application.Tests/*SendMessageUseCase*` | Modify | `FakeBusPort.SentMessages` carries fields end to end |
| `tests/BusTester.Infrastructure.Tests/RabbitMqAdapterTests.cs` | Modify | Testcontainers round trip: publish with headers, verify via `BasicGetResult.BasicProperties`; subscribe delivery surfaces headers |
| `tests/BusTester.Api.Tests/Controllers/MessagesControllerTests.cs` | Modify | POST with/without headers, assert `StubBusPort.SentMessages` |

`FakeBusPort`/`StubBusPort` need **no code changes** — `IBusPort.SendAsync(BusMessage, ct)` is unchanged; they already forward whatever `BusMessage` they receive.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Domain (xUnit) | `BusMessage` ctor: null defaults, explicit values, no coercion of empty string | Unit, RED-first per Strict TDD |
| Application (xUnit) | `SendMessageUseCase` forwards optional fields into `BusMessage` | Unit via `FakeBusPort.SentMessages` |
| Infrastructure (xUnit + Testcontainers) | Publish sets `BasicProperties.ReplyTo`/`CorrelationId` on the broker; consumed delivery surfaces them on `BusMessage` | Integration, live RabbitMQ, existing `RabbitMqAdapterTests` pattern |
| API (xUnit, `WebApplicationFactory`) | POST with/without headers reaches `StubBusPort` unchanged/with fields | Integration, existing `MessagesControllerTests` pattern |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary; this change only threads two opaque optional string fields through existing typed layers.

## Migration / Rollout

No migration required. All new fields are additive/nullable; no default call site starts passing them, so behavior is identical until a caller opts in.

## Open Questions

None — all 4 proposal assumptions were confirmed by the user on 2026-08-25.
