# Apply Progress: bus-tester-foundation

## PR1: Scaffold, Domain, IBusPort — COMPLETE (12/12 tasks)

Branch: `bus-tester-foundation/pr1-scaffold` (off `main`, unpushed — awaiting user review before push/PR).

### Commits (in order)

1. `docs: add SDD planning artifacts for bus-tester-foundation` — root-commit, the pre-staged `openspec/` planning docs.
2. `chore: scaffold BusTester solution (hexagonal projects) and Angular frontend with Vitest` — `BusTester.sln`, 4 src projects, 3 xUnit test projects, `frontend/` Angular 20 standalone workspace wired to the experimental `@angular/build:unit-test` Vitest runner.
3. `feat(domain): add BusMessage, BusConnectionConfig, Subscription entities (TDD)` — RED→GREEN→REFACTOR per entity, 29 xUnit tests.
4. `feat(application): define IBusPort contract with assembly-boundary architecture test` — `IBusPort`, `SubscriptionRequest`, plus the RabbitMQ.Client-free architecture test.

### What was built

- **Solution**: `BusTester.sln` (classic format, per task wording) with hex references: `Api`→`Application`+`Infrastructure`, `Infrastructure`→`Application`, `Application`→`Domain`. All target `net8.0` (SDK installed is 10.0.103, but the `Microsoft.NETCore.App`/`AspNetCore.App` 8.0.24 runtime is present, so `net8.0` builds/runs fine).
- **Domain** (`src/BusTester.Domain/`): `BusMessage` (exchange/routingKey/payload, all required), `BusConnectionConfig` (host/port 1-65535/username/password, all required), `Subscription` (queueName required, identity-based `SubscriptionHandle` value type — two subscriptions with the same queue name get distinct handles; two handles wrapping the same `Guid` are equal).
- **Application** (`src/BusTester.Application/Ports/`): `IBusPort` (Connect/Disconnect/Send/SubscribeAsync-with-callback/UnsubscribeAsync) exactly per `design.md`'s interface snippet, plus `SubscriptionRequest` record. `SubscriptionHandle` is reused from `BusTester.Domain` rather than duplicated in Application — Domain owns the value type, the port signature consumes it directly.
- **Tests**: 29 Domain unit tests (xUnit) + 2 Application architecture tests (reflection over `GetReferencedAssemblies()` asserting neither `Domain.dll` nor `Application.dll` references `RabbitMQ.Client`) — all green. `Infrastructure.Tests` project exists (referenced from `.sln`, references `BusTester.Infrastructure`) but is intentionally empty — RabbitMQ adapter tests are PR2 scope.
- **Frontend** (`frontend/`): Angular 20.3 standalone workspace, no routing/SSR (not needed until PR3's feature components). Test runner is the experimental `@angular/build:unit-test` builder with `"runner": "vitest"` (Karma/Jasmine packages removed, `vitest`+`jsdom` added as devDependencies, `tsconfig.spec.json` types switched from `jasmine` to `vitest/globals`). `npm test` runs the scaffolded `app.spec.ts` (2 tests) in single-run mode — Vitest's own non-TTY default already skips watch mode, so no extra flag is required for CI.

### Verification run (all green)

- `dotnet build` — solution builds clean, 0 warnings/errors.
- `dotnet test` — 29 + 2 passed, 0 failed (Infrastructure.Tests reports "no tests available", exit code 0 — expected for an empty PR2-scope project).
- `npm test` (in `frontend/`) — 2 passed, exit code 0.

### Deviations from literal task/design wording (all intentional, documented here for verify/PR2 continuity)

1. **`.sln` format**: `dotnet new sln` on the installed SDK (10.0.103) defaults to the new XML `.slnx` format. Regenerated explicitly with `--format sln` to match the task's literal `BusTester.sln` filename — functionally identical, just matching the spec text.
2. **Angular CLI major version**: scaffolded with `@angular/cli@20` (not `@latest`, which is v22 and requires Node ≥22.22.3/24.15.0 — this machine has Node 24.13.0, unsupported by v22). Angular 20.3.34 fully supports Node 24.13.0 with no warnings.
3. **Vitest wiring**: Angular's built-in Vitest support (`@angular/build:unit-test` builder, `runner: "vitest"`) is explicitly marked `[EXPERIMENTAL]` by Angular. Chosen over a hand-rolled `vitest.config.ts` + `@analogjs/vite-plugin-angular` setup because it reuses the same `angular.json`/`tsConfig` test wiring Angular already scaffolds, keeping the toolchain a single first-party path. If this experimental builder is deprecated/changed upstream before PR3 (which adds the real feature-component specs), re-evaluate against `@analogjs/vite-plugin-angular` as a fallback.
4. **`SubscriptionHandle` placement**: design.md's `IBusPort` snippet references `SubscriptionHandle` without specifying its namespace, and task 3.1 groups it with `SubscriptionRequest` as if both were new Application-layer types. Since task 2.5 already TDD-drives a `Subscription.Handle` of type `SubscriptionHandle` in **Domain** (for equality semantics), `IBusPort` reuses `BusTester.Domain.SubscriptionHandle` rather than defining a second, competing `SubscriptionHandle` type in Application. Only `SubscriptionRequest` (net-new, port-request-shape only) was added under `Application/Ports/`.

### Review workload

Forecast was ~300-450 lines / Medium risk for PR1. Hand-written source (Domain entities + IBusPort + tests, excluding generated scaffolding like `package-lock.json`, `.csproj` boilerplate, Angular default files): approximately 300 lines across the Phase 2/3 commits. The Phase 1 scaffold commit is large in raw diff (~11k lines) almost entirely from `frontend/package-lock.json` and Angular/dotnet template boilerplate — none of it hand-authored logic, flagged here for the reviewer's awareness rather than re-generated to hide the count.

## PR2: Use Cases, RabbitMqAdapter, API — COMPLETE (16/16 tasks), BLOCKED on line-budget maintainer decision

Branch: `bus-tester-foundation/pr2-usecases-adapter` (off `bus-tester-foundation/pr1-scaffold`, unpushed).

### Commits (in order)

1. `feat(application): add SendMessageUseCase and SubscribeUseCase (TDD, fake IBusPort)` — `BusConnectionException`/`BusPublishException`/`BusSubscriptionException` in Domain; `SendMessageUseCase`; `SubscribeUseCase` + `SubscriptionCoordinator`; `UnsubscribeUseCase`; `FakeBusPort` test double.
2. `feat(infrastructure): add RabbitMqAdapter implementing IBusPort (RabbitMQ.Client v7)` — live-Docker Testcontainers integration tests, `.gitignore` gains `.vs/`.
3. `feat(api): add Connections/Messages/Subscriptions controllers and DI wiring` — controllers, `BusExceptionHandler`, `Program.cs` rewired.

### What was built

- **Domain exceptions** (`src/BusTester.Domain/Exceptions/`): `BusConnectionException`, `BusPublishException`, `BusSubscriptionException` — typed failures `IBusPort` implementations throw; controllers map them to problem+json.
- **Application use cases** (`src/BusTester.Application/UseCases/`): `SendMessageUseCase` (builds a `BusMessage`, calls `IBusPort.SendAsync`, propagates broker exceptions unchanged). `SubscribeUseCase` (builds a `SubscriptionRequest`, registers a closure-captured `onMessage` callback that forwards to `SubscriptionCoordinator` once the handle is known, registers the subscription only after the port call succeeds). `UnsubscribeUseCase` (calls `IBusPort.UnsubscribeAsync`, then unregisters from the coordinator).
- **`SubscriptionCoordinator`** (`src/BusTester.Application/Subscriptions/`): in-memory `ConcurrentDictionary<SubscriptionHandle, ConcurrentQueue<BusMessage>>`, process-lifetime only (no persistence — matches "feed resets on restart"). PR3 will wire this to `IHubContext<BusHub>` for SignalR push; for now it's a readable buffer.
- **`RabbitMqAdapter`** (`src/BusTester.Infrastructure/RabbitMqAdapter.cs`): RabbitMQ.Client v7.2.2 async API (`IConnection`/`IChannel`/`IAsyncBasicConsumer`). `ConnectAsync` maps `BrokerUnreachableException`/`SocketException`/`TimeoutException`→`BusConnectionException`. `SendAsync` opens a fresh per-call `IChannel`, does a passive exchange-declare before `BasicPublishAsync` (see deviation below), maps `OperationInterruptedException`→`BusPublishException`. `SubscribeAsync` opens a dedicated per-subscription `IChannel` + `AsyncEventingBasicConsumer`, maps missing-queue `OperationInterruptedException`→`BusSubscriptionException`; each subscription's channel is tracked so `UnsubscribeAsync` only tears down its own consumer.
- **API** (`src/BusTester.Api/`): `ConnectionsController` (POST/DELETE `/api/connections`, calls `IBusPort` directly — no use case, per design this is a pure passthrough). `MessagesController` (POST `/api/messages`→`SendMessageUseCase`). `SubscriptionsController` (POST `/api/subscriptions`→`SubscribeUseCase`, DELETE `/api/subscriptions/{id}`→`UnsubscribeUseCase`). `BusExceptionHandler` (`IExceptionHandler`): `BusConnectionException`→503, `BusPublishException`/`BusSubscriptionException`/`ArgumentException`→400, all as `application/problem+json`. `Program.cs` rewritten: removed the weather-forecast scaffold, wired `IBusPort`→`RabbitMqAdapter` and `SubscriptionCoordinator` as singletons (in-memory session state per design), use cases as transient, `UseExceptionHandler()`+`MapControllers()`.
- **Tests**: 3 new `SendMessageUseCaseTests` + 3 new `SubscribeUseCaseTests` (fake `IBusPort`, no broker) → Application.Tests now 8/8. 5 `RabbitMqAdapterTests` (Testcontainers, live Docker `rabbitmq:3.13-management` container) → Infrastructure.Tests 5/5, actually exercised against a real broker, not just compiled. Initially shipped with no dedicated API/controller test project (see deviation #5, now superseded — see "Controller integration test coverage" below, added post-hoc per explicit user request).

### Controller integration test coverage (added post-hoc, closes the Phase 6 TDD gap)

New project `tests/BusTester.Api.Tests/` (xUnit + `Microsoft.AspNetCore.Mvc.Testing`, `WebApplicationFactory<Program>`): boots the real `BusTester.Api` host in-process via `TestServer`, with the `IBusPort` singleton swapped for `Testing/StubBusPort.cs` (a controllable in-memory fake — no live broker needed, each test can force a specific `ConnectException`/`SendException`/`SubscribeException`). `Program.cs` gained a trailing `public partial class Program;` marker so `WebApplicationFactory<Program>` can locate the top-level-statement entry point. `Testing/BusTesterApiFactory.cs` is the shared `WebApplicationFactory` subclass (one fresh instance per test — no cross-test state bleed).

12 tests across the three controllers, characterizing the documented spec behavior (not rubber-stamping current output):
- **ConnectionsControllerTests** (4): valid connect → 204 + `StubBusPort.ConnectedConfig` captured; broker-unreachable (`BusConnectionException`) → 503 `problem+json`; empty host (`ArgumentException` from `BusConnectionConfig`'s own validation) → 400 `problem+json`, `IBusPort.ConnectAsync` never reached; disconnect → 204 + config cleared.
- **MessagesControllerTests** (4): valid send → 200 + message captured on the port; no active connection (`BusConnectionException` from the port) → 503; exchange missing on broker (`BusPublishException`) → 400; empty exchange (domain `ArgumentException`, use-case-level validation before the port is ever touched) → 400, `SentMessages` stays empty.
- **SubscriptionsControllerTests** (4): valid subscribe → 200 + handle returned + request captured on the port; queue missing on broker (`BusSubscriptionException`) → 400; no active connection (`BusConnectionException`) → 503; unsubscribe → 204 + handle forwarded to the port.

All 12 assert both the HTTP contract (status code, `application/problem+json` content-type, `ProblemDetails.Status`) and the business side-effect (what the stub actually received/didn't receive) — e.g. the empty-exchange test asserts `SentMessages` stays empty, proving validation genuinely short-circuits before `IBusPort.SendAsync` rather than the test merely checking the response code in isolation.

**Retrofit outcome, stated plainly**: all 12 tests passed on the first run. This is a genuine characterization result, not a shortcut — the controllers and `BusExceptionHandler` already matched the documented 503/400 mapping and success-path contracts exactly (verified previously only by ad hoc `curl`, now backed by an automated, repeatable suite). No behavioral bug was found against the spec, so no controller code changed as part of this retrofit.

### Verification run (all green)

- `dotnet build BusTester.sln` — 0 warnings, 0 errors.
- `dotnet test BusTester.sln` — **54/54 passed, 0 failed** (Domain.Tests 29, Application.Tests 8, Api.Tests 12, Infrastructure.Tests 5 — the 5 Infrastructure tests ran against a real RabbitMQ container via Testcontainers, Docker Desktop 4.55.0 was available and used).
- Manual `dotnet run` + `curl` smoke test of all three exception-mapping paths (503/503/400) from the original PR2 pass, now superseded by the automated `Api.Tests` suite above.

### Real RED found via live Docker (not just a compile-error RED)

Task 5.5 initially failed for real: `IChannel.BasicPublishAsync` to a non-existent exchange does **not** throw synchronously — AMQP `basic.publish` has no ack, so the server only closes the channel *after* the client call has already returned, and that close is only observable on a later channel operation. Fixed by adding a synchronous `ExchangeDeclarePassiveAsync` check immediately before `BasicPublishAsync`, which does round-trip and throws `OperationInterruptedException` if the exchange is missing — while the failure is still scoped to that call's own short-lived channel, leaving the connection (and any other channel) unaffected. This is documented inline in `RabbitMqAdapter.SendAsync`.

### Deviations from literal task/design wording

1. **No dedicated `SendResult`/`SubscriptionResult` DTO types** beyond what's needed: `SendMessageUseCase.HandleAsync` returns `Task` (success = no exception, matching the design's "surface the failure to the UI immediately" error model — there's nothing else to report on success). `SubscribeUseCase.HandleAsync` returns `SubscriptionHandle` directly (no wrapper record) since that's the only thing a caller needs.
2. **Exception types**: design.md only explicitly names `BusConnectionException`/`BusPublishException`; a third, `BusSubscriptionException`, was added for subscribe-side broker rejections (missing queue) to keep the 400-vs-503 mapping semantically named rather than overloading `BusPublishException` for a non-publish operation.
3. **`ConnectionsController` has no dedicated use case** — task list's Phase 4 only names `SendMessageUseCase`/`SubscribeUseCase`; connect/disconnect stayed a direct `IBusPort` passthrough in the controller, consistent with the design explicitly deferring persistence/business logic for connection management.
4. **Passive-declare-before-publish** (see "Real RED" above) — not specified in design.md's interface sketch, added because the literal `BasicPublishAsync`+try/catch approach the design implies does not actually surface missing-exchange errors synchronously in RabbitMQ.Client v7's async API.
5. ~~No API/controller-level automated tests~~ — **superseded**: user asked for this gap to be closed rather than deferred; see "Controller integration test coverage" above. Originally deferred because `tasks.md` Phase 6 had no RED→GREEN bullets (unlike Phase 4/5) and the design's testing-strategy table only lists Domain/Application/Infrastructure/Frontend layers — that was a deliberate scope-boundary call at the time, documented rather than silently skipped, and closed on user request in the same PR2 branch (task 6.3, added post-hoc).

### Review workload — line-budget exception APPROVED by user for PR2

Forecast was ~500-700 lines / High risk for PR2 — confirmed, and then grew further with the controller-test retrofit below. `git diff --stat` against PR1's tip after the first 3 PR2 commits: 858 insertions, ~26 deletions across 23 files — essentially all hand-authored (RabbitMQ.Client/Testcontainers are plain NuGet `PackageReference` additions, ~5 `.csproj` lines, no lockfiles). `gentle-ai sdd-attempt settle` (evidence-revision `sha256:4c01b56461d9f0f39c613fb8149c99b1843c9e985c7da7488319e8ac1a1b1c1a`) returned `changed_lines: 858, changed_line_budget_exceeded: true, decision_required: true, next_action: "reset"`. Per runtime-attempt authority instructions, the apply agent did not self-approve or run `reset` and instead reported the exact numbers and stopped.

**User decision**: approved as a one-time exception for PR2, same category as the PR1 exception but this time over genuinely hand-written volume rather than generated boilerplate. The orchestrator owns the `gentle-ai sdd-attempt` reset/re-acquire/settle sequence for the *final* PR2 diff (all 4 commits, including this controller-test retrofit) in one shot — this apply agent did not touch the ledger again after the 3rd commit's settle above.

### Not started (PR3 — separate change batch per tasks.md)

- Phase 7 (SignalR Hub), Phase 8 (Angular SPA features), Phase 9 (E2E verification) — PR3.
