# Proposal: Broker Abstraction (capabilities-based core)

## Intent

`bus-connection` claims a broker-agnostic core, but the vocabulary is AMQP-shaped: `BusConnectionConfig` demands one host plus mandatory credentials, `BusMessage` demands a non-null `Exchange` and a non-blank `RoutingKey`, and nothing tells a caller what the connected broker can actually do. Adding a second broker (Kafka is the driver) would otherwise force config, message model, DTO, adapter, specs, and UI to change in one oversized step. This is the smallest slice: make the core honestly neutral first, with RabbitMQ behavior unchanged. It also fixes GitHub issue #34 (`ConnectAsync` overwrites `_connection` without closing the previous one), because the adapter lifecycle pattern must exist before a heavier adapter inherits the same hazard.

## Scope

### In Scope
- `BrokerCapabilities` descriptor (adapter declares what it supports) plus a read endpoint exposing it.
- Relax `BusConnectionConfig` toward a server-list / optional-credentials shape, keeping RabbitMQ connect valid and unchanged.
- Neutralize `BusMessage` and SignalR `MessageReceivedDto` into a documented broker-neutral superset: broker-specific fields (exchange, routing key) become clearly optional/renamed per exploration.
- `supportsRequestReply` capability flag only — RabbitMQ reports `true`.
- Issue #34: `ConnectAsync` MUST tear down any existing connection and subscriptions before establishing a new one.
- RabbitMQ end-to-end behavior identical; every existing test stays green.

### Out of Scope
- `KafkaAdapter`, `Confluent.Kafka`, `Testcontainers.Kafka`, `docker-compose.yml`.
- Any frontend change (broker selector, capability-driven panels, Kafka columns).
- Rewriting `request-reply` to be broker-neutral — it stays RabbitMQ-gated behind the flag.
- Kafka-only concerns: consumer group, offset reset, partition/offset/timestamp metadata.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `bus-connection`: connection config no longer requires a single host and mandatory credentials; adapters MUST publish a `BrokerCapabilities` descriptor, readable via an endpoint; connecting while already connected MUST release the prior connection first.
- `message-sending`: `BusMessage` send vocabulary becomes a broker-neutral superset with clearly-optional broker-specific fields; RabbitMQ send semantics unchanged.
- `message-consumption`: received-message contract becomes the same documented superset; RabbitMQ receive semantics unchanged.
- `request-reply`: gains a `supportsRequestReply` capability gate; existing RabbitMQ semantics untouched.

## Approach

Exploration Option C, backend only. One `IBusPort` keeps a neutral core (connect / send / subscribe / unsubscribe); the adapter answers a capabilities descriptor instead of the core guessing. Message and DTO shapes widen to a superset with optional fields rather than splitting into per-broker models, so the single use-case → `SubscriptionCoordinator` → SignalR pipeline survives. Strict TDD: each relaxed guard and each capability field starts as a failing test. The `ArchitectureTests` fitness function (Domain/Application never reference `RabbitMQ.Client`) is the guardrail that keeps the neutralization honest.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/BusTester.Domain/BusConnectionConfig.cs` | Modified | Server-list / optional-credential shape |
| `src/BusTester.Domain/BusMessage.cs` | Modified | Optional broker-specific fields, neutral naming |
| `src/BusTester.Application/Ports/IBusPort.cs` | Modified | Capabilities descriptor surface |
| `src/BusTester.Application/` (new capabilities type + use case) | New | `BrokerCapabilities` + read path |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modified | Descriptor, teardown-on-reconnect (#34) |
| `src/BusTester.Infrastructure/SignalRMessageBroadcaster.cs` | Modified | `MessageReceivedDto` superset |
| `src/BusTester.Api/Controllers/` | Modified | Capabilities endpoint; connect payload shape |
| `tests/` (all four projects) | Modified | Guard, adapter-lifecycle, and contract tests |
| `frontend/` | None | Deliberately untouched this slice |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Renaming wire fields silently breaks the untouched Angular client | High | Default to additive-only on the wire; see question 1 |
| Relaxed `BusConnectionConfig`/`BusMessage` guards weaken real validation | Med | Every removed guard replaced by an explicit capability-aware rule with a test |
| Superset fields become permanently-null noise with no second broker landed | Med | Justify each optional field against the exploration's Kafka mapping; drop unjustified ones |
| Teardown-on-reconnect drops live subscriptions unexpectedly | Med | Specify the semantics explicitly; see question 3 |
| Wide ripple across Domain/Application forces a full `dotnet test` (Docker needed) | High | Expected; Infrastructure tests require Docker per project convention |

## Rollback Plan

Single backend refactor PR, no persisted state, no migrations, no frontend or infrastructure files. Reverting the PR restores the AMQP-shaped `BusConnectionConfig`/`BusMessage`, removes the capabilities endpoint, and returns `RabbitMqAdapter` to its prior (leaking) connect path. No consumer data is affected because the endpoint is additive and RabbitMQ behavior is unchanged.

## Dependencies

- Exploration `sdd/explore/kafka-multi-broker` (Option C accepted).
- GitHub issue #34 folded into this change rather than shipped separately.

## Success Criteria

- [ ] A capabilities endpoint returns a `BrokerCapabilities` descriptor including `supportsRequestReply: true` for RabbitMQ.
- [ ] `BusConnectionConfig` accepts a multi-server / credential-less shape and still accepts today's RabbitMQ input unchanged.
- [ ] `BusMessage` and `MessageReceivedDto` document a broker-neutral superset with broker-specific fields explicitly optional.
- [ ] Calling connect while already connected closes the prior connection and its subscriptions (issue #34 covered by a regression test).
- [ ] `ArchitectureTests` still proves Domain/Application never reference `RabbitMQ.Client`.
- [ ] Full `dotnet test` green; RabbitMQ send/subscribe/request-reply behavior observably identical.
- [ ] No `Confluent.Kafka`, no `docker-compose.yml`, no `frontend/` file changed.

## Proposal question round

Confirmed with the user (locked, not assumptions): smallest backend-only slice; no Kafka adapter, dependency, compose file, or frontend work; issue #34 in scope; `request-reply` gets a capability flag only, no neutral rewrite.

Open for the user before `sdd-spec` — each has a working assumption so the phase is not blocked:

1. **Wire compatibility.** The frontend is out of scope, so may the HTTP/SignalR payloads rename `exchange`/`routingKey`, or must the wire stay byte-compatible and neutralize additively (new optional fields, old names retained)? *Assumption: additive-only, no wire renames; internal type names may change.*
2. **Capabilities availability.** Should the capabilities endpoint answer before any connection exists (static per registered adapter), or only while connected? *Assumption: answerable any time, static per adapter, so a client can render before connecting.*
3. **Reconnect semantics.** On connect-while-connected, silently tear down and replace (dropping live subscriptions), or reject until an explicit disconnect? *Assumption: tear down and replace, with subscription loss documented as expected behavior.*
