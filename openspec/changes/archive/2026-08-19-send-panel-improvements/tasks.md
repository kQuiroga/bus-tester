# Tasks: Send Panel UX Improvements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380-420 (2 new files ~150, 3 modified diff ~230-270) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (validation) -> PR 2 (history/templates) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

Note: proposal estimated ~150-250 lines; corrected estimate is higher once template CRUD markup and the new service+spec are counted (new files fully count as additions).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Inline validation (exchange/payload required, routingKey optional-if-present, gated submit) | PR 1 | `npm test -- send.component.spec` (from `frontend/`) | N/A — client-side only, Vitest+jsdom covers it | Revert Phase 2 commits (error signals, blur handlers, inline errors, validation specs); `send()` POST unaffected |
| 2 | `SendHistoryService` + recent-sends/templates UI wired into `SendComponent` | PR 2 | `npm test -- send-history.service.spec send.component.spec` | N/A — client-side only, Vitest+jsdom covers it | Revert Phase 1+3 commits (service, its spec, history/template UI+specs); Unit 1 validation stays intact |

## Phase 1: SendHistoryService (Foundation)

- [x] 1.1 RED: `send-history.service.spec.ts` — recordSend adds newest-first; caps at 20 (FIFO evicts oldest); saveTemplate dedupes by name; deleteTemplate removes entry; corrupted JSON on `send-panel.recent-sends` falls back to `[]` without throwing; non-array JSON on `send-panel.templates` falls back to `[]`.
- [x] 1.2 GREEN: Create `send-history.service.ts` (`providedIn:'root'`, `RecentSend`/`SendTemplate` interfaces, `recordSend`/`saveTemplate`/`deleteTemplate`, try/catch JSON.parse -> `[]`, cap 20 via unshift+slice).
- [x] 1.3 REFACTOR: Extract shared localStorage-parse helper if duplicated; re-run suite green.

## Phase 2: Inline Field Validation

- [x] 2.1 RED: `send.component.spec.ts` — blank exchange/payload blocks submit and shows error only after touched/blocked-submit; whitespace-only routingKey blocked; empty routingKey passes; existing valid-submit case still passes.
- [x] 2.2 GREEN: `send.component.ts` — add `touched` Set signal, `exchangeError`/`payloadError`/`routingKeyError`/`hasErrors` computed; `send()` short-circuits and touches all fields on invalid submit. `send.component.html` — add `(blur)="onBlur(field)"` per input and inline error `@if` block using `status-error`/`status-error-bg` tokens.
- [x] 2.3 REFACTOR: Tidy repeated blur/error markup; re-run full suite green.

## Phase 3: History and Template Integration

- [x] 3.1 RED: `send.component.spec.ts` — successful send calls `SendHistoryService.recordSend`; `useRecent(entry)` populates exchange/routingKey/payload; `saveTemplate()` persists a named template; `useTemplate(t)` populates fields and re-touches all; `deleteTemplate(name)` removes it.
- [x] 3.2 GREEN: Inject `SendHistoryService` into `SendComponent`; add `templateName` signal and `onBlur`/`useRecent`/`useTemplate`/`saveTemplate`/`deleteTemplate` methods; call `history.recordSend(...)` only on `send()` success. In the template, add "Recent sends" (recall) and "Templates" (name input, save/load/delete) sections below the existing blocks.
- [x] 3.3 REFACTOR: Tidy component/template together, minimal diff; re-run full suite green.

## Phase 4: Final Verification

- [x] 4.1 Run full frontend suite (`npm test` from `frontend/`); confirm all new/modified specs pass and `connect`/`messages` specs are unaffected.
- [x] 4.2 Cross-check every scenario in `specs/ui-presentation/spec.md` has a passing test; manual smoke of the proposal's Success Criteria.
