# Tasks: Broker Abstraction (capabilities-based core)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450–650 (renames + tests across 4 .NET projects) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (user picks stacked-to-main vs feature-branch-chain before apply) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Neutral `BusConnectionConfig` (server list + optional creds) + teardown-first `ConnectAsync` (#34) | PR 1 | `dotnet test tests/BusTester.Domain.Tests` | `dotnet test tests/BusTester.Infrastructure.Tests` (Docker) — #34 regression | `BusConnectionConfig.cs`, `BrokerServer.cs`, `RabbitMqAdapter` teardown, `ConnectionsController` body |
| 2 | Neutral `BusMessage` (`Target`, optional `RoutingKey`) + byte-compatible wire mapping seam | PR 2 | `dotnet test tests/BusTester.Domain.Tests` | `dotnet test tests/BusTester.Infrastructure.Tests` (Docker) — send/receive identical | `BusMessage.cs`, `*Command.cs`, `MessagesController`, `SignalRMessageBroadcaster` maps |
| 3 | `BrokerCapabilities` + `GET /api/capabilities` + request-reply gate | PR 3 | `dotnet test tests/BusTester.Application.Tests` | `dotnet test tests/BusTester.Api.Tests` — endpoint 200 pre-connect | `BrokerCapabilities.cs`, `CapabilitiesController.cs`, `GetBrokerCapabilitiesUseCase.cs`, `RequestReplyNotSupportedException.cs`, reply-use-case guard |

Feature-branch-chain bases (if chosen): PR 1 base `feat/broker-abstraction`; PR 2 base PR 1 branch; PR 3 base PR 2 branch.
Parallelization: PRs are sequential (all touch `RabbitMqAdapter.cs`). Tasks inside a phase are sequential per Strict TDD (RED → GREEN → REFACTOR).

## Phase 1: Connection config + lifecycle (PR 1)
_Spec: bus-connection — "Establish and Maintain Connection" (MODIFIED)._

- [x] 1.1 RED `BusConnectionConfigTests`: empty `Servers`, blank host-in-list, out-of-range port rejected; credential-less accepted; username-without-password rejected; existing 4-arg ctor tests stay green.
- [x] 1.2 GREEN `src/BusTester.Domain/BrokerServer.cs`: `record BrokerServer(string Host, int Port)` + port 1..65535 guard.
- [x] 1.3 GREEN `src/BusTester.Domain/BusConnectionConfig.cs`: add `IReadOnlyList<BrokerServer> Servers` (≥1), `string? Username`, `string? Password`, both-or-neither rule; keep 4-arg ctor + 4 guards; `Host`/`Port` project `Servers[0]`.
- [x] 1.4 RED Infrastructure #34 regression: connect → subscribe → connect again; assert prior `IConnection` + subscription channels `IsOpen == false`, no orphan, new connection sends/subscribes.
- [x] 1.5 GREEN `src/BusTester.Infrastructure/RabbitMqAdapter.cs`: private `TeardownAsync(ct)` closes+disposes subscription channels + `_connection` and nulls them; `ConnectAsync` calls it first; `DisconnectAsync`/`DisposeAsync` delegate; read `Servers[0]`, set `factory.UserName`/`Password` only when non-null.
- [x] 1.6 RED+GREEN `src/BusTester.Api/Controllers/ConnectionsController.cs`: `POST /api/connections` accepts `{ servers:[{host,port}], username?, password? }` AND today's `{ host, port, username, password }` body unchanged (no new required field).
- [x] 1.7 REFACTOR: dedupe teardown paths; `dotnet test`.

## Phase 2: Message neutralization + wire seam (PR 2)
_Spec: message-sending — "Broker-Neutral Send Message Superset"; message-consumption — "Broker-Neutral Received Message Superset"._

- [ ] 2.1 RED `BusMessageTests`: null `RoutingKey` accepted; null `Target` rejected; blank `Payload` rejected; `""` `Target` allowed.
- [ ] 2.2 GREEN `src/BusTester.Domain/BusMessage.cs`: `Exchange`→`Target` (required, `""` ok); `RoutingKey` nullable; XML-document the neutral superset; no new fields.
- [ ] 2.3 GREEN `SendMessageCommand.cs`, `SendMessageWithReplyCommand.cs`: `Exchange`→`Target`.
- [ ] 2.4 RED+GREEN `MessagesController.cs`: wire keeps `exchange`/`routingKey`; maps `exchange → command.Target`.
- [ ] 2.5 RED+GREEN `SignalRMessageBroadcaster.cs`: map `Target → Exchange`, `RoutingKey ?? "" → RoutingKey`; `MessageReceivedDto` fields/types + SignalR `MessageReceived` payload field names unchanged (asserted in Api test).
- [ ] 2.6 RED+GREEN `RabbitMqAdapter.cs`: map `Target` → AMQP exchange; enforce non-blank routing key at adapter level (RED: blank key rejected by adapter).
- [ ] 2.7 REFACTOR; Infrastructure send/receive/reply parity run; `dotnet test`.

## Phase 3: Capabilities + request-reply gate (PR 3)
_Spec: bus-connection — "Adapter Declares Broker Capabilities" + "Read Broker Capabilities Endpoint"; request-reply — "Request-Reply Is Gated by a Capability Flag"._

- [ ] 3.1 GREEN `src/BusTester.Application/Ports/BrokerCapabilities.cs`: `record BrokerCapabilities(string BrokerName, bool SupportsRequestReply)`.
- [ ] 3.2 GREEN `Ports/IBusPort.cs`: add `BrokerCapabilities Capabilities { get; }` + `ConnectAsync` teardown-first XML contract; update `StubBusPort` and `FakeBusPort` to implement it.
- [ ] 3.3 RED+GREEN `UseCases/GetBrokerCapabilitiesUseCase.cs`: returns `busPort.Capabilities`.
- [ ] 3.4 RED `SendMessageWithReplyUseCaseTests`: `SupportsRequestReply=false` throws `RequestReplyNotSupportedException` and declares no queue (assert `FakeBusPort.CallOrder`); `true` path unchanged.
- [ ] 3.5 GREEN `src/BusTester.Domain/Exceptions/RequestReplyNotSupportedException.cs : BusException`; guard as first statement of `SendMessageWithReplyUseCase.HandleAsync`.
- [ ] 3.6 GREEN `RabbitMqAdapter.Capabilities` → `new("RabbitMQ", SupportsRequestReply: true)` constant.
- [ ] 3.7 RED+GREEN `Controllers/CapabilitiesController.cs`: `GET /api/capabilities` → `200 {"brokerName":"RabbitMQ","supportsRequestReply":true}`; answers before connect, stable after connect/disconnect; register `GetBrokerCapabilitiesUseCase` in `Program.cs`.
- [ ] 3.8 GREEN map `RequestReplyNotSupportedException` → HTTP 409 in `BusExceptionHandler`.
- [ ] 3.9 RED Infrastructure: `Capabilities.SupportsRequestReply` readable with no connection.
- [ ] 3.10 REFACTOR; full `dotnet test` (Docker); confirm `ArchitectureTests` green.

## Phase 4: Verification
- [ ] 4.1 Full `dotnet test` (all four projects, Docker running) green; RabbitMQ send/subscribe/reply observably identical; no `frontend/` or `docker-compose.yml` file changed; `ArchitectureTests` proves Domain/Application free of `RabbitMQ.Client`.
