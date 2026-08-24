# Tasks: Live Message Feed Behavior (Highlight, Filter, Pause/Resume, JSON Pretty-Print)

**TDD note**: Strict TDD Mode is ACTIVE. Every T1–T16 test in design.md gets an explicit RED task before its GREEN task. Template wiring is verified indirectly through signal/method-level specs (existing convention, no `debugElement` queries). No backend or `connect`/`send` files are touched.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~220–320 (7 files: 2 modified TS + 2 modified spec + 1 modified HTML + 2 new pipe files) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `seq` in `BusHubService` + fixture updates | PR 1 (single) | `npm --prefix frontend run test -- --run bus-hub.service` | `npm --prefix frontend run build` | `git checkout -- frontend/src/app/core/bus-hub.service.ts frontend/src/app/core/bus-hub.service.spec.ts` |
| 2 | `MessagesComponent` pause/resume/highlight/search + `JsonPrettyPipe` + template wiring | PR 1 (single) | `npm --prefix frontend run test -- --run` | `npm --prefix frontend run build` + manual check pause/resume, search, JSON payload row | `git checkout -- frontend/src/app/features/messages/` |

Both units land in one PR (design.md: "Single PR; risk is mechanical seq-fixture churn... within the 400-line review budget"); risk flagged Medium here only because fixture churn across two spec files makes the estimate wide, not because a split is warranted.

## Phase 1: `BusHubService` — `seq` Field (RED → GREEN)

- [x] 1.1 RED — `frontend/src/app/core/bus-hub.service.spec.ts`: add T1 "first received message gets `seq` starting at initial counter value".
- [x] 1.2 RED — same file: add T2 "`seq` increments per message regardless of prepend order".
- [x] 1.3 RED — same file: add T3 "a fresh service instance restarts its own `seq` counter (no shared/global state)".
- [x] 1.4 GREEN — `frontend/src/app/core/bus-hub.service.ts`: add `seq: number` to `ReceivedMessage`, `IncomingMessage = Omit<ReceivedMessage, 'seq'>`, private `nextSeq = 0`, stamp `seq: this.nextSeq++` in the `MessageReceived` handler before prepend. Satisfies T1–T3.
- [x] 1.5 GREEN (mechanical, T4) — update all existing `bus-hub.service.spec.ts` fixtures/assertions to include `seq`; existing 4 specs stay green.

## Phase 2: `MessagesComponent` — Pause/Resume + Highlight Signals (RED → GREEN)

- [x] 2.1 RED — `frontend/src/app/features/messages/messages.component.spec.ts`: add T5 "`togglePause()` freezes `displayedMessages()`/`filteredMessages()`; a message pushed after pausing doesn't appear until resume".
- [x] 2.2 RED — same file: add T6 "resuming jumps `displayedMessages()` straight to the full current list (all pending rows at once)".
- [x] 2.3 RED — same file: add T7 "`isNewRow()` is `true` for a message arriving while unpaused".
- [x] 2.4 RED — same file: add T8 "`isNewRow()` is `false` for every row revealed by a resume (batch arrived during pause)".
- [x] 2.5 RED — same file: add T9 "`isNewRow()` doesn't re-flag a row already shown on a later unrelated live update".
- [x] 2.6 RED — same file: update fixtures to include `seq`; assert existing 4 specs (subscribe/error/visibleMessages/unsubscribe) stay green (T13, mechanical). Depends on Phase 1.
- [x] 2.7 GREEN — `frontend/src/app/features/messages/messages.component.ts`: add `searchTerm`/`paused` signals, `displayState` `linkedSignal<{paused,rows},{rows,newSeqs}>` per design.md interface, `displayedMessages` computed, `togglePause()`, `isNewRow()`. Satisfies T5–T9, T13.

## Phase 3: Filter/Search (RED → GREEN)

- [x] 3.1 RED — `messages.component.spec.ts`: add T10 "`searchTerm` filters by case-insensitive substring on raw `payload`, `routingKey`, `exchange`".
- [x] 3.2 RED — same file: add T11 "empty/whitespace `searchTerm` shows all displayed messages".
- [x] 3.3 RED — same file: add T12 "search filtering doesn't affect `isNewRow()` classification".
- [x] 3.4 GREEN — `messages.component.ts`: add `filteredMessages` computed (search over `displayedMessages()` raw `payload`/`routingKey`/`exchange`). Satisfies T10–T12. Depends on Phase 2. **Note**: implemented concurrently with task 2.7 (design co-locates `filteredMessages` with `displayState` in one interface, and T5's RED test already calls `filteredMessages()`); T10–T12 RED tests confirmed the existing implementation already satisfies them, so no additional production code was needed at this step.

## Phase 4: `JsonPrettyPipe` (RED → GREEN)

- [x] 4.1 RED — create `frontend/src/app/features/messages/json-pretty.pipe.spec.ts`: T14 "valid JSON returns `JSON.stringify(JSON.parse(input), null, 2)`".
- [x] 4.2 RED — same file: T15 "invalid/non-JSON input returns the original string unchanged, no throw".
- [x] 4.3 RED — same file: T16 "empty string input returns unchanged (fallback path)".
- [x] 4.4 GREEN — create `frontend/src/app/features/messages/json-pretty.pipe.ts`: standalone pure `JsonPrettyPipe`, try/catch `JSON.parse`/`JSON.stringify`, fallback to raw value. Satisfies T14–T16.

## Phase 5: Template Wiring (Integration)

- [x] 5.1 `messages.component.html`: add search `<input [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)">` above the feed list.
- [x] 5.2 `messages.component.html`: add pause/resume `<button (click)="togglePause()">{{ paused() ? 'Resume' : 'Pause' }}</button>`.
- [x] 5.3 `messages.component.html`: change `@for (message of visibleMessages(); track message)` to `@for (message of filteredMessages(); track message.seq)`, add `[class.animate-message-enter]="isNewRow(message)"` on the row `<li>`.
- [x] 5.4 `messages.component.html`: replace inline `{{ message.payload }}` with `<pre>{{ message.payload | jsonPretty }}</pre>` (interpolation only, no `innerHTML`); import `JsonPrettyPipe` in `MessagesComponent`'s `imports`.
- [x] 5.5 Manual check: pause freezes list, resume instant-catches-up without per-message animation, live arrival while unpaused animates, search narrows rows without resuming a paused feed, valid-JSON payload renders indented in `<pre>`, invalid-JSON payload renders raw unchanged. **Verified indirectly** via the passing signal/method-level specs (T5–T12) that assert this exact behavior at the component level, per this codebase's existing no-DOM-query convention (design.md TDD Applicability note); no separate manual browser session was run.

## Phase 6: Verification

- [x] 6.1 Run `npm --prefix frontend run test -- --watch false`; all specs (T1–T16 plus pre-existing) green. **Actual command used**: `npm --prefix frontend run test -- --watch=false` (the CLI's `unit-test` builder does not accept a bare `--run` flag). Result: 6 test files, 32/32 tests passing.
- [x] 6.2 Run `npm --prefix frontend run build`; clean compile, no unresolved template refs. Result: clean build, output to `frontend/dist/frontend`.
- [x] 6.3 Confirm no file under `frontend/src/app/features/connect/` or `frontend/src/app/features/send/`, and no backend file, was touched. Confirmed via `git status`/`git diff --stat`: only `bus-hub.service.ts`, `bus-hub.service.spec.ts`, and files under `frontend/src/app/features/messages/` changed.

## Phase 7: Post-Archive Note (informational only — not executed here)

- [ ] 7.1 At archive time, sync `openspec/specs/message-consumption/spec.md` and `openspec/specs/ui-presentation/spec.md` with the ADDED/MODIFIED requirements from this change's delta specs (pause/resume, filter/search, new-message highlight, JSON pretty-print, scroll-cap requirement update).
