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

### Not started (PR2/PR3 — separate change batches per tasks.md)

- Phase 4 (Use Cases), Phase 5 (RabbitMqAdapter), Phase 6 (API Endpoints) — PR2.
- Phase 7 (SignalR Hub), Phase 8 (Angular SPA features), Phase 9 (E2E verification) — PR3.
