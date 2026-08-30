# Apply Progress: Reply to a Received Message

Store: hybrid. Mirror of Engram topic `sdd/reply-to-message/apply-progress`.
Mode: Strict TDD (backend `dotnet test`).

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

### Remaining (not this batch)

- Phase 2 (PR2): `ReplyDraftService` + Responder action — tasks 2.1–3.3
- Phase 3 (PR3): SendComponent reply mode + dirty-check + confirm — tasks 4.1–5.5
- Phase 6: verification + manual smoke
