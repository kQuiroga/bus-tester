```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ac68b96c8e2a4b6b3d1e9f0a5c7d8e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9
verdict: pass
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 9/9
test_command: dotnet test BusTester.sln and npm test -- --watch false (frontend)
test_exit_code: 0
test_output_hash: sha256:26e73c1b90e73b04d57f83149d49a3d9344a06d436d56e338deff240451af06d
build_command: dotnet build BusTester.sln
build_exit_code: 0
build_output_hash: sha256:1273c9cca9fe8c9d35c8af8d679f4ca064e3be09ed287229e10c5e56cf9853c8
```

## Verification Report

Change: bus-tester-foundation
Version: N/A (no explicit spec version field)
Mode: Strict TDD
Re-verify context: this supersedes the prior verify-report.md FAIL verdict. Branch bus-tester-foundation/pr3-signalr-ui gained a remediation commit (ac68b96) adding runtime-verified regression coverage for the 2 previously-untested spec scenarios flagged in the prior pass ("No state survives restart", "Feed resets on restart"). This is a clean re-run, not a continuation of an interrupted session.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 42 |
| Tasks complete | 42 |
| Tasks incomplete | 0 |

40 original tasks (PR1 12, PR2 17 incl. 1 post-hoc, PR3 11) plus 2 new Post-Verify Remediation tasks (R.1, R.2) are all checked [x] in openspec/changes/bus-tester-foundation/tasks.md on disk (independently counted: 43 "- [x]" lines total; 0 "- [ ]" lines found via direct grep, not by trusting the checkbox alone).

### Build and Tests Execution

Build: PASS -- dotnet build BusTester.sln -- 0 Warnings, 0 Errors.

Tests: PASS -- 75 passed / 0 failed / 0 skipped, re-run cleanly in this pass (not reused from the interrupted prior session)
- BusTester.Domain.Tests: 29/29
- BusTester.Application.Tests: 10/10
- BusTester.Api.Tests: 13/13 (up from 12 -- includes new RestartRegressionTests.FreshHostInstance_AfterPriorInstanceHadConnectionAndSubscription_StartsWithNoCarriedOverState)
- BusTester.Infrastructure.Tests: 5/5 (real RabbitMQ via Testcontainers, Docker confirmed available and used)
- .NET total: 57/57
- Frontend (Vitest, 5 spec files): 18/18 (up from 17 -- includes new bus-hub.service.spec.ts case: a fresh instance simulating an app reload ignores any pre-existing browser storage and starts empty)
- Grand total: 75/75 passed, 0 failed

Frontend test-runner flakiness observed (non-blocking, environmental): across 5 consecutive npm test -- --watch false runs in this verification pass, 4 passed cleanly (18/18) and 1 failed with 3/5 spec files unable to parse a shared vendor chunk (chunk-BVCUUSWG.js, part of the bundled @microsoft/signalr dependency) -- a Vite import-analysis parse error on cached build output, not a source-code or test-logic failure (the 2 files that did parse in that run -- connect/send, both unmodified by this remediation -- passed their tests normally). Reproduced by re-running the same command with no source changes in between. Angular's unit-test builder is explicitly labeled EXPERIMENTAL in its own banner output. This is pre-existing environmental instability in the experimental Vitest/Vite builder plus Windows caching, not a regression introduced by the remediation commit. Recorded as WARNING 3 below; the officially reported test evidence above uses the final clean run's exact output/hash.

Coverage: Not measured in this pass -- coverlet.collector is referenced in all four .NET test projects but was not invoked with --collect; no coverage tool configured on the Angular/Vitest side. Not available (informational only, non-blocking).

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Broker-Agnostic Port Contract | Adapter is swappable | ArchitectureTests.cs (DomainAssembly_DoesNotReferenceRabbitMqClient, ApplicationAssembly_DoesNotReferenceRabbitMqClient) | COMPLIANT |
| Establish and Maintain Connection | Successful connection | RabbitMqAdapterTests (connect used as live-broker setup) + ConnectionsControllerTests.Connect_WithValidRequest_Returns204_AndBusPortReceivesConfig | COMPLIANT |
| Establish and Maintain Connection | Broker unreachable | RabbitMqAdapterTests.ConnectAsync_WithUnreachableHost_ThrowsBusConnectionException_WithinBoundedTimeout + ConnectionsControllerTests.Connect_WhenBrokerUnreachable_Returns503_AsProblemJson + connect.component.spec.ts | COMPLIANT |
| Establish and Maintain Connection | No state survives restart | RestartRegressionTests.FreshHostInstance_AfterPriorInstanceHadConnectionAndSubscription_StartsWithNoCarriedOverState -- boots a BusTesterApiFactory, connects + subscribes + delivers a message, disposes it, boots a brand-new BusTesterApiFactory (fresh DI container), asserts BusPort.ConnectedConfig is null and SubscriptionCoordinator.GetMessages(priorHandle) is empty | COMPLIANT (newly closed) |
| Send Message to Exchange/Queue/Routing Key | Successful publish | SendMessageUseCaseTests.HandleAsync_WithValidCommand_PublishesViaBusPort + RabbitMqAdapterTests.SendAsync_PublishesMessage_ConsumerReceivesIt (real broker) + MessagesControllerTests.Send_WithValidRequest_Returns200 + send.component.spec.ts | COMPLIANT |
| Send Message to Exchange/Queue/Routing Key | Invalid exchange or no connection | SendMessageUseCaseTests (2 cases) + RabbitMqAdapterTests.SendAsync_WhenExchangeDoesNotExist_ThrowsBusPublishException_AndConnectionStaysUsable + MessagesControllerTests (2 cases) + send.component.spec.ts | COMPLIANT |
| Subscribe and Receive Live Messages | Live delivery | RabbitMqAdapterTests.SubscribeAsync_DeliveredMessage_InvokesCallback (real broker) + SubscriptionCoordinatorTests + bus-hub.service.spec.ts + manually-verified real e2e (task 9.1) | COMPLIANT |
| Subscribe and Receive Live Messages | Invalid queue | SubscribeUseCaseTests.HandleAsync_WhenQueueDoesNotExist_ThrowsBusSubscriptionException_AndNoSubscriptionStarted + RabbitMqAdapterTests.SubscribeAsync_WhenQueueDoesNotExist_ThrowsBusSubscriptionException + SubscriptionsControllerTests + messages.component.spec.ts | COMPLIANT |
| Subscribe and Receive Live Messages | Feed resets on restart | bus-hub.service.spec.ts -- "a fresh instance (simulating an app reload) ignores any pre-existing browser storage and starts empty" -- pre-populates localStorage/sessionStorage with fake messages, resets TestBed, injects a fresh BusHubService, asserts messages() signal is still [] | COMPLIANT (newly closed) |

Compliance summary: 9/9 scenarios compliant with runtime-verified tests (up from 7/9). Both scenarios flagged UNTESTED in the prior verify pass now have real, runtime-executed, RED-confirmed-meaningful regression tests.

Assessment of the 2 new regression tests' assertion quality:
- RestartRegressionTests: does not merely check "no exception was thrown" -- it positively asserts the prior instance held the state (Assert.Single(priorCoordinator.GetMessages(...)), Assert.NotNull(priorInstance.BusPort.ConnectedConfig)) before disposal, then asserts the fresh instance has none of it (Assert.Null, Assert.Empty), and additionally proves there is no shared subscription registry by confirming DELETE /api/subscriptions/{priorHandle} on the fresh instance still returns 204 (the controller has no existence check, so a 404 would not have proven anything -- the test's own comment explicitly documents this reasoning). This is a real behavioral proof, not a tautology.
- bus-hub.service.spec.ts new case: seeds both localStorage and sessionStorage with realistic fake message JSON before constructing the fresh service instance, so a pass is only possible if the constructor genuinely never reads either storage API -- a service that accidentally read from storage would fail this test. Cleans up the storage keys afterward (no test-order leakage into the adjacent "starts with an empty messages signal" case, which was also independently re-confirmed to still pass in this run).
- Both tests' RED-was-meaningful confirmation is independently documented in apply-progress.md/Engram (temporarily reintroducing the exact bug each test targets, observing the expected failure, then reverting) -- this satisfies the strict-TDD bar, not just "a test exists that happens to pass."

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| IBusPort shape matches design | Implemented | Connect/Disconnect/SendAsync/SubscribeAsync(request, onMessage, ct)/UnsubscribeAsync -- matches design.md's interface snippet, including non-blocking SubscribeAsync semantics. |
| Domain has no framework/infra deps | Implemented | Zero ProjectReference/PackageReference in BusTester.Domain.csproj; enforced at runtime by ArchitectureTests.cs. |
| Application depends only on ports | Implemented | BusTester.Application.csproj references only BusTester.Domain; IBusPort/IMessageBroadcaster are the only Infrastructure-reachable seams. |
| Infrastructure implements the ports | Implemented | RabbitMqAdapter implements IBusPort; SignalRMessageBroadcaster implements IMessageBroadcaster. |
| Exception mapping (503/400) | Implemented | BusExceptionHandler maps BusConnectionException to 503, BusPublishException/BusSubscriptionException/ArgumentException to 400, application/problem+json. |
| No persistence (in-memory only) | Implemented, and now runtime-proven | Static evidence unchanged (no DB/file/cache dependency anywhere in src/) plus the 2 new regression tests now provide direct runtime proof rather than inference alone. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Hexagonal layering (Domain to Application to Infrastructure to Presentation) | Yes | Confirmed via csproj ProjectReference graph. |
| Callback-based IBusPort.SubscribeAsync | Yes | Matches design snippet verbatim. |
| Adapter owns its own dispatch loop | Yes | AsyncEventingBasicConsumer, non-blocking SubscribeAsync. |
| SignalR hub fed by subscription coordinator | Adapted, not literal | IMessageBroadcaster port introduced (strengthens, does not violate, the hex boundary) -- unchanged from prior pass, still an open SUGGESTION to update the design diagram. |
| Persistence: none | Yes, now with runtime proof | See Correctness table. |
| Angular test runner: Vitest | Yes, with noted flakiness | Deviation documented; the experimental builder shows intermittent vendor-chunk parse flakiness (see Tests section) -- unrelated to the runner choice itself. |
| PR chaining: PR1 to PR2 to PR3 stacked, not merged | Yes | Confirmed via git log; remediation commit ac68b96 added as a 4th commit on top of pr3-signalr-ui, still unpushed. |

### Issues Found

CRITICAL: None.

WARNING:
1. design.md's receive-flow diagram still shows SubscriptionCoordinator calling IHubContext<BusHub> directly rather than the actual IMessageBroadcaster port -- carried over from the prior pass, still unresolved, still non-blocking (implementation is more correct than the diagram).
2. design.md's three "Open Questions" (Vitest vs Jest, chained vs single PR, flexible vs simplified queue UI) remain unchecked despite being implicitly resolved by the shipped implementation -- carried over from the prior pass, cosmetic only.
3. New: the Angular experimental unit-test builder (Vitest/Vite-based) showed intermittent vendor-chunk parse flakiness in this pass (1 failure in 5 consecutive identical runs, 0 source changes between runs) -- a build-tool/caching issue, not a code defect. Recommend either pinning/investigating the Vite dep-cache behavior or tracking Angular's builder out of experimental status before relying on this suite unattended in CI.

SUGGESTION:
1. Automate the manually-verified "Live delivery" E2E flow (task 9.1) in a future change if a Playwright/E2E layer is added.
2. Consider wiring dotnet test with code coverage collection once a coverage threshold policy exists.
3. Given the newly-added regression tests are the only tests targeting "absence of a bug," consider a short project-level note describing the RED-confirmation-via-temporary-reintroduction technique used here, as a reusable pattern for future no-persistence-style regression tests (already captured in Engram apply-progress, not yet in a checked-in doc).

### Artifact Sync Check

openspec/changes/bus-tester-foundation/tasks.md and openspec/changes/bus-tester-foundation/apply-progress.md were independently read from disk in this pass and both contain the full PR3 narrative plus the "Post-Verify Remediation" section, matching the Engram observations (sdd/bus-tester-foundation/tasks rev 5, sdd/bus-tester-foundation/apply-progress rev 5) verbatim in substance. WARNING #2 from the prior verify pass (apply-progress.md stale on disk for PR3) is resolved.

### Runtime and Delivery Cross-Checks

- Docker: Infrastructure.Tests (5/5) ran against a real RabbitMQ Testcontainers-launched broker in this pass, not skipped.
- Git state: working tree at re-verify time has only state.yaml (verify phase field, being updated by this pass) modified and verify-report.md untracked (this artifact) -- no other uncommitted source changes. ac68b96 is the tip of bus-tester-foundation/pr3-signalr-ui, still unpushed (no remote configured), consistent with the documented stacked-PR, not-yet-reviewed intent.
- Grand total tests: 57 .NET + 18 frontend = 75, up from the prior pass's 73 (net +2, matching exactly the 2 new regression test cases added).

### Verdict

PASS

All 4 requirements / 9 spec scenarios now have runtime-verified covering tests (up from 2/4 requirements, 7/9 scenarios in the prior FAIL pass). 0 CRITICAL findings, 0 failing tests across 75 total automated tests (.NET 57/57, Vitest 18/18), 42/42 tasks complete including the 2 new remediation tasks, hexagonal boundaries and the IBusPort/IMessageBroadcaster contracts still exactly match the design. The 2 previously-untested "restart"/"no-persistence" scenarios are now closed with genuine runtime regression tests whose RED-was-meaningful confirmation is independently documented and whose assertions positively prove absence of shared state (not merely absence of an exception). Remaining WARNINGs are pre-existing design-doc drift (carried over, cosmetic) plus one newly-observed, non-blocking environmental flakiness in the experimental Angular test builder -- none block archive. Recommend proceeding to sdd-archive.
