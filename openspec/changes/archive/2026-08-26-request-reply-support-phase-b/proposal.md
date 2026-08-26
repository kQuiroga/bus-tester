# Proposal: Request-Reply Support Phase B (temp reply queue, auto-subscribe, RPC UI)

## Intent

Phase A (`archive/2026-08-26-request-reply-headers`) shipped optional ReplyTo/CorrelationId as opaque passthrough fields through Domain -> Application -> Infrastructure -> API, with zero temp-queue, auto-subscribe, or UI logic by design. Today a BusTester user cannot actually exercise request-reply: there is no way to declare a temporary reply queue, no way to auto-subscribe to it after sending, and the frontend silently drops the `replyTo`/`correlationId` fields Phase A already puts on the wire (`bus-hub.service.ts`'s `ReceivedMessage` interface omits them). This blocks the RPC-style testing workflow BusTester exists to support (raw AMQP request-reply, as used by RabbitMQ's own tutorials). Phase B closes this gap: a user can send a message, have BusTester auto-create and auto-subscribe to a temp reply queue, and see the matched reply pushed live in the UI.

## Scope

### In Scope
- `IBusPort`/`SubscriptionRequest` (Application): new capability to declare an exclusive/auto-delete queue with a broker-generated name and subscribe to it in one call — reusing the existing subscribe/broadcast path, not a new registry.
- New send-with-reply use case: sets `ReplyTo` to the declared temp queue name, generates `CorrelationId` if the caller omitted it, sends, and returns `{subscriptionId, correlationId}` immediately (non-blocking, push model).
- `RabbitMqAdapter`: first `QueueDeclareAsync` call in the codebase; compose declare-then-consume for the temp queue.
- `MessagesController`/`SubscriptionsController` (API): endpoint(s) exposing send-with-reply.
- Frontend: `bus-hub.service.ts` `ReceivedMessage` gains `replyTo`/`correlationId` (data already on the wire since Phase A, currently dropped).
- Frontend: Send component gets an "expect a reply" toggle; Messages component gets a dedicated reply panel (separate from the subscription-chip list) that filters by `correlationId`.
- Unit/integration tests per Strict TDD across all touched layers (xUnit incl. Testcontainers; Jasmine/Karma).

### Out of Scope (deferred to a later follow-up change)
- Server-owned pending-reply registry with timeout enforcement and proactive cleanup (approach 3's differentiator over approach 1). Interim behavior: no automatic cleanup if the UI never unsubscribes; timeout, if any, is client-side `setTimeout` + explicit unsubscribe, which is unreliable across tab close/navigation. This is a deliberate, time-boxed interim gap, not a silent one.
- Blocking-HTTP synchronous RPC (approach 2) — rejected, fights the app's all-push/SignalR architecture.
- Framework-specific reply semantics (MassTransit/NServiceBus/Rebus) — raw AMQP only.
- Any change to Phase A's header plumbing itself.

## Capabilities

### New Capabilities
- `request-reply`: send-with-reply flow — declaring a temp exclusive/auto-delete queue, auto-subscribing to it, generating a CorrelationId when absent, and returning `{subscriptionId, correlationId}` for client-side reply observation.

### Modified Capabilities
- `message-consumption`: `ReceivedMessage`/`IncomingMessage` (frontend) MUST expose `replyTo`/`correlationId` fields already present on the wire DTO; a reply panel MUST filter delivered messages by `correlationId` distinct from the ordinary subscription-chip feed.
- `message-sending`: sending MAY request a reply, which auto-creates a temp queue and auto-subscribes instead of requiring a pre-existing queue name.

## Approach

Extend `IBusPort` with a declare-and-subscribe capability (server-generated exclusive/auto-delete queue name), keeping `BasicProperties`/broker-specific types out of the port per its existing boundary discipline. `RabbitMqAdapter` implements this with `QueueDeclareAsync` followed by the existing `BasicConsumeAsync` path — `SubscriptionCoordinator` is untouched, since it just broadcasts as normal. A new use case wires this into send: set `ReplyTo` to the declared queue, generate `CorrelationId` if blank, send, return `{subscriptionId, correlationId}` right away (non-blocking). The frontend joins that subscription's SignalR group like an ordinary chip but renders it in a dedicated reply panel, filtering `busHub.messages()` by `correlationId` client-side. This is approach 1 from exploration, shipped as the initial slice; approach 3's server-side timeout/cleanup registry is explicitly deferred, not silently dropped.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/BusTester.Application/Ports/IBusPort.cs` | Modified | New declare-and-subscribe method (broker-agnostic shape) |
| `src/BusTester.Application/Ports/SubscriptionRequest.cs` | Modified | Support broker-generated queue name + exclusive/auto-delete flags |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modified | First `QueueDeclareAsync` call; declare-then-consume composition |
| `src/BusTester.Application/UseCases/` | New | Send-with-reply use case (CorrelationId generation, ReplyTo wiring) |
| `src/BusTester.Api/Controllers/MessagesController.cs`, `SubscriptionsController.cs` | Modified | Endpoint(s) for send-with-reply, returning `{subscriptionId, correlationId}` |
| `frontend/src/app/core/bus-hub.service.ts` | Modified | `ReceivedMessage` gains `replyTo`/`correlationId` |
| `frontend/src/app/features/send/send.component.ts(.html)` | Modified | "Expect a reply" toggle |
| `frontend/src/app/features/messages/messages.component.ts(.html)` | Modified | New reply panel, correlation-filtered |
| `tests/*`, frontend specs | Modified/New | Cover new declare/subscribe path, use case, and UI per Strict TDD |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Resource leak: abandoned temp queues/channels never cleaned up if UI never unsubscribes | Med | Documented as deliberate interim scope; follow-up change tracked for server-owned timeout/cleanup registry |
| Multi-layer touch (Domain/Application/Infrastructure/API/Frontend) exceeds 400-line review budget in one PR | Med | Chained/stacked PR slices at `sdd-tasks` time |
| `IBusPort` boundary leak (broker-specific declare semantics) | Low | Keep declare method broker-agnostic in signature shape, mirroring Phase A's `BusMessage`-carries-fields pattern |
| Ambiguity on CorrelationId generation site, timeout, chip-vs-panel UI, disconnect cleanup, multi-reply handling | Med | See Proposal question round below |

## Rollback Plan

All new server-side capability is additive (new port method, new use case, new endpoint); reverting removes them without affecting existing send/subscribe/broadcast behavior, since no existing call site is modified to require them. Frontend changes (new fields, toggle, panel) are additive UI; reverting drops the panel and toggle with no impact on the existing chip-based subscription flow.

## Dependencies

- Phase A (`request-reply-headers`, shipped) — ReplyTo/CorrelationId plumbing this phase builds on.
- `RabbitMQ.Client` 7.* (already referenced) — `QueueDeclareAsync` API.

## Success Criteria

- [ ] A user can send a message with "expect a reply" checked and see a temp queue auto-declared and auto-subscribed
- [ ] A matching reply (same `CorrelationId`) is pushed live into a dedicated reply panel, distinct from the subscription-chip feed
- [ ] `ReceivedMessage` on the frontend exposes `replyTo`/`correlationId` for every incoming message
- [ ] Existing manual subscription (fixed queue name) flow is unaffected
- [ ] No server-side timeout/cleanup registry is introduced in this change (explicitly deferred)

## Proposal question round

The following would sharpen this proposal; answers welcome, or skip to proceed with the stated assumptions.

1. **CorrelationId generation location**: should `CorrelationId` be generated server-side (in the new use case, e.g. `Guid.NewGuid()`) when the user checks "expect a reply" but leaves it blank, or client-generated in Angular before the POST? **Assumption**: server-side generation in the use case — matches Phase A's framing of CorrelationId as an opaque field with no generation logic yet, and keeps the client thin.
2. **Timeout duration and enforcement side**: should there be any timeout at all in this interim (no-cleanup) slice, and if so, is it a fixed default or user-configurable field, enforced via client `setTimeout`? **Assumption**: no timeout in this slice — timeout/cleanup is explicitly deferred to the follow-up registry change; the panel simply shows "no reply yet" indefinitely until the user manually unsubscribes.
3. **Chip-list vs. separate panel**: should auto-created reply subscriptions ever appear in the existing subscription-chip list (with a `kind` discriminator), or must they be a fully separate reply panel? **Assumption**: fully separate panel, per the task brief's explicit ask — no discriminator added to `SubscriptionCoordinator` or the chip UI in this phase.
4. **Cleanup on abrupt disconnect**: does RabbitMQ's auto-delete-on-consumer-cancel (exclusive + auto-delete queue) suffice alone for this interim slice, or does the app also need to proactively unsubscribe on browser tab close/SignalR disconnect? **Assumption**: RabbitMQ's auto-delete alone suffices for this slice; app-level proactive cleanup is part of the deferred follow-up registry, not this change.
5. **Multiple replies per CorrelationId**: if more than one message arrives on the same exclusive temp queue before the user unsubscribes, should BusTester document "only the first is processed" or actively guard against it? **Assumption**: document as unguarded — all messages on the temp queue are delivered to the reply panel (filtered by matching `correlationId`); no first-only enforcement in this slice.

## Key Learnings

1. RabbitMqAdapter has no QueueDeclareAsync call anywhere; SubscribeAsync assumes queues pre-exist.
2. SubscriptionCoordinator is a dumb broadcast registry with zero correlation-id or timeout logic today.
3. Frontend ReceivedMessage interface already drops replyTo and correlationId fields sent since Phase A.
4. Exploration recommended approach 1 first, deferring approach 3's timeout/cleanup registry as follow-up.
5. Existing openspec capabilities are bus-connection, connection-status, ui-presentation, message-sending, message-consumption.
