# Proposal: BusTester Foundation — Hexagonal Walking Skeleton with RabbitMQ

## Intent

The dev team has no shared tool to send/inspect messages against message brokers during development — everyone improvises with broker-native CLIs or ad hoc scripts. This change builds the first working slice of BusTester: a local, per-developer Angular + .NET 8 app that can send a message to RabbitMQ and show received/consumed messages live. It proves the hexagonal `IBusPort` abstraction against one real broker before Kafka is added, so later broker work is additive, not a rewrite.

## Scope

### In Scope
- Solution scaffold: hexagonal layering — Domain (`BusMessage`, `BusConnection`, `Subscription`), Application (`SendMessage`, `Subscribe` use cases behind `IBusPort`), Infrastructure (`RabbitMqAdapter`, SignalR hub), Presentation (ASP.NET Core API + Angular SPA).
- `RabbitMqAdapter` implementing `IBusPort` (connect, send, subscribe/consume) using RabbitMQ.Client v7.x, pinned to a stable patch.
- Send-message use case: user supplies connection details + exchange/queue/routing key + payload, message is published.
- Subscribe/consume use case: user starts a subscription on a queue; consumed messages are captured server-side.
- SignalR hub pushing consumed messages to the Angular UI in near-real-time.
- Minimal Angular UI: connect form, send form, live message list (no styling polish).
- xUnit test project (Domain + Application, adapter integration tests) and an Angular test project, both wired into the TDD RED-GREEN-REFACTOR workflow.

### Out of Scope
- Kafka adapter (`KafkaAdapter`) — deferred to `bus-tester-kafka-adapter`. `IBusPort` is designed on paper against Kafka's poll-loop model now, but only RabbitMQ ships.
- Persistence of any kind (connections, message history, templates) — deferred to `bus-tester-persistence`. Everything is in-memory, lost on restart.
- Auth/multi-user/shared hosting — this is a local single-user tool; no login, no server-side user model.
- UI polish, multi-broker switch UI, message templates/history — deferred to later UX changes.

## Capabilities

### New Capabilities
- `bus-connection`: establishing/holding a connection to a RabbitMQ broker for the session.
- `message-sending`: publishing a message to a broker exchange/queue.
- `message-consumption`: subscribing to a queue and receiving messages, pushed live to the UI via SignalR.

### Modified Capabilities
None — greenfield repo, no existing specs.

## Approach

Single ASP.NET Core host exposing REST endpoints (connect, send, subscribe) plus a SignalR hub, consumed by an Angular SPA. Core domain/application layers are broker-agnostic; `IBusPort` is the sole seam Infrastructure adapters implement. `RabbitMqAdapter` wraps RabbitMQ.Client's async push-consumer API. No database — application state (active connections, in-flight subscriptions) lives in memory for the process lifetime. Angular test runner: **recommend Vitest** (Karma is deprecated by the Angular team, Jest support is stalled) — flagged below for explicit confirmation since it diverges from any prior team convention.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/BusTester.Domain` | New | `BusMessage`, `BusConnection`, `Subscription` entities/value objects |
| `src/BusTester.Application` | New | `SendMessage`/`Subscribe` use cases, `IBusPort` interface |
| `src/BusTester.Infrastructure` | New | `RabbitMqAdapter`, SignalR hub |
| `src/BusTester.Api` | New | ASP.NET Core host, REST endpoints, hub wiring |
| `frontend/` | New | Angular SPA: connect/send forms, live message list |
| `tests/BusTester.Domain.Tests`, `tests/BusTester.Application.Tests`, `tests/BusTester.Infrastructure.Tests` | New | xUnit, TDD-driven |
| `frontend/**/*.spec.ts` | New | Angular unit tests (Vitest, pending confirmation) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RabbitMQ.Client v7 async API is a young major rewrite | Med | Pin a current stable patch version; cover connect/send/consume paths with integration tests |
| Walking skeleton (scaffold + adapter + use cases + SignalR + UI + 2 test projects) may exceed the ~400-changed-line PR budget | High | Chain into multiple PRs at natural seams (e.g. scaffold+domain, RabbitMQ adapter+use cases, SignalR+UI) — flag explicitly to sdd-tasks for chained delivery |
| Narrow RabbitMQ-only `IBusPort` design could force rework when Kafka's poll-loop consumption model is added | Med | Design `IBusPort` against both push (RabbitMQ) and poll (Kafka) models on paper now, even though only RabbitMQ ships |
| No existing test tooling in repo (fully greenfield) | Low | First tasks bootstrap xUnit + Angular test runner before any feature code (TDD requires it) |
| Vitest choice for Angular unclear against team's actual CI/tooling familiarity | Low | Flagged as open confirmation item below, not silently finalized |

## Rollback Plan

This is a new, isolated repo with no production usage — rollback is `git revert` of the merged commit(s)/PR(s) for this change, or simply not merging. No data migration, no external systems to unwind (RabbitMQ itself is untouched; the tool only produces test traffic against a broker the developer points it at).

## Dependencies

- A running RabbitMQ instance reachable from the developer's machine (not provided by this change — assumed local Docker/dev broker).
- RabbitMQ.Client v7.x NuGet package (stable patch, to be pinned in tasks/apply).
- `@microsoft/signalr` npm package for the Angular client.

## Success Criteria

- [ ] A developer can run the app locally, enter RabbitMQ connection details, and send a message to a queue/exchange.
- [ ] A developer can subscribe to a queue and see consumed messages appear in the Angular UI in near-real-time via SignalR.
- [ ] `IBusPort` has no RabbitMQ-specific types leaking into Domain/Application layers (verified by adapter being swappable in tests via a fake).
- [ ] xUnit and Angular test suites both pass and were built TDD-first (RED-GREEN-REFACTOR evidenced in commit history/tasks).
- [ ] Nothing persists across an app restart (in-memory only, confirmed by manual restart check).

## Proposal question round

These items are carried from exploration and are not fully closed; flagging for explicit confirmation rather than silently finalizing:

1. **Angular test runner — Vitest vs Jest**: Proposal recommends Vitest (Angular team is deprecating Karma, pivoting toward Vitest; Jest remains "experimental"). Does the team have existing CI/tooling investment in Jest that would make Vitest the wrong choice here?
2. **PR chaining**: The full walking skeleton likely exceeds the 400-line review budget. Proposal recommends chaining into 3 PRs (scaffold+domain, RabbitMQ adapter+use cases, SignalR+UI). Is chained delivery acceptable, or is a single larger PR preferred for this first change?
3. **RabbitMQ topology assumptions**: Should the UI let the developer specify arbitrary exchange/queue/routing-key/binding on the fly (flexible, matches "testing tool" use case), or is a simpler "connect + queue name" model sufficient for this first skeleton?

Assumptions used until corrected: Vitest, chained delivery recommended, flexible exchange/queue/routing-key entry (matches the "test broker traffic" purpose of the tool).
