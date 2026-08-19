# Exploration: Send Panel UX Improvements

## Scope

Improve the send panel UX in the BusTester Angular SPA:
- Client-side validation (exchange name, message body, routing key as applicable) with inline error feedback.
- Send history / templates feature: recall previously sent messages, save/reuse a message as a template.

Primary file surface: `frontend/src/app/features/send/*` (component, template, spec, and shared send-panel state/services it owns). Excluded: `frontend/src/app/features/connect/*`, `frontend/src/app/features/messages/*` (owned by sibling parallel changes).

## Current State

`frontend/src/app/features/send/send.component.ts` is a standalone Angular 20 component using `FormsModule` (template-driven forms, `ngModel`/`ngModelChange`) plus `signal()`s for state — **not** Reactive Forms. Fields: `exchange`, `routingKey`, `payload` (all string signals, default `''`), plus `confirmation`/`errorMessage` signals. `send()` clears feedback and POSTs `{ exchange, routingKey, payload }` to `/api/messages` via `frontend/src/app/core/api-client.service.ts` (`ApiClientService.errorDetail` extracts problem+json `detail`). **No client-side validation exists today** — empty strings are submitted as-is.

Template is a Tailwind card with a 3-field form + submit button + conditional confirmation/error banners using `status-ok`/`status-error` tokens from `frontend/src/styles.css`. Tests (`send.component.spec.ts`) use Vitest + `TestBed` + `HttpTestingController`, confirming the Vitest testing convention (per `frontend/package.json` and `angular.json`).

Sibling features (read-only, for consistency, not modified): `connect.component.ts` and `messages.component.ts` share the identical signals+`FormsModule` idiom, no validation. A grep across the whole frontend confirmed **zero** usages of `ReactiveFormsModule`/`Validators`/`FormGroup`/`FormControl` anywhere — the app is uniformly template-driven+signals, and there is no `frontend/src/app/shared/` atomic component library.

Notably, `frontend/src/app/core/bus-hub.service.spec.ts` has an explicit test proving the live incoming-message feed (`BusHubService`) is deliberately non-persistent — a fresh instance ignores pre-seeded `localStorage`/`sessionStorage` ("Feed resets on restart"). This is a documented architectural decision about the *incoming* broker feed and does **not** block persisting the send panel's own *outgoing* history/templates, but the proposal must explicitly distinguish the two so reviewers don't read it as an inconsistency.

Backend (read-only): `MessagesController.cs` → `SendMessageRequest(Exchange, RoutingKey, Payload)`, no server-side validation attributes; `SendMessageUseCase` is stateless and persists nothing. No history/template/draft endpoints exist anywhere in `src/BusTester.*`. This confirms client-side `localStorage` persistence is the right (and only currently-available) option, matching the scope constraint. Note the field is `exchange`, not `queue` — the send panel has no queue field.

## Affected Areas

- `frontend/src/app/features/send/send.component.ts` — validation signals/helpers, history/template state, localStorage read/write, submit gating.
- `frontend/src/app/features/send/send.component.html` — inline field-error markup, history/template UI (list, recall, save-as-template).
- `frontend/src/app/features/send/send.component.spec.ts` — new Vitest cases for validation and localStorage-backed history/templates.
- Possibly a new colocated file under `frontend/src/app/features/send/` (e.g. `send-history.service.ts`) — within the allowed surface.
- `frontend/src/styles.css` — likely no change needed; existing `status-error`/`status-ok` tokens are reusable for validation feedback.
- Explicitly excluded: `frontend/src/app/features/connect/*`, `frontend/src/app/features/messages/*`.

## Approaches Considered

### Validation

1. **Hand-rolled signal-based validators (computed signals per field)** — Pros: 100% consistent with existing connect/messages/send conventions, no new dependency, small diff, easy Vitest unit tests. Cons: manual touched/dirty tracking, doesn't scale to complex rules. Effort: Low.
2. **Migrate this component to Reactive Forms (`FormGroup`+`Validators`)** — Pros: mature validation machinery, scales better. Cons: introduces a paradigm inconsistent with every other component in the app, larger diff, no existing precedent to justify it for one 3-field form. Effort: Medium.

### History / Templates

1. **localStorage-backed state colocated in `features/send/`** (two lists: capped "recent sends", named "saved templates") with recall/save UI. Pros: stays in allowed file surface, no backend change, testable via the same localStorage-mock pattern already used in `bus-hub.service.spec.ts`. Cons: no cross-device sync, needs graceful handling of corrupted JSON. Effort: Medium.
2. **In-memory-only history, no persistence.** Pros: trivial. Cons: fails the stated requirement (recall/reuse implies surviving beyond a single render cycle). Effort: Low, but doesn't meet requirements.

## Recommendation

Hand-rolled signal-based validation (Approach 1) + localStorage-backed history/templates (Approach 1), both implemented directly on `SendComponent` plus a small colocated helper, reusing existing design tokens. Extend `send.component.spec.ts` with validation-blocking, successful-validation, history-auto-populate, and template save/recall test cases.

## Risks

- Validation pattern will now differ from connect/messages (accepted — those are explicitly out of scope, owned by sibling changes).
- Reviewers may misread persisted send history as contradicting the `BusHubService` "feed resets on restart" precedent unless the proposal explicitly distinguishes outgoing drafts from the live incoming feed.
- RabbitMQ routing keys are legitimately optional (fanout exchanges) — treating `routingKey` as required could be over-strict; needs an explicit proposal decision.
- Malformed/corrupted localStorage JSON must fail gracefully to empty state, not throw.
- Estimated diff (~150-250 lines) is comfortably under the 400-line review budget as a single PR, but `sdd-tasks` should still forecast per convention.

## Ready for Proposal

Yes. Key decisions to lock in the proposal: (a) hand-rolled signal validators, no Reactive Forms; (b) localStorage schema (separate capped-history vs. named-templates lists); (c) routing-key-optional validation rule; (d) explicit rationale distinguishing send-history persistence from `BusHubService`'s intentional non-persistence.
