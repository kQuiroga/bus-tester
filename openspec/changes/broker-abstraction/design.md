# Design: Broker Abstraction (capabilities-based core)

## Technical Approach

Exploration Option C, backend only. Keep one `IBusPort`; the adapter *declares* a
static `BrokerCapabilities` descriptor instead of the core guessing what the broker
can do. Widen `BusMessage` / `BusConnectionConfig` / `MessageReceivedDto` into a
*documented* neutral superset by renaming internal members and relaxing guards —
never by changing the HTTP/SignalR wire. A thin controller → use-case → mapping seam
isolates the wire DTOs (`exchange` / `routingKey` names unchanged) from the renamed
domain model. `ConnectAsync` becomes teardown-first, folding in issue #34.
`ArchitectureTests` stays the guardrail. Satisfies all four delta specs; RabbitMQ
behaviour observably identical.

## Architecture Decisions

### Decision: Internal neutral names, wire byte-compatible

| Option | Tradeoff | Decision |
|---|---|---|
| Rename wire + domain together | breaks the untouched Angular client | rejected |
| Rename domain only, map to unchanged DTOs at the controller / broadcaster | one mapping seam, zero wire change | **chosen** |

**Rationale:** the frontend is out of scope and must keep working unmodified
(proposal Q1). Renames stay behind the API boundary.

Domain `BusMessage` neutral shape:

| Today | Neutral | Rule | Justification vs. Kafka mapping |
|---|---|---|---|
| `Exchange` (required, `""` ok) | **`Target`** (required, `""` = broker default) | matches `IBusPort`'s own "send-to-target" vocabulary | RabbitMQ exchange / Kafka topic |
| `RoutingKey` (required) | **`RoutingKey`** name kept, now **nullable/optional** | adapter enforces broker rules | AMQP routing key (required for RabbitMQ send, enforced in adapter) / Kafka partition key (optional) |
| `Payload` | `Payload` (required) | unchanged | broker-neutral |
| `ReplyTo`, `CorrelationId`, `Headers` | unchanged, optional | unchanged | both brokers |

**No new fields are added.** Kafka receive metadata (partition / offset / timestamp /
key) is deferred to the KafkaAdapter slice; adding it now would be permanently-null
noise (proposal risk). The superset is documented in XML docs, not padded.

Wire mapping:
- `SendMessageRequest` / `SendMessageWithReplyRequest` keep `Exchange`, `RoutingKey`,
  … names; controller maps `request.Exchange → command.Target`.
- `MessageReceivedDto` keeps all six fields and their current types. Broadcaster maps
  `message.Target → Exchange`, `message.RoutingKey ?? "" → RoutingKey`. RabbitMQ
  deliveries always carry a routing key, so nothing observable changes.
- `SubscriptionRequest.QueueName` is left untouched (wire name matters; Kafka
  consumer-group / offset concerns are out of scope).

### Decision: `BrokerCapabilities` is a static adapter property

`BrokerCapabilities(string BrokerName, bool SupportsRequestReply)` — record in
`BusTester.Application.Ports`. Only `SupportsRequestReply` is behavioural (proposal
locks the scope to this flag). `BrokerName` is a present-tense fact about the
registered adapter — not speculative — and lets a future client label the descriptor.
All other exploration flags (`supportsExchanges`, `offsetResetOptions`, …) are
Kafka-speculative and dropped.

`IBusPort` gains `BrokerCapabilities Capabilities { get; }` — a synchronous property,
no I/O. `RabbitMqAdapter` returns `new("RabbitMQ", SupportsRequestReply: true)` as a
constant. Singleton DI → the descriptor is identical before, during, and after any
connection (spec: "stable across connection-state changes").

Rejected: `Task<BrokerCapabilities> GetCapabilitiesAsync()` (signals I/O / a live
connection); a separate `IBrokerDescriptor` DI registration (drift risk, a second
registration per broker).

### Decision: Relaxed `BusConnectionConfig` with a kept legacy ctor

New primary shape: `IReadOnlyList<BrokerServer> Servers` (≥ 1), `string? Username`,
`string? Password`, where `BrokerServer(string Host, int Port)`. Convenience
accessors `Host` / `Port` project `Servers[0]` so `RabbitMqAdapter` and the
Infrastructure test fixture compile unchanged. The existing 4-arg ctor is **kept**
and still enforces all four guards — today's shape "behaves exactly as before" and
the existing `BusConnectionConfigTests` stay green. `RabbitMqAdapter.ConnectAsync`
reads `Servers[0]` and sets `factory.UserName` / `Password` only when non-null
(RabbitMQ.Client already defaults to `guest`/`guest`).

Guard migration — each replaced guard is one RED test:

| Old guard | New rule | TDD test |
|---|---|---|
| `host` non-blank | server list non-empty; every server host non-blank | empty list rejected; blank host in list rejected |
| `port` 1..65535 | unchanged, per server | out-of-range port rejected |
| `username` non-blank | optional on the primary ctor; **both-or-neither** with password | credential-less config accepted; username-without-password rejected |
| `password` non-blank | same pair rule | same |

### Decision: Teardown-first adapter lifecycle (issue #34)

`RabbitMqAdapter` gains a private `TeardownAsync(ct)`: close + dispose every
subscription channel, clear `_subscriptionChannels`, close + dispose `_connection`,
null it. `ConnectAsync` calls it **before** building the new `ConnectionFactory`;
`DisconnectAsync` and `DisposeAsync` delegate to it. Loss of live subscriptions on
reconnect is documented, expected behaviour (spec + proposal Q3).

`IBusPort`'s `ConnectAsync` XML doc codifies the reusable contract: *"MUST release any
previously established connection, channels, and consumer / poll loops before
acquiring new ones."* A future poll-loop (Kafka) adapter inherits the same rule.
Extracting a `BrokerAdapterBase` template method is deferred — one adapter today
makes it speculative.

Coordinator stale entries after reconnect are harmless (session-scoped, no delivery
reaches a closed channel) — no `SubscriptionCoordinator` change this slice.

### Decision: Request-reply capability gate

`SendMessageWithReplyUseCase.HandleAsync` checks
`_busPort.Capabilities.SupportsRequestReply` as its first statement and throws a new
`RequestReplyNotSupportedException : BusException` **before** declaring the temp
queue ("declares no reply queue"). RabbitMQ reports `true`, so the guard is a
no-op there and every existing reply test stays green.

## Data Flow

```
GET /api/capabilities
  -> CapabilitiesController -> GetBrokerCapabilitiesUseCase -> IBusPort.Capabilities (const)   [no connection touched]

POST /api/messages { exchange, routingKey, ... }
  -> MessagesController -> SendMessageCommand { Target, ... }
  -> SendMessageUseCase -> BusMessage { Target, ... } -> RabbitMqAdapter.SendAsync   [unchanged AMQP path]

POST /api/messages/with-reply
  -> SendMessageWithReplyUseCase
       -> if !Capabilities.SupportsRequestReply  -> RequestReplyNotSupportedException  (no queue declared)
       -> (RabbitMQ: true) declare temp queue -> subscribe -> publish   [unchanged]

POST /api/connections
  -> ConnectAsync -> TeardownAsync(prior connection + channels) -> CreateConnectionAsync(new)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/BusTester.Domain/BusMessage.cs` | Modify | `Exchange`→`Target`; `RoutingKey` nullable; document the neutral superset |
| `src/BusTester.Domain/BusConnectionConfig.cs` | Modify | `Servers` list + optional creds; keep 4-arg ctor & guards; `Host`/`Port` accessors |
| `src/BusTester.Domain/BrokerServer.cs` | Create | `record BrokerServer(string Host, int Port)` + port guard |
| `src/BusTester.Domain/Exceptions/RequestReplyNotSupportedException.cs` | Create | `BusException` subtype |
| `src/BusTester.Application/Ports/BrokerCapabilities.cs` | Create | descriptor record |
| `src/BusTester.Application/Ports/IBusPort.cs` | Modify | add `Capabilities`; lifecycle XML contract on `ConnectAsync` |
| `src/BusTester.Application/UseCases/GetBrokerCapabilitiesUseCase.cs` | Create | returns `busPort.Capabilities` |
| `src/BusTester.Application/UseCases/SendMessageWithReplyUseCase.cs` | Modify | capability guard before declare |
| `src/BusTester.Application/UseCases/SendMessageCommand.cs`, `SendMessageWithReplyCommand.cs` | Modify | `Exchange`→`Target` |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modify | `Capabilities` const; `TeardownAsync`; map `Target`; adapter-level routing-key guard |
| `src/BusTester.Infrastructure/SignalRMessageBroadcaster.cs` | Modify | map `Target`→`Exchange`; `MessageReceivedDto` unchanged |
| `src/BusTester.Api/Controllers/CapabilitiesController.cs` | Create | `GET /api/capabilities` |
| `src/BusTester.Api/Controllers/MessagesController.cs`, `ConnectionsController.cs` | Modify | DTO→command mapping; connect body accepts `servers[]` + optional creds; wire names unchanged |
| `src/BusTester.Api/Program.cs` | Modify | register `GetBrokerCapabilitiesUseCase` |
| `tests/BusTester.Api.Tests/Testing/StubBusPort.cs`, `tests/BusTester.Application.Tests/Fakes/FakeBusPort.cs` | Modify | implement `Capabilities` |
| `tests/**` (four suites) | Modify | guard, lifecycle, gate, and endpoint tests (below) |

## Interfaces / Contracts

```csharp
public sealed record BrokerCapabilities(string BrokerName, bool SupportsRequestReply);

public sealed record BrokerServer(string Host, int Port);

public interface IBusPort
{
    BrokerCapabilities Capabilities { get; }   // static per adapter, no connection required
    // existing members unchanged; ConnectAsync doc: MUST tear down prior
    // connection / channels / consumer loops before establishing a new one
}
```

Wire (unchanged): `POST /api/messages` body keeps `exchange`, `routingKey`,
`payload`, `replyTo`, `correlationId`, `headers`. SignalR `MessageReceived` keeps
`subscriptionId`, `exchange`, `routingKey`, `payload`, `replyTo`, `correlationId`.

New: `GET /api/capabilities` → `200 {"brokerName":"RabbitMQ","supportsRequestReply":true}`.
`POST /api/connections` additionally accepts `{ "servers": [{ "host": …, "port": … }], … }`
with optional `username`/`password`; today's `{ host, port, username, password }` body
still accepted with no new required fields.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Domain (xUnit) | `BusMessage` accepts null `RoutingKey`, still rejects null `Target` and blank `Payload`, still allows `""` target; `BusConnectionConfig` server-list guards + credential pair rule; 4-arg ctor behaviour unchanged | pure unit |
| Application (xUnit) | `GetBrokerCapabilitiesUseCase` returns the port descriptor; `SendMessageWithReplyUseCase` throws `RequestReplyNotSupportedException` and declares no queue when `SupportsRequestReply=false` (assert `FakeBusPort.CallOrder`); unchanged path when `true` | `FakeBusPort` with `Capabilities` |
| Application (xUnit) | `ArchitectureTests` still proves Domain/Application never reference `RabbitMQ.Client` | existing fitness function, unchanged |
| Infrastructure (xUnit + Testcontainers, Docker) | `Capabilities.SupportsRequestReply` readable with no connect; **#34 regression**: connect → subscribe → connect again closes the prior `IConnection` and its channels (assert old channel/connection `IsOpen == false`), leaves no orphan, and the new connection sends/subscribes; send / receive / reply semantics identical to today | live broker, one throwaway exchange/queue per test |
| Api (xUnit integration) | `GET /api/capabilities` → 200 before any connect and stable after connect/disconnect; today's `POST /api/messages` and `/api/connections` bodies accepted unchanged; multi-server / credential-less connect body accepted; SignalR `MessageReceived` payload keeps its field names | `BusTesterApiFactory` + `StubBusPort` with `Capabilities` |

## Threat Matrix

N/A — no routing (HTTP/CLI dispatch), shell, subprocess, VCS/PR automation,
executable-file classification, or process-integration boundary. AMQP exchange
routing is message-broker data flow, not covered by the matrix.

## Migration / Rollout

No migration, no persisted state, no feature flag. Single backend PR. Reverting it
restores the AMQP-shaped `BusConnectionConfig` / `BusMessage`, removes
`/api/capabilities`, and returns `ConnectAsync` to its prior (leaking) path. Forecast
~450–650 changed lines, mostly renames plus tests — within the 800-line review
budget, so a single PR is acceptable.

## Open Questions

- [ ] HTTP status for `RequestReplyNotSupportedException` — recommend `409 Conflict`
  via `BusExceptionHandler`; confirm during `sdd-tasks` (not blocking).
- [ ] Credential rule is assumed **both-or-neither**; revisit only if a real broker
  needs username-without-password.
