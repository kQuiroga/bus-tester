# Apply Progress: Reply to a Received Message

Store: hybrid. Mirror of Engram topic `sdd/reply-to-message/apply-progress`.
Mode: Strict TDD (backend `dotnet test`; frontend `npx ng test --watch=false --include='<glob>'`).

## Batch 1 — PR1 / Phase 1: Backend default-exchange support

Branch: `feat/reply-to-message-backend` (stacked-to-main, chain PR 1 of 3).

### Completed tasks

- [x] 1.1 RED `BusMessageTests`: added `Create_WithEmptyExchange_Succeeds`; removed `[InlineData("")]` from `Create_WithMissingExchange_ThrowsArgumentException` (null / `"   "` still throw).
- [x] 1.2 GREEN `BusMessage.cs`: exchange guard split into reject-null + reject-whitespace-only, allowing exact `""`. RoutingKey and Payload guards unchanged.
- [x] 1.3 RED `tests/BusTester.Infrastructure.Tests/DefaultExchangeTests.cs` (Collection `RabbitMqCollection`, Testcontainers):
  - `ExchangeDeclarePassiveAsync_ForDefaultExchange_ThrowsAccessRefused` — passive declare of `""` throws `OperationInterruptedException` containing `ACCESS_REFUSED`.
  - `SendAsync_WithEmptyExchange_RoutesByQueueName_AndPreservesCorrelationId` — `SendAsync(new BusMessage("", queue, payload, correlationId))` → `BasicGetAsync` returns body with matching `CorrelationId`.
- [x] 1.4 GREEN `RabbitMqAdapter.SendAsync`: passive declare wrapped in `if (message.Exchange.Length != 0)`.

### Files changed

| File | Action | What |
|------|--------|------|
| `src/BusTester.Domain/BusMessage.cs` | Modified | Allow exact empty exchange; keep null + whitespace-only rejection |
| `tests/BusTester.Domain.Tests/BusMessageTests.cs` | Modified | New fact + moved `""` off the throwing theory |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modified | Skip passive declare when `Exchange.Length == 0` |
| `tests/BusTester.Infrastructure.Tests/DefaultExchangeTests.cs` | Created | Default-exchange integration coverage |
| `openspec/changes/reply-to-message/tasks.md` | Modified | Marked 1.1–1.4 `[x]` |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `BusMessageTests.cs` | Unit | 35/35 pass | `Create_WithEmptyExchange_Succeeds` failed `ArgumentException: Exchange is required` | 35/35 pass | Covered by retained `null` / `"   "` theory cases (both still throw) | Added intent comment; guard uses `Trim().Length == 0` |
| 1.3/1.4 | `DefaultExchangeTests.cs` | Integration (Docker) | 13/13 pass (existing infra suite) | `SendAsync_WithEmptyExchange...` failed `BusPublishException` ← `ACCESS_REFUSED` on passive declare | 15/15 pass | Characterization test (a) proves broker refuses passive declare; behavior test (b) proves routing + correlationId | None needed — one-line guard |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command / result | `dotnet test tests/BusTester.Domain.Tests` → 35 passed, 0 failed. `dotnet test tests/BusTester.Infrastructure.Tests` → 15 passed, 0 failed |
| Runtime harness command / result | `DefaultExchangeTests.SendAsync_WithEmptyExchange_RoutesByQueueName_AndPreservesCorrelationId` — live RabbitMQ container, publish to `""` routed by queue name, `BasicGetAsync` returned body + `corr-default-123`. Passed. |
| Rollback boundary | Revert `BusMessage.cs` guard, `RabbitMqAdapter.cs` guard, delete `DefaultExchangeTests.cs`, restore `[InlineData("")]` in `BusMessageTests.cs`. Commits `4cf38a7` + `4494ac5`. No unrelated code touched. |

### Commits

- `4cf38a7` feat(domain): allow empty exchange for default-exchange publish
- `4494ac5` feat(infra): publish to default exchange without passive declare

### Deviations from design

None. Matches D1 backend decision (allow exact `""`, skip passive declare). Design mentioned `if (message.Exchange.Length == 0) skip`; tasks.md specified `if (message.Exchange.Length != 0) { declare }` — equivalent, tasks.md form used.

## Batch 2 — PR2 / Phases 2+3: ReplyDraftService bridge + MessagesComponent Responder action

Branch: `feat/reply-to-message-bridge` (stacked on `feat/reply-to-message-backend`, chain PR 2 of 3).
Mode: Strict TDD (`npx ng test --watch=false --include='<glob>'` → `@angular/build:unit-test` / vitest 4).

### Completed tasks

- [x] 2.1 RED `frontend/src/app/core/reply-draft.service.spec.ts`: `request(target)` sets `draft()` `{target, seq}`; same target twice → seq 1 then 2; different targets keep incrementing; `clear()` nulls it; starts null.
- [x] 2.2 GREEN `frontend/src/app/core/reply-draft.service.ts`: `ReplyTarget { routingKey: string; correlationId: string | null }`; private `_draft = signal<{ target: ReplyTarget; seq: number } | null>(null)`; `readonly draft = _draft.asReadonly()`; `request(target)` bumps `seq` via `(current?.seq ?? 0) + 1`; `clear()` sets null; `@Injectable({ providedIn: 'root' })`. Mirrors `ReplySubscriptionService`.
- [x] 3.1 RED `messages.component.spec.ts`: feed row whose message has non-null `replyTo` renders a `aria-label^="Responder a"` control; row without `replyTo` renders none.
- [x] 3.2 RED `messages.component.spec.ts`: clicking the row Responder calls `ReplyDraftService.request({ routingKey: msg.replyTo, correlationId: msg.correlationId })`; triangulated with a message lacking `correlationId` → called with `correlationId: null`.
- [x] 3.3 GREEN `messages.component.ts`: inject `ReplyDraftService`, add `respond(message)` (guards on `replyTo`, normalizes `correlationId ?? null`). `messages.component.html`: Responder `hlmBtn` ghost/sm button per feed row inside a new `flex items-start justify-between gap-2` header, guarded by `@if (message.replyTo)`, `shrink-0` + `break-all` sibling so it does not clip at ~375px.

### Files changed (Batch 2)

| File | Action | What |
|------|--------|------|
| `frontend/src/app/core/reply-draft.service.ts` | Created | Signal-based reply-target bridge (design D4) |
| `frontend/src/app/core/reply-draft.service.spec.ts` | Created | 5 unit tests for `request`/`seq`/`clear` |
| `frontend/src/app/features/messages/messages.component.ts` | Modified | Inject `ReplyDraftService`; add `respond(message)` |
| `frontend/src/app/features/messages/messages.component.html` | Modified | Per-row Responder button gated on `message.replyTo`, responsive header row |
| `frontend/src/app/features/messages/messages.component.spec.ts` | Modified | +4 tests (render gating x2, click dispatch x2) |
| `openspec/changes/reply-to-message/tasks.md` | Modified | Marked 2.1–3.3 `[x]` |

### TDD Cycle Evidence (Batch 2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1/2.2 | `reply-draft.service.spec.ts` | Unit | N/A (new) | `Could not resolve "./reply-draft.service"` — build fail, module absent | 5/5 pass | seq 1→2 same target; different targets keep incrementing seq; `clear()` path | Clean — mirrors `ReplySubscriptionService` |
| 3.1/3.2/3.3 | `messages.component.spec.ts` | Integration (TestBed + DOM) | 30/30 pass | 3 new behavioral tests failed (`findResponder` undefined / no button) before markup added | 34/34 pass | `correlationId` present → passed through; `correlationId` absent → `null` | Clean — reused `hlmBtn` ghost/sm |

### Work Unit Evidence (Batch 2)

| Evidence | Value |
|---|---|
| Focused test command / result | `npx ng test --watch=false --include='**/reply-draft.service.spec.ts'` → Test Files 1 passed, Tests 5 passed. `npx ng test --watch=false --include='**/messages.component.spec.ts'` → Test Files 1 passed, Tests 34 passed (was 30). |
| Runtime harness command / result | No runtime boundary in PR2 (no broker/HTTP path added). Manual smoke deferred to Phase 6: click Responder on a `replyTo` row and confirm the Send panel pre-fills (needs Phase 4 send-side effect, not in this PR). Marked `N/A` for automated harness. |
| Rollback boundary | Revert commits `7025a3b` + `c62b255`: delete `reply-draft.service.ts`/`.spec.ts`, revert `respond()` + injection in `messages.component.ts`, revert the header `<div>` + Responder `@if` block in `messages.component.html`, drop the 4 added specs. No other code touched; `api-config.ts` never staged. |

### Commits (feat/reply-to-message-bridge)

- `7025a3b` feat(reply): add ReplyDraftService state bridge for reply pre-fill
- `c62b255` feat(reply): add Responder action to message feed rows with replyTo

### Deviations from design (Batch 2)

None. Matches D4 (service shape) and D6 (Responder hidden when `replyTo` null). `respond()` normalizes `msg.correlationId` (`string | undefined` on `ReceivedMessage`) to `string | null` for the `ReplyTarget` contract — task 3.2 wording `msg.correlationId` preserved for the non-null case.

## Batch 3 — PR3 / Phases 4+5: SendComponent reply mode + correlationId + dirty-check + overwrite confirm

Branch `feat/reply-to-message-send-panel` (stacked on `feat/reply-to-message-bridge`, chain PR 3 of 3, last impl batch). Strict TDD, vitest 4. Full detail in Engram `sdd/reply-to-message/apply-progress`.

Tasks 4.1–5.5 all `[x]`. Two work-unit commits:
- `611f2a4` feat(reply): add Send panel reply mode with correlation id — `replyMode`/`correlationId` signals, constructor `effect` on `replyDraft.draft()` tracking `lastAppliedDraftSeq` (applies via `untracked`), reply-mode `exchangeError` branch (null for exactly `''`, still errors on whitespace), `onExchangeInput`/`onRoutingKeyInput` exit reply mode, `send()` adds `correlationId` key only in reply mode + non-blank, template read-only `reply-exchange-chip` span + `name="correlationId"` field.
- `fb4105a` feat(reply): confirm before overwriting unsaved Send panel edits — `FormSnapshot`/`EMPTY_SNAPSHOT`, `lastAppliedSnapshot` signal, `isDirty` computed (serialized `{exchange,routingKey,payload,headers}` compare), `captureSnapshot()` in `useRecent`/`useTemplate`/`applyReplyDraft`/`send()`-success, `confirmOverwrite()` = `window.confirm` seam, `applyReplyDraft` bails on `isDirty() && !confirmOverwrite()` (still consumes `seq`).

RED for both slices was a compile failure (missing members); TDD RED→GREEN→TRIANGULATE followed per task.

### Work Unit Evidence (Batch 3)

| Evidence | Value |
|---|---|
| Focused test | `npx ng test --watch=false --include='**/send.component.spec.ts'` → 49 passed (was 33, +16: 9 reply-mode, 7 dirty-check/confirm). |
| Full suite | `npx ng test --watch=false` → 10 files, 203 passed (baseline 187, +16). |
| Runtime harness | `N/A` — no new broker/HTTP path (`send()` still posts `/api/messages`); live reply round-trip is Phase 6.2 manual smoke. |
| Rollback boundary | Revert `611f2a4` + `fb4105a`. `reply-draft.service.ts` (PR2), backend, and `messages.component` untouched; `api-config.ts` never staged. |

### Deviations: None. Matches D1/D2/D3/D5.

### Spec scenarios covered (Send-panel side of 6.1)

- request-reply "Responder Action Pre-Fills": *Activating Responder pre-fills the reply target*; *Message has replyTo but no correlationId*.
- request-reply "Overwriting Unsaved Send-Panel Edits Requires Confirmation": all 4 scenarios.
- ui-presentation "Send Panel Validates Exchange and Payload" (MODIFIED): *Reply-mode empty exchange accepted + read-only*; *Editing exchange or routing key leaves reply mode*; *blank exchange rejected outside reply mode* (regression green).

### Remaining

- Phase 6: `sdd-verify` (full scenario cross-check, `dotnet test` + `npm test`), then Phase 6.2 manual smoke.
