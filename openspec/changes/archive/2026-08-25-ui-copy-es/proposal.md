# Proposal: Translate Frontend UI Copy to Spanish

## Intent

The app currently mixes an English-only interface with an eventual audience beyond the current developer. Every user-visible string in the Angular frontend (labels, buttons, placeholders, headings, status text, error fallbacks, the one aria-label, and `index.html`'s `lang`/`title`) is hardcoded English. Before other people start using BusTester, the interface itself should speak Spanish and read clearly — without building a language-switching system that isn't needed yet.

## Scope

### In Scope
- Translate all hardcoded UI copy to Spanish across: `app.html`/`app.ts` (non-brand strings only), `index.html`, `connect.component.html`/`.ts`, `send.component.html`/`.ts`, `messages.component.html`/`.ts`.
- Make copy slightly more descriptive where it is currently terse or ambiguous (e.g. clarify "Host" as the broker host field), while keeping labels short enough for the existing layout.
- `index.html`: `<html lang="en">` → `lang="es"`; `<title>Frontend</title>` → a descriptive Spanish title tied to the app (e.g. "BusTester — Cliente de pruebas RabbitMQ").
- Translate the one existing `aria-label` (messages.component.html unsubscribe button), keeping correct Spanish grammar around the interpolated `queueName`.
- Harmonize "Use" (recent-sends) vs "Load" (templates) into one consistent Spanish verb for "populate the form from this saved item" (both rows perform the same underlying action).
- Normalize validation-message tone in Spanish even though "Exchange is required." / "Payload is required." and "Routing key cannot be blank." follow different English patterns today.
- Update the listed `.spec.ts` assertions on frontend-copy strings to match new Spanish text: `send.component.spec.ts` ('Message sent.', 'Exchange is required.', 'Payload is required.', 'Routing key cannot be blank.'); `connect.component.spec.ts` ('Disconnected', 'Reconnecting', 'last known'); `messages.component.spec.ts` frontend-fallback strings.

### Out of Scope
- Any multi-language i18n system: no language switcher, no `@angular/localize`, no translation/resource files. Direct hardcoded-string replacement only, matching the existing English-hardcoded pattern.
- Backend error copy: `BusExceptionHandler.cs` `ProblemDetails.Title` values and `RabbitMqAdapter.cs` exception messages stay English. These `detail` strings are what `errorMessage()` renders in the common real-failure case (broker down, bad exchange, bad queue), so most real error text will remain English after this change — a known, accepted limitation and named candidate for a follow-up change (`backend-error-copy-es`), not silently glossed over.
- `.spec.ts` assertions on backend-sourced text (`toContain("Could not publish to exchange...")`, `toContain("Could not connect to RabbitMQ")`, `toContain("Could not subscribe to queue...")`) — untouched, they test backend copy which stays out of scope.
- Code identifiers, comments, commit messages, and other technical artifacts — stay English per existing project convention.
- Any change to `send.component`'s validation rules, connection lifecycle, or subscription behavior — copy-only change.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — the 5 existing specs (`bus-connection`, `message-sending`, `message-consumption`, `ui-presentation`, `connection-status`) describe behavior/state semantically, not literal required copy, with one caveat: `connection-status`'s spec quotes "connecting"/"disconnecting" as state-concept words, not mandated literal UI text. Confirm no delta is needed during sdd-spec; if a scenario is found to assert exact literal copy, add a targeted delta there instead of here.

## Approach

Direct relabeling pass, file by file, translating every hardcoded string in templates and component/service TypeScript to Spanish. No new abstraction, no extraction to constants beyond what already exists (e.g. `HUB_STATUS_LABELS` map keeps its shape, only values change). Landed fully before the upcoming `request-reply-support` change to avoid interleaved edits on `send.component.html`/`.ts`.

## Proposal question round

**User answers (confirmed 2026-08-25)**:
1. **Scope**: frontend-only Spanish translation of all hardcoded UI copy, with light descriptive improvements — not an i18n system.
2. **Backend `detail` messages**: explicitly out of scope, documented as a known limitation and named as a candidate follow-up change.
3. **Sequencing**: this change lands first, before `request-reply-support` touches `send.component`.
4. **"Use" vs "Load" inconsistency**: harmonize into one consistent verb as part of this change.
5. **`index.html`**: `lang="es"` and a real, descriptive Spanish `<title>`.
6. **aria-label**: translated, with correct grammar around interpolated queue name.
7. **`.spec.ts` updates**: frontend-copy assertions updated in this change; backend-sourced-text assertions left untouched.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `frontend/src/index.html` | Modified | `lang="es"`, descriptive `<title>` |
| `frontend/src/app/app.html` | Modified | Any non-brand shell copy (brand `title` string stays "BusTester") |
| `frontend/src/app/features/connect/connect.component.html` | Modified | Labels, buttons, pending/status text |
| `frontend/src/app/features/connect/connect.component.ts` | Modified | `HUB_STATUS_LABELS`, error fallback string |
| `frontend/src/app/features/connect/connect.component.spec.ts` | Modified | Update assertions on translated frontend strings |
| `frontend/src/app/features/send/send.component.html` | Modified | Labels, buttons, empty states, "Use"/"Load" harmonization |
| `frontend/src/app/features/send/send.component.ts` | Modified | Validation errors, confirmation, error fallback |
| `frontend/src/app/features/send/send.component.spec.ts` | Modified | Update assertions on translated frontend strings |
| `frontend/src/app/features/messages/messages.component.html` | Modified | Labels, button, placeholder, aria-label |
| `frontend/src/app/features/messages/messages.component.ts` | Modified | Error fallback strings |
| `frontend/src/app/features/messages/messages.component.spec.ts` | Modified | Update assertions on translated frontend strings |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|--------------|
| Users perceive translation as incomplete because most real errors still render English `detail` from the backend | Medium | Document explicitly as accepted limitation and follow-up candidate in this proposal and in PR description |
| Spec files test backend-sourced text and could be mistakenly "fixed" alongside frontend copy | Low | Explicit out-of-scope list above; verify each `.spec.ts` change against the inventory before editing |
| Layout breakage if Spanish strings are meaningfully longer than English originals (e.g. buttons, chip labels) | Low | Prefer concise Spanish phrasing; visually check layout at existing responsive breakpoints during apply |
| File overlap with not-yet-started `request-reply-support` change on `send.component` | Low | Sequencing decision: this change lands first, fully, before that change begins |

## Rollback Plan

Frontend-only, no backend/schema/migration involved. Revert the commit(s) touching the listed `.html`/`.ts`/`.spec.ts` files; no data migration or backend rollback needed.

## Dependencies

None.

## Success Criteria

- [ ] No hardcoded English user-visible string remains in `app.html`, `index.html`, or the three feature components (labels, buttons, placeholders, headings, status/error text, aria-label).
- [ ] `index.html` has `lang="es"` and a descriptive Spanish `<title>`.
- [ ] "Use" and "Load" are harmonized to one consistent Spanish verb across recent-sends and templates rows.
- [ ] All listed frontend-copy `.spec.ts` assertions pass with new Spanish text; backend-sourced-text assertions remain unchanged and still pass.
- [ ] Backend `detail` messages remain English and are documented as an explicit, accepted out-of-scope limitation.
