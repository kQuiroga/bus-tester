# Proposal: Request-Reply Headers (Phase A of request-reply-support)

## Intent

BusTester's send path has no `BasicProperties` support: `RabbitMqAdapter.SendAsync` calls the 4-arg `BasicPublishAsync` overload with no properties object, so a developer cannot set `ReplyTo`/`CorrelationId` when publishing, and `BusMessage` has no headers concept at all. This blocks any RPC-style testing workflow (raw AMQP request-reply, as used by RabbitMQ's own tutorials and respected by MassTransit/NServiceBus/Rebus). Phase A ships the missing foundation — ReplyTo/CorrelationId as first-class, optional, backward-compatible fields through Domain → Application → Infrastructure → API — so the primitive exists and is provable via the API before Phase B builds the temp-reply-queue/UI experience on top of it.

## Scope

### In Scope
- `BusMessage` (Domain): optional `ReplyTo`/`CorrelationId` fields, existing 3-arg construction unaffected.
- `SendMessageCommand`/`SendMessageUseCase` (Application): thread optional ReplyTo/CorrelationId end to end.
- `RabbitMqAdapter.SendAsync` (Infrastructure): use the `BasicPublishAsync` overload with `BasicProperties` to set `ReplyTo`/`CorrelationId` when supplied.
- `RabbitMqAdapter` receive path: read `ReplyTo`/`CorrelationId` off incoming `IReadOnlyBasicProperties` and surface them on the received-message data made available to callers (API/SignalR payload), so a reply's properties are provably observable end to end without new UI.
- `MessagesController` Send request DTO: optional ReplyTo/CorrelationId fields.
- Unit/integration tests per Strict TDD across all touched layers; update existing fakes (`FakeBusPort`, `StubBusPort`) as needed.

### Out of Scope (deferred to Phase B — `request-reply-support` follow-up)
- Auto-declared exclusive/auto-delete temp reply queue (`QueueDeclareAsync`).
- Auto-subscribe to that temp queue after send, and correlation-id-based matching in `SubscriptionCoordinator`.
- Any Angular/frontend changes (Send form fields, reply panel, messages feed).
- Framework-specific reply semantics (MassTransit/NServiceBus/Rebus) — raw AMQP only.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `message-sending`: new requirement — sending a message MAY include optional ReplyTo/CorrelationId, published via `BasicProperties`; omitting them is unchanged existing behavior.
- `message-consumption`: new requirement — a received message's ReplyTo/CorrelationId (if present) MUST be exposed on the data returned to subscribers, without any new correlation/matching logic.

## Approach

Extend `BusMessage` with nullable `ReplyTo`/`CorrelationId`; thread them through `SendMessageCommand` → `SendMessageUseCase` → `IBusPort.SendAsync` unchanged in signature shape (broker-agnostic). `RabbitMqAdapter` builds a `BasicProperties` object only when either field is set and calls the properties-aware `BasicPublishAsync` overload; otherwise keeps today's 4-arg call to avoid behavior drift. On the consume side, the adapter reads `IReadOnlyBasicProperties.ReplyTo`/`CorrelationId` from each delivery and includes them (nullable) in whatever payload the Application layer already forwards to the API/broadcaster.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/BusTester.Domain/BusMessage.cs` | Modified | Add optional ReplyTo/CorrelationId |
| `src/BusTester.Application/UseCases/SendMessageCommand.cs`, `SendMessageUseCase.cs` | Modified | Thread optional fields |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modified | `BasicProperties`-aware publish; read properties on receive |
| `src/BusTester.Api/Controllers/MessagesController.cs` | Modified | Optional ReplyTo/CorrelationId on Send DTO |
| `tests/*` (Adapter/UseCase/Fake tests) | Modified | Cover new optional fields, backward compatibility |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing 3-field `BusMessage` construction / existing tests | Low | Fields are nullable/optional with defaults; run full existing suite before merge |
| Scope creep into UI or temp-queue work | Med | Explicit out-of-scope list; Phase B tracked as separate change |
| Ambiguity on whether API layer is in scope for Phase A | Med | See Proposal question round below |

## Rollback Plan

All new fields are additive and optional; reverting the PR removes them with no impact on existing send/subscribe behavior, since no default call site starts passing them.

## Dependencies

- None external. Builds on `RabbitMQ.Client` 7.* already referenced in `BusTester.Infrastructure.csproj`.

## Success Criteria

- [ ] Sending with ReplyTo+CorrelationId sets `BasicProperties` correctly on the published AMQP message (verified via RabbitMQ management UI or integration test)
- [ ] Sending without these fields is behaviorally identical to today
- [ ] A received message exposes ReplyTo/CorrelationId when present in incoming properties
- [ ] Existing adapter/use-case/fake tests pass with only additive changes
- [ ] No Angular/frontend files are touched in this change

## Proposal question round

The following would sharpen this proposal; answers welcome, or skip to proceed with the stated assumptions.

1. **Layer boundary conflict**: the task brief says Phase A goes "through Domain → Application → Infrastructure"; the recorded sequencing decision (Engram #127) says "through Domain → Application → Infrastructure → API." **Assumption used above**: API is in scope (MessagesController Send DTO gets the optional fields), so the feature is testable via the real HTTP API without waiting on Phase B's UI. Confirm, or restrict Phase A to backend-internal (Domain/Application/Infrastructure) only.
2. **Field coupling**: should CorrelationId be usable independently of ReplyTo (e.g., correlation-only, no reply expected), or should they be validated/required together? **Assumption**: fully independent optional fields, no coupling validation — matches how AMQP `BasicProperties` itself treats them.
3. **Receive-side visibility**: should the received-message payload expose ReplyTo/CorrelationId to any consumer (API/SignalR) even with no dedicated UI, so the data is provably observable end-to-end via tools like Postman/tests? **Assumption**: yes — "no UI auto-correlation" (per the sequencing decision) means no correlation/matching UI, not that the data is hidden from every response.
4. **Validation rules**: any format/length constraints on ReplyTo (queue name) or CorrelationId? **Assumption**: none beyond AMQP's own short-string limits — pass through as opaque optional strings.

## Key Learnings

1. RabbitMqAdapter.SendAsync currently calls the four-argument BasicPublishAsync overload with no BasicProperties object.
2. BusMessage carries only Exchange, RoutingKey, and Payload today, with no headers or properties concept in Domain.
3. RabbitMQ.Client version 7.x exposes a BasicPublishAsync overload accepting a BasicProperties object with ReplyTo and CorrelationId.
4. The user already decided request-reply-support splits into two sequential SDD changes, Phase A then Phase B.
5. Phase A explicitly excludes any Angular frontend changes per the recorded sequencing decision in Engram observation 127.
