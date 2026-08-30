# Design: Reply to a Received Message

## Technical Approach

Add a per-row "Responder" action to `MessagesComponent` that pushes a reply target
(`routingKey = replyTo`, `correlationId`) through a new root-provided signal service into
`SendComponent`, which pre-fills the existing Send panel in a dedicated "reply mode" that
publishes to the AMQP **default exchange**. Maps to the proposal's approach (reuse the Send
panel, service-based bridge) and the `request-reply` / `ui-presentation` deltas.

## Context

- `MessagesComponent` and `SendComponent` are root-provided siblings composed by `App` with no
  shared channel. Existing bridges: `SendHistoryService`, `ReplySubscriptionService`
  (`providedIn:'root'`, signal-based).
- Send panel uses one-way `[ngModel]` + signals, **no `NgForm`**. Feedback is spartan `toast`
  (sonner). No modal/dialog dependency in use, no existing `confirm()`.
- Replying to this app's own send-with-reply requests **requires** the default exchange: temp
  reply queues (`DeclareTemporaryReplyQueueAndSubscribeAsync`) are exclusive/autoDelete,
  server-named, bound only to `""`. Routing to a queue by name is only possible via `""`.
- Native AMQP `CorrelationId` is already wired end-to-end (`SendMessageUseCase` →
  `BusMessage.CorrelationId` → adapter `BasicProperties`); only FE `send()` omits it from the
  POST body. The reply panel matches on the **native** `correlationId`, not the
  `NServiceBus.CorrelationId` header.

## Scope Conflict — RESOLVED

The proposal originally scoped out all backend changes ("No backend files are touched" was a
success criterion). Code analysis showed the reply path **cannot** be frontend-only:

| Layer | Current behavior on `Exchange=""` | Needed |
|---|---|---|
| FE `SendComponent.exchangeError` | rejects blank | conditional suppress in reply mode |
| Domain `BusMessage` ctor | `IsNullOrWhiteSpace` → `ArgumentException` | allow exact `""` |
| Infra `RabbitMqAdapter.SendAsync` | `ExchangeDeclarePassiveAsync("")` → RabbitMQ `ACCESS_REFUSED` → `BusPublishException` | skip passive declare when `Exchange.Length == 0` |

**Resolution:** the user **accepted** the two minimal backend changes (Domain guard relax +
adapter passive-declare skip). Both are additive and a strict superset of current behavior. The
proposal's "no backend files are touched" criterion is superseded (see proposal §Confirmed
product decisions #5).

**Spike executed (orchestrator, live local broker) — PASS, matches predictions:**
- `ExchangeDeclarePassiveAsync("")` → `OperationInterruptedException` `code=403`,
  `ACCESS_REFUSED - operation not permitted on the default exchange`. The adapter MUST skip it.
- `BasicPublishAsync("", queueName, ...)` → routed by queue name, delivered, `CorrelationId`
  intact. Skipping the passive declare is **sufficient**; no other adapter change needed.

## Architecture Decisions

### Decision: Default-exchange mechanism

**Choice**: explicit `replyMode` signal in `SendComponent`. Set true by a reply pre-fill;
Exchange renders as a read-only "(intercambio predeterminado)" chip; `exchangeError` suppressed;
`send()` posts `exchange: ''`. Manually editing Exchange or Routing Key clears `replyMode`.
Domain allows exact `""`; adapter does `if (message.Exchange.Length == 0)` skip the passive
declare.
**Alternatives considered**: implicit special-case keyed on `replyTo` presence; global
validation weakening; an always-visible "publish to default exchange" toggle.
**Rationale**: explicit and discoverable, preserves the non-blank guard for ordinary sends,
smallest backend surface. Implicit special-casing is surprising; global weakening loses the
guardrail; an always-on toggle is YAGNI/scope creep.

### Decision: Dirty-check definition

**Choice**: dirty = current `{exchange, routingKey, payload, headers}` ≠ `lastAppliedSnapshot`.
The snapshot is captured after every programmatic fill (`useRecent`, `useTemplate`, reply
pre-fill) and after a successful `send()`; initialised to the empty baseline. A pristine empty
form is not dirty.
**Alternatives considered**: Angular `NgForm.dirty`; "any non-empty field".
**Rationale**: fits the signal model and means precisely "edits made or loaded since the last
apply". `NgForm` does not exist in this component and never resets on programmatic `.set()`;
"any non-empty field" over-prompts because a recalled recent send is non-empty but not unsaved
work.

### Decision: Overwrite-warning UX

**Choice**: native `window.confirm()` behind a `confirmOverwrite(): boolean` method seam
(spy-able in tests).
**Alternatives considered**: toast; spartan `AlertDialog`; custom modal.
**Rationale**: synchronous, blocking, zero-dependency, matches the app's minimal-ceremony
style. A toast is non-blocking and cannot capture confirm/decline; `AlertDialog` adds an unused
dependency and is heavy for an internal tool; a custom modal is scope creep. Trade-off (unstyled,
not E2E-friendly) is mitigated by the method seam.

### Decision: Cross-component state bridge

**Choice**: new `ReplyDraftService` (`providedIn:'root'`, signal-based, mirrors
`ReplySubscriptionService`).
**Alternatives considered**: host-level signal in `App` with `@Input`/`@Output`; `@Output`
EventEmitter wiring.
**Rationale**: the established project pattern; keeps the siblings decoupled and unit-testable.
`App` is a pure composition shell — prop-drilling between non-parent-child siblings would be a
regression from the current pattern.

### Decision: Null correlationId + Responder gating

**Choice**:
- Add a `correlationId` signal to `SendComponent`, included in the `POST /api/messages` body
  (native property; backend already supports it). Field visible only in `replyMode`. When the
  source message's `correlationId` is null: field left blank, `correlationId` omitted from the
  payload, Exchange + Routing Key still pre-fill.
- The Responder control is **hidden** when `replyTo` is null (not disabled).
**Alternatives considered**: route correlationId through the `NServiceBus.CorrelationId` header
field; render the Responder control disabled.
**Rationale**: the header field would not correlate with this app's reply panel (native match).
Hidden control: the live feed is dense and high-frequency; a permanently-disabled per-row button
adds noise and the action is meaningless without `replyTo`. `ui-presentation` allows either.

## Data Flow

```
MessagesComponent row (replyTo != null)
      | replyDraft.request({ routingKey: replyTo, correlationId })
      v
ReplyDraftService.draft  (signal, seq++)
      | effect()
      v
SendComponent: new seq? - dirty? -yes-> confirmOverwrite() -decline-> no-op
      |                                        | confirm
      v                                        v
  apply: replyMode=true, exchange='', routingKey, correlationId, payload=''
      | tester writes payload, submits
      v
POST /api/messages { exchange:'', routingKey, payload, correlationId, headers }
      v
SendMessageUseCase -> BusMessage('' allowed) -> RabbitMqAdapter.SendAsync
      | Exchange.Length == 0 -> skip ExchangeDeclarePassiveAsync
      v
BasicPublishAsync('', routingKey = replyTo)  -> default exchange routes by queue name
      v
original temp reply queue -> reply panel matches on subscriptionId + native correlationId
```

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/app/core/reply-draft.service.ts` | Create | Bridge service (see Interfaces) |
| `frontend/src/app/features/messages/messages.component.ts` / `.html` | Modify | Responder action, hidden unless `replyTo`; click → `replyDraft.request()` |
| `frontend/src/app/features/send/send.component.ts` / `.html` | Modify | `replyMode` + `correlationId` signals; `effect` on `draft`; dirty snapshot; `confirmOverwrite()`; POST body adds `correlationId`; Exchange chip in reply mode |
| `src/BusTester.Domain/BusMessage.cs` | Modify (pending user OK) | Allow exact `""` exchange; keep whitespace-only and null rejected |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modify (pending user OK) | Skip `ExchangeDeclarePassiveAsync` when `message.Exchange.Length == 0` |

## Interfaces / Contracts

```ts
export interface ReplyTarget {
  routingKey: string;          // the source message's replyTo
  correlationId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReplyDraftService {
  private readonly _draft = signal<{ target: ReplyTarget; seq: number } | null>(null);
  readonly draft = this._draft.asReadonly();

  /** seq++ each call so activating Responder twice (even same target) re-fires the effect. */
  request(target: ReplyTarget): void;
  clear(): void;
}
```

`POST /api/messages` body gains an optional `correlationId?: string` (already accepted by
`SendMessageRequest`; only the FE payload changes).

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (Vitest) | `ReplyDraftService.request` increments `seq`; `clear` nulls draft | service test |
| Unit (Vitest) | SendComponent effect applies target; dirty true/false cases; `confirmOverwrite` decline preserves form, confirm applies; null correlationId → blank + omitted; `replyMode` cleared on manual Exchange edit; `send()` posts `exchange:''` in reply mode | component test, spy `window.confirm` |
| Unit (Vitest) | MessagesComponent renders Responder only when `replyTo` present; click calls `replyDraft.request` | component test |
| Unit (xUnit) | `BusMessage` accepts `""`, still rejects `"  "` and null | domain test |
| Integration (xUnit, Docker) | `RabbitMqAdapter.SendAsync` with `Exchange=""` publishes; consumer on the named queue receives it with native `correlationId` | Testcontainers |
| Integration (xUnit, Docker) | Spike tests below | Testcontainers |

## Spike Plan — DONE (PASS)

The spike ran against the live local broker before `sdd-tasks`. Both predictions held:
passive declare of `""` throws `403 ACCESS_REFUSED`; a plain publish to `""` routed by queue
name and delivered with `CorrelationId` intact. Decision D1's adapter change (skip passive
declare when `Exchange.Length == 0`) is confirmed necessary and sufficient. The integration
tests below should be written for real during `sdd-apply` (Strict TDD), not carried as spike
scaffolding.

Original spike reference (kept for the apply phase's TDD tests):

```csharp
// tests/BusTester.Infrastructure.Tests/DefaultExchangeSpikeTests.cs
[Collection(nameof(RabbitMqCollection))]
public class DefaultExchangeSpikeTests(RabbitMqContainerFixture fixture)
{
    private ConnectionFactory Factory() => new()
    {
        HostName = fixture.Config.Host, Port = fixture.Config.Port,
        UserName = fixture.Config.Username, Password = fixture.Config.Password,
    };

    [Fact]
    public async Task PassiveDeclare_OfDefaultExchange_IsRefused()
    {
        await using var conn = await Factory().CreateConnectionAsync();
        await using var ch = await conn.CreateChannelAsync();
        var ex = await Assert.ThrowsAsync<OperationInterruptedException>(
            () => ch.ExchangeDeclarePassiveAsync(string.Empty));
        Assert.Contains("ACCESS_REFUSED", ex.Message);
    }

    [Fact]
    public async Task Publish_ToDefaultExchange_PassiveDeclareSkipped_RoutesByQueueName()
    {
        await using var conn = await Factory().CreateConnectionAsync();
        await using var ch = await conn.CreateChannelAsync();
        var q = (await ch.QueueDeclareAsync()).QueueName;
        await ch.BasicPublishAsync(string.Empty, q, false,
            new BasicProperties { CorrelationId = "spike-1" },
            System.Text.Encoding.UTF8.GetBytes("{\"spike\":true}"));
        BasicGetResult? got = null;
        for (var i = 0; i < 50 && got is null; i++) { got = await ch.BasicGetAsync(q, true); await Task.Delay(100); }
        Assert.NotNull(got);
        Assert.Equal("spike-1", got!.BasicProperties.CorrelationId);
    }
}
```

Run: `dotnet test tests/BusTester.Infrastructure.Tests --filter DefaultExchangeSpikeTests`
(Docker required).

- **PASS signals**: test 1 throws containing `ACCESS_REFUSED`; test 2 green. Confirms the
  current adapter breaks on `""` *only* at the passive declare and that skipping it is
  sufficient — proceed with the Decision D1 backend change.
- **FAIL signal A**: test 1 does not throw → this broker version permits passive declare of
  `""` → the adapter change is unnecessary; revisit D1 (FE + Domain still change).
- **FAIL signal B**: test 2 red → default-exchange routing assumption is wrong → design blocked,
  escalate to the user.

## Threat Matrix

N/A — no routing (HTTP/CLI), shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. AMQP exchange routing is message-broker data
flow, not covered by the matrix.

## Migration / Rollout

No migration. Additive UI action plus a widened Domain guard (accepts a strict superset of
today's inputs). Reverting the PR restores prior behavior; no persisted data or API shape
change.

## Open Questions

- [x] **RESOLVED**: user accepted the two backend changes (Domain guard relax + adapter
  passive-declare skip).
- [x] **RESOLVED**: spike executed by the orchestrator — PASS (see Spike Plan / Scope Conflict).
- [ ] NServiceBus `MessageIntent: Reply` header auto-tagging — proposal open question, still out
  of scope; not expected for this change unless the user says otherwise.
