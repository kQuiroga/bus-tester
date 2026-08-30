# Proposal: Reply to a Received Message

## Intent

BusTester can simulate the *requester* side of request-reply (send-with-reply auto-creates a temp queue + CorrelationId and waits), but nothing in the app can simulate the *responder* side. Today, replying to a received message that carries `replyTo`/`correlationId` requires manually copying those values into the Send panel by hand, or standing up an external consumer. This closes that gap: a one-click "Responder" action on a received message pre-fills the Send panel with the reply's target fields, so a tester can publish a reply back without leaving the app.

## Scope

### In Scope
- A "Responder" action on each row of the live message feed (`MessagesComponent`), enabled only when that message has a non-null `replyTo`.
- Clicking it pre-fills the existing Send panel (`SendComponent`): Exchange = default-exchange convention (see Approach), Routing Key = the message's `replyTo`, Correlation ID = the message's `correlationId`. Payload starts empty, with no hint or placeholder — the tester writes it from scratch.
- Reuse of the existing Send panel's validation, recent-sends history, and templates machinery — no new composer UI.
- Works regardless of current subscription state: the Responder action is not gated on the tester still being actively subscribed to the queue that received the message (publishing to `replyTo` is independent of subscription state, consistent with how the Send panel already works today).
- **Unsaved-edits warning on overwrite**: if the tester clicks Responder on a second message while the Send panel already has unsaved edits (from a prior Responder click, manual typing, a recalled recent send, or a loaded template), the system MUST warn/confirm before overwriting the form. `sdd-design` defines precisely what counts as "unsaved edits" (e.g. dirty-check against last-prefilled values vs. any non-empty field) and the warning/confirmation UX (native `confirm()`, toast, modal).

### Out of Scope
- Automatic/recursive correlation or a request-reply conversation UI — this is a one-off manual action.
- Any backend changes beyond the two minimal default-exchange fixes below. The `Api` and `Application` layers are untouched — `POST /api/messages` already accepts optional `ReplyTo`/`CorrelationId` end to end.
- Auto-tagging NServiceBus headers (e.g. `NServiceBus.MessageIntent: Reply`) — flagged as an open question, not assumed in scope.

### In Scope — backend (added after the design-phase spike)
The design phase proved a strictly frontend-only reply is impossible for the primary use case: replying to this app's own send-with-reply requests requires publishing to the AMQP default exchange (`Exchange = ""`), because those temp reply queues are bound only to `""`. A live spike against RabbitMQ confirmed `ExchangeDeclarePassiveAsync("")` returns `403 ACCESS_REFUSED` while a plain `BasicPublishAsync("", queueName, ...)` routes and delivers correctly. Two minimal, additive backend changes are therefore in scope (user-approved):
- `BusTester.Domain/BusMessage`: allow an exchange that is exactly `""` (still reject `null` and whitespace-only).
- `BusTester.Infrastructure/RabbitMqAdapter.SendAsync`: skip the passive `ExchangeDeclarePassiveAsync` round-trip when `message.Exchange.Length == 0`.
Both are a strict superset of current behavior and revert cleanly with the PR.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `request-reply`: new requirement — a received message with a non-null `replyTo` exposes a manual "Responder" action that pre-fills reply-target fields (Exchange, Routing Key, CorrelationId) into the Send panel; payload is left empty for the tester to author. Includes a new requirement that overwriting a Send panel with unsaved edits via a second Responder click MUST warn/confirm first (`sdd-design` defines the dirty-check and UX).
- `ui-presentation`: new requirement — the message row renders the Responder action (visible/enabled only when `replyTo` is present); reconciles with the existing "Send Panel Validates Exchange and Payload as Required" requirement, since a reply published via the default exchange uses an empty Exchange value. Resolution of that conflict is deferred to `sdd-design`.

## Approach

`ReceivedMessage` already carries `replyTo`/`correlationId` (from the archived `request-reply-headers` change). Add a Responder action to `MessagesComponent`'s row template that reads those two fields off the message and pushes them into `SendComponent`. `SendComponent` and `MessagesComponent` are currently sibling components with no shared state channel (both instantiated independently in `App`) — bridging them needs a small shared mechanism, consistent with the existing `SendHistoryService`/`ReplySubscriptionService` pattern; the exact shape (service vs. host-level signal) is a design decision, not resolved here.

**Confirmed as a design-phase spike**: this codebase's own request-reply plumbing (`RabbitMqAdapter.SendAsync`) passes `message.Exchange` straight through to `ExchangeDeclarePassiveAsync`/`BasicPublishAsync` with no special-casing. Publishing with `Exchange = ""` (the AMQP default exchange, routing by queue name) has not been exercised in this codebase yet. The user confirmed this verification MUST happen as a `sdd-design`-phase spike — not deferred to the first Strict-TDD implementation task — and `sdd-design` must resolve it before `sdd-tasks` cuts work. This same empty value collides with `SendComponent`'s existing required, non-blank Exchange validation — `sdd-design` must decide whether to special-case reply-prefilled sends, add a distinct "publish to default exchange" flag, or another approach.

**Confirmed unsaved-edits guard**: overwriting the Send panel via a second Responder click while it holds unsaved edits MUST warn/confirm the tester first — this overrides last-click-wins silent overwrite (the initial assumption in this proposal's first draft). `sdd-design` proposes and documents the precise dirty-check definition and the warning/confirmation UX (native `confirm()`, toast, or modal); it must not be picked silently.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `frontend/src/app/features/messages/messages.component.ts` / `.html` | Modified | Responder action per row, gated on `replyTo` presence |
| `frontend/src/app/features/send/send.component.ts` | Modified | Accept pre-fill of Exchange/RoutingKey/CorrelationId from a reply action |
| `frontend/src/app/app.ts` / new shared service (TBD in design) | New/Modified | Bridge state between `MessagesComponent` and `SendComponent` |
| `src/BusTester.Domain/BusMessage.cs` | Modified | Allow `Exchange` that is exactly `""` (keep rejecting `null`/whitespace) |
| `src/BusTester.Infrastructure/RabbitMqAdapter.cs` | Modified | Skip passive exchange declare when `message.Exchange.Length == 0` |
| Backend (Application/Api) | None | Existing `POST /api/messages` fields are reused as-is |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Empty-exchange publish behaves unexpectedly (passive declare, permissions) against this codebase's RabbitMQ adapter | Med | CONFIRMED: verified as a dedicated `sdd-design`-phase spike, before `sdd-tasks`; not deferred to the first TDD task |
| Reply prefill conflicts with existing required-Exchange validation, blocking submit | High (known) | Explicit design question; do not silently bypass or weaken existing validation without a decision |
| Cross-component state bridge adds coupling between `MessagesComponent` and `SendComponent` | Low | Follow existing service-based pattern (`SendHistoryService`, `ReplySubscriptionService`) rather than ad hoc `@Input`/`@Output` wiring |
| Second Responder click silently discards a tester's unsaved edits | Low (mitigated) | CONFIRMED in scope: warn/confirm before overwrite; `sdd-design` defines the dirty-check and UX |

## Rollback Plan

Frontend-only, additive UI action with no persisted-data or API shape changes. Reverting the PR removes the Responder action and any bridging service; the Send panel and message feed return to current behavior with no data migration needed.

## Dependencies

- `ReceivedMessage.replyTo`/`correlationId` (already shipped, `request-reply-headers` change).
- `POST /api/messages` optional `ReplyTo`/`CorrelationId` fields (already shipped, same change).

## Success Criteria

- [ ] A received message with `replyTo` set shows a Responder action; a message without it does not.
- [ ] Clicking Responder pre-fills Exchange, Routing Key (`replyTo`), and CorrelationId into the Send panel; payload stays fully empty, with no hint or placeholder.
- [ ] The Exchange/default-exchange validation tension is resolved by design, verified via a dedicated design-phase spike (not left as a silent submit-blocker, not deferred to the first TDD task).
- [ ] A second Responder click while the Send panel has unsaved edits warns/confirms before overwriting; the dirty-check definition and warning UX are documented by design.
- [ ] Publishing the reply is provably observable (e.g., via RabbitMQ management UI or an integration-style test) as reaching the original `replyTo` queue with the matching `CorrelationId`.
- [ ] The Responder action works regardless of current subscription state (no gate on being actively subscribed).
- [ ] Backend changes are limited to the two approved default-exchange fixes (`BusMessage` guard, `RabbitMqAdapter` passive-declare skip); `Application` and `Api` layers are untouched.
- [ ] Ordinary sends still reject a blank/whitespace Exchange end to end (frontend + Domain); only exactly `""` from a reply-mode send is allowed through.

## Confirmed product decisions (from proposal question round)

All four questions from the initial proposal question round are now resolved by the user. These are locked-in decisions, not open assumptions.

1. **Default-exchange verification owner** — CONFIRMED: a dedicated `sdd-design`-phase spike, not deferred to the first Strict-TDD implementation task. `sdd-design` must resolve `Exchange = ""` behavior before `sdd-tasks` cuts work.
2. **Payload authoring aid** — CONFIRMED: the reply payload textarea stays fully blank, with no hint or placeholder.
3. **Multiple Responder clicks** — CONFIRMED: **warn/confirm before overwriting** unsaved edits. **This is a deviation from this proposal's initial draft**, which had assumed silent last-click-wins overwrite (matching `useRecent`/`useTemplate`'s current behavior). The user explicitly overrode that assumption. This is now an in-scope requirement (see Scope and Capabilities above), not a non-goal. `sdd-design` proposes and documents: (a) the precise "unsaved edits" dirty-check (e.g., diff against last-prefilled values vs. any non-empty field), and (b) the warning/confirmation UX (native `confirm()`, toast, or modal) — it must not be picked silently.
4. **Subscription-state gating** — CONFIRMED: not required. The Responder action works regardless of current subscription state, consistent with how the Send panel already works today.
5. **Backend touch for default-exchange support** — CONFIRMED (design-phase, after the spike): the user approved two minimal backend changes (`BusMessage` guard relax to allow exactly `""`; `RabbitMqAdapter` skip of the passive declare for an empty exchange). The proposal's original "no backend files are touched" success criterion is **superseded** — it was based on an assumption the design phase disproved. Strictly frontend-only would leave the Responder able to pre-fill but unable to actually publish a reply to an app-native reply queue.

## Key Learnings

1. MessagesComponent and SendComponent are sibling components with no existing shared-state channel; app.ts only composes them side by side.
2. SendComponent.exchangeError already rejects a blank/whitespace Exchange value, which will collide with a default-exchange reply prefill unless resolved.
3. RabbitMqAdapter.SendAsync passes message.Exchange straight through to ExchangeDeclarePassiveAsync/BasicPublishAsync with no default-exchange special-casing today.
4. POST /api/messages already accepts optional ReplyTo/CorrelationId end to end from the archived request-reply-headers change, so no backend work is needed.
5. SendComponent already has a reusable prefill pattern (useRecent/useTemplate) that a reply-prefill mechanism can follow.
6. User confirmed all four proposal-round questions; overwrite behavior deviates from the initial last-click-wins assumption to a warn/confirm requirement.
