# Tasks: Reply to a Received Message

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~470–560 (additions + deletions, tests included) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend) → PR 2 (bridge + Responder) → PR 3 (Send reply mode + confirm) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Domain + adapter accept `Exchange==""` (default exchange) | PR 1 | `dotnet test tests/BusTester.Domain.Tests` + `dotnet test tests/BusTester.Infrastructure.Tests --filter DefaultExchange` | Docker RabbitMQ integration test publishes to `""`, consumer on named queue receives with `correlationId` | `BusMessage.cs`, `RabbitMqAdapter.cs` guard lines + new tests |
| 2 | `ReplyDraftService` + Responder action wiring | PR 2 | `npm test -- --watch false src/app/core/reply-draft.service.spec.ts src/app/features/messages/messages.component.spec.ts` | Manual: click Responder on a `replyTo` row, draft signal fires | new `reply-draft.service.ts`, Responder markup in messages component |
| 3 | Send panel reply mode, correlationId, dirty-check, overwrite confirm | PR 3 | `npm test -- --watch false src/app/features/send/send.component.spec.ts` | Manual: pre-fill, edit, second Responder → `confirm()` prompt; submit posts `exchange:''` | `send.component.ts`/`.html` reply-mode + dirty + confirm blocks |

All phases strict-TDD sliced: RED (failing test) → GREEN (impl). Run the suite after each GREEN.

## Phase 1: Backend default-exchange support (PR 1)

- [x] 1.1 RED `BusMessageTests`: `Create_WithEmptyExchange_Succeeds` (exact `""` → `Exchange==""`); move `[InlineData("")]` off `Create_WithMissingExchange...` so `null`/`"   "` still throw.
- [x] 1.2 GREEN `src/BusTester.Domain/BusMessage.cs`: replace exchange `IsNullOrWhiteSpace` guard with reject-null + reject-whitespace-only, allow exact `""`.
- [x] 1.3 RED `tests/BusTester.Infrastructure.Tests/DefaultExchangeTests.cs` (Collection `RabbitMqCollection`): (a) `ExchangeDeclarePassiveAsync("")` throws `OperationInterruptedException` with `ACCESS_REFUSED`; (b) `_adapter.SendAsync` `Exchange=""`, `RoutingKey`=declared queue, `CorrelationId` set → `BasicGetAsync` returns body with matching `CorrelationId`.
- [x] 1.4 GREEN `RabbitMqAdapter.SendAsync`: guard the passive declare with `if (message.Exchange.Length != 0)`.

## Phase 2: ReplyDraftService bridge (PR 2)

- [x] 2.1 RED `frontend/src/app/core/reply-draft.service.spec.ts`: `request(target)` sets `draft()` and increments `seq` per call (same target twice → seq 1,2); `clear()` nulls it.
- [x] 2.2 GREEN create `frontend/src/app/core/reply-draft.service.ts` per design Interfaces (`ReplyTarget`, `_draft` signal `{target,seq}|null`, `request`, `clear`, `providedIn:'root'`).

## Phase 3: MessagesComponent Responder action (PR 2)

- [x] 3.1 RED `messages.component.spec.ts`: row with non-null `replyTo` renders Responder control; null `replyTo` → no control (hidden).
- [x] 3.2 RED `messages.component.spec.ts`: clicking Responder calls `ReplyDraftService.request({ routingKey: msg.replyTo, correlationId: msg.correlationId })`.
- [x] 3.3 GREEN inject `ReplyDraftService`, add `respond(msg)` in `messages.component.ts`; add Responder button in `messages.component.html` row action group under `@if (msg.replyTo)`, reusing existing action + responsive classes (no clipping at ~375px).

## Phase 4: SendComponent reply mode + correlationId (PR 3)

- [x] 4.1 RED `send.component.spec.ts`: draft effect with new seq applies `replyMode=true`, `exchange=''`, `routingKey`, `correlationId = target.correlationId ?? ''`, `payload=''`.
- [x] 4.2 RED: in `replyMode`, `exchangeError()` null for exactly `''` but set for `'  '`; outside `replyMode`, `''` still errors.
- [x] 4.3 RED: editing `exchange` or `routingKey` clears `replyMode`; `''` exchange error returns.
- [x] 4.4 RED: `send()` in `replyMode` posts `exchange: ''` and adds `correlationId` to the `/api/messages` body; blank/null correlationId → key omitted.
- [x] 4.5 GREEN `send.component.ts`: add `replyMode` + `correlationId` signals; add `effect` on `replyDraft.draft()` tracking last applied `seq`; reply-mode branch in `exchangeError`; clear `replyMode` on exchange/routingKey edits; extend `send()` payload.
- [x] 4.6 GREEN `send.component.html`: read-only "(intercambio predeterminado)" Exchange chip and Correlation ID field shown only when `replyMode()`.

## Phase 5: Dirty-check + overwrite confirmation (PR 3)

- [ ] 5.1 RED `send.component.spec.ts`: snapshot captured after `useRecent`, `useTemplate`, reply pre-fill, successful `send()`; pristine empty form not dirty; typing payload → dirty.
- [ ] 5.2 RED: dirty panel + new draft seq calls `confirmOverwrite()`; false → form + `replyMode` unchanged; true → new target applied.
- [ ] 5.3 RED: clean panel + new draft seq → `confirmOverwrite()` not called, pre-fill applies.
- [ ] 5.4 GREEN: add `lastAppliedSnapshot` signal + `isDirty()` computed over `{exchange,routingKey,payload,headers}`; `captureSnapshot()` in `useRecent`/`useTemplate`/reply-apply/`send()` success; init to empty baseline.
- [ ] 5.5 GREEN: add `confirmOverwrite(): boolean` wrapping `window.confirm`; gate reply-apply on `isDirty() ? confirmOverwrite() : true`.

## Phase 6: Verification

- [ ] 6.1 Every scenario in `specs/request-reply/spec.md` and `specs/ui-presentation/spec.md` has a covering test; `dotnet test` + `npm test -- --watch false` green.
- [ ] 6.2 Manual smoke: Responder → author payload → send → reply lands on the original temp queue with matching `correlationId`.
