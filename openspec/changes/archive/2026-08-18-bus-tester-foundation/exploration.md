# Exploration: Message-Bus Testing Application (change: bus-tester-foundation)

## Current State

`C:\repos\BusTester` is fully greenfield — only `.gitignore` committed, no code, no test tooling.

## Approaches Considered

1. **Single ASP.NET Core host, hexagonal layers, RabbitMQ-first walking skeleton** (RECOMMENDED) — Medium effort. Validates `IBusPort` against one broker before adding Kafka; matches Strict TDD's small-increment preference.
2. **Build both RabbitMQ + Kafka adapters in the first change** — High effort. Proves the abstraction against two consumption models sooner but roughly doubles scope, conflicts with the 400-line PR review budget, and needs Kafka infra (Testcontainers) in CI from day one.
3. **Non-hexagonal MVP first, refactor later** — Rejected. Contradicts the already-decided hexagonal constraint and wastes TDD investment.

## Key Findings

- **RabbitMQ.Client v7.x**: fully async API (`IChannel`, `IAsyncBasicConsumer`), Apache-2.0/MPL, mature. Minor known 7.0 RC1 issue (`in`-modifier + async) — pin a current stable patch.
- **Confluent.Kafka v2.x**: mature, wraps BSD-licensed `librdkafka`, C# wrapper Apache-2.0. `ProduceAsync` is async, but `Consume()` is a **synchronous blocking poll loop** requiring a background thread/`BackgroundService` — structurally different from RabbitMQ's async push callbacks. This asymmetry is the central design driver for `IBusPort`.
- **Live UI push**: SignalR (+ `@microsoft/signalr` Angular client) recommended over raw WebSockets or polling.
- **Angular test runner**: Angular deprecated Karma (Angular 20, removal ~Angular 22) and by late 2025 was pivoting toward **Vitest** as the likely first-party direction; Jest support stalled at "experimental." Recommend evaluating Vitest first.
- **.NET test framework**: xUnit — ecosystem default, confirmed appropriate.
- **Hexagonal layering**: Domain (BusMessage/BusConnection/Subscription) → Application (SendMessage/Subscribe/ListSubscriptions use cases, depends only on `IBusPort`) → Infrastructure (RabbitMqAdapter, KafkaAdapter later, SignalR hub) → Presentation (ASP.NET Core API + Angular SPA).

## Open Questions Carried to sdd-propose

These must be resolved explicitly, not silently defaulted:

1. Local single-user tool vs. shared hosted multi-user service — changes auth/state/routing scope significantly.
2. Jest vs. Vitest for Angular — recommend Vitest given Angular's own trajectory, but confirm against team's existing CI investment.
3. Persistence: recommend ephemeral/in-memory for v1, defer profile/template sharing to a fast-follow change — state explicitly rather than assume.

## Recommendation

Approach 1, scoped as `bus-tester-foundation`: solution scaffold + RabbitMQ adapter only + send/receive use cases + SignalR + minimal Angular UI + xUnit/Angular-test-runner CI wiring. Design `IBusPort` against both RabbitMQ's push model and Kafka's poll-loop model on paper now, even though only RabbitMQ ships in v1, so the later Kafka change is additive.

## Risks

- Angular test-runner ecosystem is currently in flux; document rationale for the choice made.
- RabbitMQ.Client v7 async API is a young major rewrite — pin and verify a stable patch.
- Narrow RabbitMQ-only port design risks breaking rework when Kafka is added later.
- Local-vs-hosted and persistence questions are unresolved and touch nearly every layer.
- No existing test tooling at all — first change must bootstrap it, adding setup overhead.

## Status

Ready for proposal, with the three open questions above explicitly carried forward.
