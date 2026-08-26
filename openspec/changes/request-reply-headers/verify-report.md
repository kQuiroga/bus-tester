# Verification Report: Request-Reply Headers (Phase A of request-reply-support)

**Change**: request-reply-headers
**Mode**: Full artifact set (proposal + specs + design + tasks + apply-progress) - Strict TDD active
**Verdict**: PASS WITH WARNINGS

## Completeness (Tasks)

18/18 tasks marked complete in tasks.md and Engram sdd/request-reply-headers/tasks. Independently confirmed against the actual working tree - every referenced file exists and contains the described change. No unchecked task found.

## Build and Test Evidence (independently re-run this session)

| Command | Result |
|---|---|
| dotnet build BusTester.sln | PASS - 0 Warnings, 0 Errors |
| dotnet test tests/BusTester.Domain.Tests | PASS - 33/33 |
| dotnet test tests/BusTester.Application.Tests (incl. ArchitectureTests) | PASS - 11/11 |
| dotnet test BusTester.sln - API project | PASS - 14/14 |
| dotnet test BusTester.sln - Infrastructure project (live RabbitMQ via Testcontainers, Docker confirmed running) | PASS - 8/8 |
| Total | PASS - 66/66, zero regressions |

Docker was verified available (docker info succeeded) before running Infrastructure tests; the Testcontainers RabbitMQ container was created, became ready, and was torn down as part of the run - these are real broker round-trips, not mocked.

git diff --stat: 10 files changed, 241 insertions and 9 deletions - exactly the 6 production plus 4 test files listed in apply-progress, within the ~180-260 line forecast (Low budget risk, no chaining needed).

## Spec Compliance Matrix

### Domain: message-sending

| Requirement / Scenario | Covering Test(s) | Status |
|---|---|---|
| Send with both ReplyTo and CorrelationId | BusMessageTests.Create_WithReplyToAndCorrelationId_SetsBothProperties; SendMessageUseCaseTests.HandleAsync_WithReplyToAndCorrelationId_PublishesThemViaBusPort; RabbitMqAdapterTests.SendAsync_WithReplyToAndCorrelationId_PublishesThemAsBasicProperties (live broker) | PASS |
| Send with only CorrelationId, no ReplyTo | BusMessageTests.Create_WithOnlyCorrelationId_LeavesReplyToNull (unit only) | PARTIAL - no dedicated wire-level BasicProperties test for the only-one-field case; see Issue W1 |
| Send with only ReplyTo, no CorrelationId | BusMessageTests.Create_WithOnlyReplyTo_LeavesCorrelationIdNull (unit only) | PARTIAL - same as above, Issue W1 |
| Send without either field is unchanged | BusMessageTests.Create_WithoutReplyToOrCorrelationId_DefaultsBothToNull; RabbitMqAdapterTests.SendAsync_WithoutReplyToOrCorrelationId_LeavesBasicPropertiesUnset (live broker, regression guard) | PASS |
| Send DTO Exposes Optional ReplyTo/CorrelationId - with headers | MessagesControllerTests.Send_WithReplyToAndCorrelationId_Returns200_AndBusPortReceivesBothValues | PASS |
| Send DTO Exposes Optional ReplyTo/CorrelationId - without headers | MessagesControllerTests.Send_WithValidRequest_Returns200_AndBusPortReceivesMessage (pre-existing, unchanged) | PASS |

### Domain: message-consumption

| Requirement / Scenario | Covering Test(s) | Status |
|---|---|---|
| Received message carries both ReplyTo and CorrelationId | RabbitMqAdapterTests.SubscribeAsync_DeliveredMessageWithReplyToAndCorrelationId_SurfacesThemOnBusMessage (live broker; proves data flows from AMQP IReadOnlyBasicProperties into BusMessage) | PARTIAL - proven at the BusMessage and adapter boundary; the final SignalRMessageBroadcaster to MessageReceivedDto forwarding step has zero dedicated tests (see Issue W2) |
| Received message carries only CorrelationId | No dedicated test at either adapter or broadcaster level for the only-one receive case | PARTIAL - same root cause as W1, lower priority since no distinct code branch exists |
| Received message carries neither field | Covered indirectly by pre-existing SubscribeAsync_DeliveredMessage_InvokesCallback style tests, which use the 3-arg BusMessage ctor and default to null | PASS |

Scenario count: 3 requirements, 9 scenarios total. 6 of 9 fully proven by a passing runtime test at the correct layer; 3 of 9 proven at an adjacent/lower layer only (Domain unit test) rather than the full wire/broadcast path, all sharing one root cause: no additional code branch exists between both-fields and only-one-field, so risk is low, not absent.

## Correctness vs. Design

| Design Decision | Implementation | Match |
|---|---|---|
| BusMessage gains 2 nullable trailing optional ctor params, no new overload or subtype | src/BusTester.Domain/BusMessage.cs lines 11-16 - exactly string replyTo = null, string correlationId = null trailing, both nullable | Exact match |
| No IBusPort signature change - headers ride inside BusMessage | IBusPort.SendAsync(BusMessage, CancellationToken) and the SubscribeAsync callback signature stayed untouched; FakeBusPort and StubBusPort needed no changes | Exact match |
| Conditional BasicProperties construction in RabbitMqAdapter.SendAsync | RabbitMqAdapter.cs lines 72-90 - branches to the properties-aware BasicPublishAsync overload only when ReplyTo or CorrelationId is set; else keeps the original 4-arg call | Exact match |
| Receive path reads args.BasicProperties.ReplyTo and CorrelationId into new BusMessage | RabbitMqAdapter.cs lines 114-121 | Exact match |
| SendMessageCommand and SendMessageRequest mirror same 2 optional trailing fields | SendMessageCommand.cs, MessagesController.cs SendMessageRequest | Exact match |
| MessageReceivedDto gets same 2 nullable fields | SignalRMessageBroadcaster.cs lines 34-40 | Exact match |
| Documented implementation detail: RabbitMQ.Client v7.2.2 generic BasicPublishAsync overload requires an explicit mandatory false positional arg not spelled out in design prose | RabbitMqAdapter.cs line 82 passes mandatory: false | Consistent, correctly logged as a resolved implementation detail, not a deviation |

No deviations from design found.

## Design Coherence - Scope Check (Phase A boundary)

- PASS - No temporary reply-queue implementation added.
- PASS - No auto-subscribe or auto-correlation logic added, confirmed by reading RabbitMqAdapter.cs and SignalRMessageBroadcaster.cs in full; the two fields are pure pass-through with zero new branching beyond the existing conditional BasicProperties construction.
- PASS - No frontend changes; repository contains no frontend-style directory matching an Angular client source at this commit; git diff --stat confirms only the 10 backend files listed above were touched.
- PASS - ArchitectureTests, which enforce that Domain and Application must not reference RabbitMQ.Client, still pass, confirmed via the 11/11 Application.Tests run that includes this file.

## Issues

### CRITICAL
None.

### WARNING
- W1: Spec scenarios "Send with only CorrelationId, no ReplyTo" and "Send with only ReplyTo, no CorrelationId" for message-sending are proven only at the BusMessage unit-test level, not at the wire or BasicProperties integration level. The Infrastructure suite only exercises the both-fields-set and neither-field-set cases against the live broker. Risk is low because RabbitMqAdapter.SendAsync branch condition and object-initializer body apply identically regardless of which one or both are set, so there is no additional code path an only-one case would exercise that both does not. Recommend a fast-follow triangulation test if this class sees future changes.
- W2: Spec requirement Expose ReplyTo and CorrelationId on Received Messages names the SignalR broadcast payload as a required consumer surface, but SignalRMessageBroadcaster.BroadcastAsync and MessageReceivedDto have no dedicated test file in the repository for any of their fields, not just the two new ones; this is a pre-existing gap, not a regression introduced by this change. The underlying data path from AMQP properties into BusMessage is proven live via SubscribeAsync_DeliveredMessageWithReplyToAndCorrelationId_SurfacesThemOnBusMessage; only the final DTO-forwarding line lacks runtime proof. apply-progress explicitly and honestly disclosed this gap rather than concealing it. Recommend adding a minimal SignalRMessageBroadcaster test in a follow-up change, independent of this Phase A slice.

### SUGGESTION
None beyond the above.

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | PASS | Full TDD Cycle Evidence table found in apply-progress |
| All tasks have tests | PASS | 5 of 5 task groups (Domain, Application, Infra-send, Infra-receive plus broadcaster, API) have associated test files |
| RED confirmed, tests exist | PASS | All listed test files exist and contain the described new test methods |
| GREEN confirmed, tests pass | PASS | 66 of 66 pass on independent re-run this session |
| Triangulation adequate | PARTIAL | Domain, Application and API layers are well-triangulated with 2 to 4 cases each; Infrastructure send is triangulated for both-fields and neither-field but not the two single-field cases (see W1); receive-side and broadcaster are explicitly single-scenario per apply-progress own honest disclosure |
| Safety Net for modified files | PASS | All modified test files pre-existing test counts (29, 10, 13, 4) verified as pre-existing baseline before the 4 new-full counts (33, 11, 14, 8) |

TDD Compliance: 5 of 6 checks fully green, 1 partial for triangulation, consistent with W1 and W2 above, not a new finding.

### Assertion Quality
No trivial or tautological assertions found across the 4 modified test files. Every new assertion calls into real production code (BusMessage constructor, SendMessageUseCase.HandleAsync, HTTP POST through WebApplicationFactory, live RabbitMQ publish and consume via Testcontainers) and asserts specific, non-trivial expected values such as orders.reply and corr-123, not just null-checks or type-checks in isolation.

Assertion quality: All assertions verify real behavior.

## Final Verdict

PASS WITH WARNINGS - 0 CRITICAL, 2 WARNING, 0 SUGGESTION. Implementation is complete, matches design exactly with no scope creep beyond Phase A, and is backed by 66 of 66 independently re-run tests, including live Docker and Testcontainers RabbitMQ integration tests. The two WARNINGs are pre-existing or low-risk test-layer coverage gaps, not functional defects, and do not block archival of this change.
