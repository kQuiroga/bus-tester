# Tasks: Request-Reply Headers (Phase A of request-reply-support)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–260 (additions+deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Basis: 6 small production files (BusMessage.cs 30 lines, SendMessageCommand.cs 3 lines, SendMessageUseCase.cs 25 lines, RabbitMqAdapter.cs 156 lines, SignalRMessageBroadcaster.cs 28 lines, MessagesController.cs 27 lines) each getting a handful of nullable trailing fields/pass-throughs (~5–20 lines each, ~40–60 total), plus 4 test files gaining 2–4 new test methods each (~150–200 lines total, dominated by Testcontainers-style Infrastructure tests). No new files, no migrations, no threat-matrix rows (design marks it N/A).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Thread optional ReplyTo/CorrelationId through Domain → Application → Infrastructure → API, RED-first | PR 1 (single) | `dotnet test BusTester.sln --collect:"XPlat Code Coverage"` | Testcontainers-backed RabbitMQ (existing `RabbitMqAdapterTests.cs` pattern) for Infrastructure tests; WebApplicationFactory for API tests | Revert the single PR; all fields are additive/nullable so no other call site is affected |

## Phase 1: Domain Foundation — `BusMessage`

- [x] 1.1 RED: In `tests/BusTester.Domain.Tests/BusMessageTests.cs`, add failing tests: ctor with both ReplyTo+CorrelationId, only CorrelationId, only ReplyTo, and existing 3-arg ctor still defaults both to null.
- [x] 1.2 GREEN: In `src/BusTester.Domain/BusMessage.cs`, add `string? ReplyTo = null, string? CorrelationId = null` optional trailing ctor params and matching properties; no validation beyond existing required-field checks.
- [x] 1.3 Verify: run `dotnet test tests/BusTester.Domain.Tests` — all Domain tests (new and pre-existing) pass.

## Phase 2: Application — `SendMessageCommand` / `SendMessageUseCase`

- [x] 2.1 RED: In `tests/BusTester.Application.Tests/UseCases/SendMessageUseCaseTests.cs`, add failing test: `FakeBusPort.SentMessages` carries ReplyTo/CorrelationId when the command supplies them.
- [x] 2.2 GREEN: In `src/BusTester.Application/UseCases/SendMessageCommand.cs`, add optional trailing `string? ReplyTo = null, string? CorrelationId = null` to the record.
- [x] 2.3 GREEN: In `src/BusTester.Application/UseCases/SendMessageUseCase.cs`, pass `command.ReplyTo`/`command.CorrelationId` into the `new BusMessage(...)` call.

## Phase 3: Infrastructure — Send path (`RabbitMqAdapter`)

- [x] 3.1 RED: In `tests/BusTester.Infrastructure.Tests/RabbitMqAdapterTests.cs`, add failing Testcontainers test: publish with ReplyTo+CorrelationId set, verify via `BasicGetResult.BasicProperties`.
- [x] 3.2 RED: Add failing test: publish without either field still round-trips with no `BasicProperties` behavior change (regression guard for the conditional branch).
- [x] 3.3 GREEN: In `RabbitMqAdapter.SendAsync`, build a `BasicProperties` only when `ReplyTo` or `CorrelationId` is non-null and call the properties-aware `BasicPublishAsync` overload; otherwise keep today's 4-arg call.

## Phase 4: Infrastructure — Receive path (`RabbitMqAdapter` + `SignalRMessageBroadcaster`)

- [x] 4.1 RED: In `RabbitMqAdapterTests.cs`, add failing test: a delivery whose `IReadOnlyBasicProperties` carries ReplyTo/CorrelationId surfaces them on the `BusMessage` passed to the subscribe callback.
- [x] 4.2 GREEN: In `RabbitMqAdapter.SubscribeAsync`'s consumer callback, read `args.BasicProperties.ReplyTo`/`CorrelationId` into the `new BusMessage(...)` call.
- [x] 4.3 GREEN: In `src/BusTester.Infrastructure/SignalRMessageBroadcaster.cs`, add nullable `ReplyTo`/`CorrelationId` to `MessageReceivedDto` and pass `message.ReplyTo`/`message.CorrelationId` in `BroadcastAsync`.

## Phase 5: API — `MessagesController`

- [x] 5.1 RED: In `tests/BusTester.Api.Tests/Controllers/MessagesControllerTests.cs`, add failing tests: POST with ReplyTo+CorrelationId reaches `StubBusPort.SentMessages` with both set; POST without them is unchanged.
- [x] 5.2 GREEN: In `src/BusTester.Api/Controllers/MessagesController.cs`, add optional `ReplyTo`/`CorrelationId` to `SendMessageRequest`.
- [x] 5.3 GREEN: Pass `request.ReplyTo`/`request.CorrelationId` into `new SendMessageCommand(...)` in `Send`.

## Phase 6: Verification

- [x] 6.1 Run `dotnet test BusTester.sln --collect:"XPlat Code Coverage"` — full suite green, zero regressions.
- [x] 6.2 Confirm `tests/BusTester.Application.Tests/ArchitectureTests.cs` still passes (Domain/Application assemblies still don't reference `RabbitMQ.Client`).
- [x] 6.3 Spot-check one header-bearing send against a live RabbitMQ instance (management UI or manual test) matching the proposal's Success Criteria. — Satisfied by the live Testcontainers integration test `SendAsync_WithReplyToAndCorrelationId_PublishesThemAsBasicProperties`, which publishes against a real RabbitMQ container and verifies `BasicGetResult.BasicProperties.ReplyTo`/`CorrelationId` round-trip.
