# Design: Request-Reply Support Phase B (temp reply queue, auto-subscribe, RPC UI)

## Technical Approach

Ship exploration's Approach 1 (client-correlated auto-subscribe, thin server). Add one new
broker-agnostic `IBusPort` method that declares a temporary, subscriber-scoped reply queue and
subscribes to it in a single call, reusing `SubscriptionCoordinator`/SignalR broadcast unchanged.
A new use case wires this into send: subscribe first (race-safe, mirrors `SubscribeUseCase`'s
null-handle-closure pattern), generate `CorrelationId` server-side if blank, set `ReplyTo` to the
declared queue, send, return `{subscriptionId, correlationId}` non-blocking. Existing
`SubscriptionsController` DELETE (`UnsubscribeUseCase`) is reused verbatim for tearing down reply
subscriptions — no new unsubscribe endpoint. Frontend gains a shared `ReplySubscriptionService`
so `SendComponent` (which starts a reply wait) and `MessagesComponent` (which renders it) can
coordinate without a `kind` discriminator on the existing chip model.

## Architecture Decisions

### Decision: Dedicated port method vs. flags on `SubscriptionRequest`

**Choice**: New `IBusPort.DeclareTemporaryReplyQueueAndSubscribeAsync(onMessage, ct)` returning
`Task<(SubscriptionHandle Handle, string QueueName)>`. `SubscribeAsync`/`SubscriptionRequest` are
untouched.
**Alternatives considered**: Add `bool Exclusive`/`bool AutoDelete` + nullable `QueueName` to
`SubscriptionRequest`.
**Rationale**: "Exclusive"/"auto-delete" are AMQP queue-property vocabulary, not a behavior a
future Kafka adapter can express the same way. A dedicated method names the *behavior* ("a
temporary queue scoped to and cleaned up with this one subscriber") and lets each adapter satisfy
it however fits its broker. It also leaves the proven fixed-queue path with zero surface change.

### Decision: Subscribe-before-send ordering, with unsubscribe-on-send-failure

**Choice**: New use case declares+subscribes first, then sends. If `SendAsync` throws, it calls
`UnsubscribeAsync` + `Unregister` on the just-created handle before rethrowing.
**Alternatives considered**: Send first, then subscribe (simpler, but a reply could arrive before
the subscription exists on a fast broker); leave the orphaned queue for the deferred cleanup
follow-up.
**Rationale**: Matches `SubscribeUseCase`'s existing race-safety pattern. Cleaning up a doomed
temp queue on synchronous send failure is a same-request, in-scope fix — not the deferred
cross-request timeout/cleanup registry (proposal question 4 only covers unreachable/abandoned
queues after a successful send).

### Decision: No `kind` discriminator; separate `ReplySubscriptionService`

**Choice**: A frontend-only `core/reply-subscription.service.ts` (root-provided signal service,
mirrors existing `SendHistoryService` pattern) tracks pending `{subscriptionId, correlationId}`
pairs; `MessagesComponent` filters `busHub.messages()` by `correlationId` for its reply panel.
**Alternatives considered**: Tag chips with `kind: 'manual' | 'reply'` in `SubscriptionCoordinator`
or the existing `Subscription` interface.
**Rationale**: Confirmed decision 3 — fully separate panel, no discriminator on the coordinator or
chip UI.

## Data Flow

    SendComponent (expectReply=true)
        │ POST /api/messages/with-reply {exchange, routingKey, payload}
        ▼
    MessagesController.SendWithReply → SendMessageWithReplyUseCase
        │ 1. busPort.DeclareTemporaryReplyQueueAndSubscribeAsync(OnMessage)
        │ 2. coordinator.Register(handle)
        │ 3. generate CorrelationId if blank; new BusMessage(..., ReplyTo=queueName, CorrelationId)
        │ 4. busPort.SendAsync(message)  — on throw: Unsubscribe+Unregister, rethrow
        ▼
    {subscriptionId, correlationId} ──→ SendComponent
        │ busHub.joinSubscription(subscriptionId); replySubscriptions.add({subscriptionId, correlationId})
        ▼
    [reply arrives on RabbitMQ] → RabbitMqAdapter consumer → coordinator.OnMessageReceivedAsync
        → SignalR "MessageReceived" (MessageReceivedDto already carries ReplyTo/CorrelationId)
        ▼
    BusHubService.messages (ReceivedMessage now typed with replyTo/correlationId)
        ▼
    MessagesComponent.replyPanel — filters by correlationId ∈ replySubscriptions.pending()

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `src/BusTester.Application/Ports/IBusPort.cs` | Modify | Add `DeclareTemporaryReplyQueueAndSubscribeAsync` |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modify | Implement via `QueueDeclareAsync` + shared consumer-wiring helper |
| `src/BusTester.Application/UseCases/SendMessageWithReplyCommand.cs` | Create | Command record |
| `src/BusTester.Application/UseCases/SendMessageWithReplyUseCase.cs` | Create | Use case per Data Flow |
| `src/BusTester.Api/Controllers/MessagesController.cs` | Modify | New `POST /api/messages/with-reply` |
| `tests/BusTester.Application.Tests/Fakes/FakeBusPort.cs` | Modify | Implement new port method; add `UnsubscribedHandles` tracking |
| `tests/BusTester.Api.Tests/Testing/StubBusPort.cs` | Modify | Implement new port method |
| `frontend/src/app/core/bus-hub.service.ts` | Modify | `ReceivedMessage` gains `replyTo?`, `correlationId?` |
| `frontend/src/app/core/reply-subscription.service.ts` | Create | Shared pending-reply state |
| `frontend/src/app/features/send/send.component.ts(.html)` | Modify | "Expect a reply" toggle, calls with-reply endpoint |
| `frontend/src/app/features/messages/messages.component.ts(.html)` | Modify | New reply panel, correlation-filtered |

## Interfaces / Contracts

```csharp
// IBusPort — new method, existing three unchanged
Task<(SubscriptionHandle Handle, string QueueName)> DeclareTemporaryReplyQueueAndSubscribeAsync(
    Func<BusMessage, CancellationToken, Task> onMessage,
    CancellationToken ct = default);

// RabbitMqAdapter — first QueueDeclareAsync call in the codebase
var declareOk = await channel.QueueDeclareAsync(
    queue: string.Empty, durable: false, exclusive: true, autoDelete: true,
    arguments: null, cancellationToken: ct);
// then reuse the SubscribeAsync consumer-wiring helper with declareOk.QueueName

// Application
public sealed record SendMessageWithReplyCommand(
    string Exchange, string RoutingKey, string Payload, string? CorrelationId = null);
public sealed record SendWithReplyResult(SubscriptionHandle SubscriptionId, string CorrelationId);

// Api (MessagesController)
POST /api/messages/with-reply
  Request:  { exchange, routingKey, payload, correlationId? }
  Response: { subscriptionId: Guid, correlationId: string }
// Reply teardown reuses existing DELETE /api/subscriptions/{id} — no new endpoint.
```

```typescript
// bus-hub.service.ts
export interface ReceivedMessage {
  subscriptionId: string; exchange: string; routingKey: string; payload: string;
  replyTo?: string; correlationId?: string; seq: number;
}

// reply-subscription.service.ts
export interface ReplySubscription { subscriptionId: string; correlationId: string; }
@Injectable({ providedIn: 'root' })
export class ReplySubscriptionService {
  readonly pending = signal<ReplySubscription[]>([]).asReadonly(); // add()/remove(subscriptionId)
}
```

SignalR/`MessageReceivedDto` payload: **no change** — Phase A already sends `ReplyTo`/
`CorrelationId` on the wire; only the frontend TS type was dropping them.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Domain | None (unchanged) | — |
| Application (xUnit) | `SendMessageWithReplyUseCase`: CorrelationId generation-when-blank, pass-through-when-set, ReplyTo=queueName, subscribe-before-send ordering, unsubscribe-on-send-failure | `FakeBusPort` updated to implement new method + track `UnsubscribedHandles` |
| Infrastructure (xUnit + Testcontainers) | Real `QueueDeclareAsync(exclusive:true, autoDelete:true)` produces a broker-generated name; publishing to it via `ReplyTo` delivers to the same consumer; queue disappears after channel close | `RabbitMqAdapterTests` pattern (live broker, throwaway names) |
| Api (xUnit, `StubBusPort`) | `POST /api/messages/with-reply` returns `{subscriptionId, correlationId}`; blank vs. supplied `correlationId` | `StubBusPort` updated to implement new method |
| Frontend (Jasmine/Karma) | `ReceivedMessage`/`IncomingMessage` carry `replyTo`/`correlationId`; `ReplySubscriptionService` add/remove; `SendComponent` posts to with-reply endpoint and registers the pending reply on toggle-on; `MessagesComponent` reply panel filters by `correlationId`, unsubscribe removes it | Existing component-spec conventions (fake `BUS_HUB_CONNECTION`, `HttpTestingController`) |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary; this is application-level AMQP queue declaration through the
existing broker client.

## Migration / Rollout

No migration required. All additions are new methods/endpoints/UI; no existing call site is
modified to require them. Rollback = revert the new files/methods; existing send/subscribe/
broadcast flow is untouched.

## Open Questions

None — all 5 proposal assumptions were confirmed by the user (2026-08-26). Deferred out of scope
per proposal: server-owned pending-reply timeout/cleanup registry (future follow-up change).
