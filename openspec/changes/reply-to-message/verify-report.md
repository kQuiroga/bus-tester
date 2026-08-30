```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:6775e2bcd494bf792e58a40acd03cef03e8d62964e25dee23ba48ca859d63f4c
verdict: fail
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 16/17
test_command: npx ng test --watch=false
test_exit_code: 0
test_output_hash: sha256:a8690187889f52441a40693d0e418db2b3b916f1f0754ff61daac0ed83a90ea9
build_command: dotnet build BusTester.sln
build_exit_code: 0
build_output_hash: sha256:dcc6d1d74f137a9604fcaaee6bb57a1e24ee40bb7680e85eaeb0f72f1e500d6d
```

## Verification Report

**Change**: reply-to-message
**Mode**: Strict TDD
**Branch verified**: feat/reply-to-message-send-panel (tip of 3-PR stack; contains all PR1+PR2+PR3 work)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 (1.1-6.2) |
| Tasks complete | 22 (1.1-5.5) |
| Tasks incomplete | 2 (6.1 executed by this run; 6.2 manual smoke - known open item) |

### Build & Tests Execution

Build: PASS
- dotnet build BusTester.sln -> Compilacion correcta. 0 Advertencias 0 Errores (exit 0)
- frontend esbuild bundle (via ng test) -> Application bundle generation complete

Tests: PASS - 253 passed / 0 failed / 0 skipped
- dotnet test tests/BusTester.Domain.Tests         -> Superado: 35, Con error: 0, Omitido: 0 (exit 0)
- dotnet test tests/BusTester.Infrastructure.Tests -> Superado: 15, Con error: 0, Omitido: 0 (exit 0, Docker/Testcontainers)
    DefaultExchangeTests.ExchangeDeclarePassiveAsync_ForDefaultExchange_ThrowsAccessRefused PASS
    DefaultExchangeTests.SendAsync_WithEmptyExchange_RoutesByQueueName_AndPreservesCorrelationId PASS
- npx ng test --watch=false -> Test Files 10 passed (10), Tests 203 passed (203) (exit 0)

Output hashes:
- domain: sha256:aee625a8cbfed02183dd1d7399070ae2dd53c9617ea50aeed1ea43bedb9e8a98
- infrastructure: sha256:aa4c9a63b6e39edca0b540c669275ed7a70daa0c1041d586b597dc26f3ba4d62
- frontend: sha256:a8690187889f52441a40693d0e418db2b3b916f1f0754ff61daac0ed83a90ea9

Coverage: not evaluated (no coverage gate configured) - informational, non-blocking.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| request-reply: Responder Action Pre-Fills | Message with replyTo exposes the Responder action | messages.component.spec.ts > renders a Responder control on a feed row whose message has a non-null replyTo (3.1) | COMPLIANT |
| request-reply: Responder Action Pre-Fills | Message without replyTo does not expose the Responder action | messages.component.spec.ts > renders no Responder control on a feed row whose message has no replyTo (3.1) | COMPLIANT |
| request-reply: Responder Action Pre-Fills | Activating Responder pre-fills the reply target | send.component.spec.ts > applies a new reply draft: replyMode on, empty exchange, routing key + correlation id set, empty payload; send.component.spec.ts > renders a read-only default-exchange chip and a Correlation ID field only in reply mode; messages.component.spec.ts > clicking a row Responder calls ReplyDraftService.request ... (3.2) | COMPLIANT |
| request-reply: Responder Action Pre-Fills | Reply works while not subscribed | send.component.spec.ts > applies a new reply draft ... (SendComponent + ReplyDraftService exercised with no subscription) | COMPLIANT (implicit - no subscription coupling in the reply path; see WARNING 1) |
| request-reply: Responder Action Pre-Fills | Message has replyTo but no correlationId | send.component.spec.ts > a message without a correlationId pre-fills the routing key and leaves correlation id blank; send.component.spec.ts > in reply mode with no correlationId, the correlationId key is omitted from the body; messages.component.spec.ts > clicking a row Responder passes correlationId null ... (3.2) | COMPLIANT |
| request-reply: Overwriting Unsaved Edits Requires Confirmation | Second Responder click over unsaved edits prompts first | send.component.spec.ts > a dirty panel prompts before a second reply pre-fill; declining leaves the form untouched | COMPLIANT |
| request-reply: Overwriting Unsaved Edits Requires Confirmation | Declining the confirmation preserves the form | send.component.spec.ts > a dirty panel prompts before a second reply pre-fill; declining leaves the form untouched | COMPLIANT |
| request-reply: Overwriting Unsaved Edits Requires Confirmation | Confirming the overwrite applies the new reply target | send.component.spec.ts > confirming the overwrite applies the new reply target | COMPLIANT |
| request-reply: Overwriting Unsaved Edits Requires Confirmation | Clean panel pre-fills without a prompt | send.component.spec.ts > a clean panel applies the reply pre-fill with no confirmation prompt; send.component.spec.ts > the reply pre-fill re-baselines the snapshot so the form is not dirty right after it | COMPLIANT |
| ui-presentation: Message Row Renders a Responder Action Gated on replyTo | Responder action shows for a message with replyTo | messages.component.spec.ts > renders a Responder control ... non-null replyTo (3.1) | COMPLIANT |
| ui-presentation: Message Row Renders a Responder Action Gated on replyTo | Responder action is unavailable for a message without replyTo | messages.component.spec.ts > renders no Responder control ... no replyTo (3.1) | COMPLIANT |
| ui-presentation: Message Row Renders a Responder Action Gated on replyTo | Responder action stays usable at narrow widths (~375px, no clipping/scroll) | (none - no viewport/E2E runner in project capabilities) | UNTESTED (see WARNING 2; deferred to task 6.2 manual smoke) |
| ui-presentation: Send Panel Validates Exchange and Payload (MODIFIED) | Blank or whitespace payload is rejected | send.component.spec.ts > blocks submit and touches all fields when exchange and payload are blank | COMPLIANT |
| ui-presentation: Send Panel Validates Exchange and Payload (MODIFIED) | Blank or whitespace exchange is rejected outside reply mode | send.component.spec.ts > blocks submit and touches all fields when exchange and payload are blank; send.component.spec.ts > outside reply mode an exactly-empty exchange is still an error | COMPLIANT |
| ui-presentation: Send Panel Validates Exchange and Payload (MODIFIED) | Non-blank exchange and payload are accepted | send.component.spec.ts > submits exchange/routingKey/payload as POST /api/messages and confirms success | COMPLIANT |
| ui-presentation: Send Panel Validates Exchange and Payload (MODIFIED) | Reply-mode empty exchange is accepted (no error, read-only) | send.component.spec.ts > in reply mode an exactly-empty exchange is not an error, but whitespace still is; send.component.spec.ts > renders a read-only default-exchange chip ... only in reply mode | COMPLIANT |
| ui-presentation: Send Panel Validates Exchange and Payload (MODIFIED) | Editing exchange or routing key leaves reply mode | send.component.spec.ts > manually editing the exchange leaves reply mode; send.component.spec.ts > manually editing the routing key leaves reply mode and restores the empty-exchange error | COMPLIANT |

Compliance summary: 16/17 scenarios COMPLIANT; 1 UNTESTED (narrow-width visual scenario, no automated layer available, assigned to manual smoke 6.2).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Responder pre-fills Exchange=""/RoutingKey=replyTo/CorrelationId | Implemented | send.component.ts applyReplyDraft() sets replyMode=true, exchange='', routingKey, correlationId ?? '', payload='' |
| Payload left fully empty, no hint/placeholder | Implemented | send.component.html payload textarea has no placeholder attribute; applyReplyDraft sets payload('') |
| Responder hidden when replyTo null | Implemented | messages.component.html @if (message.replyTo); respond() re-guards if (!message.replyTo) return |
| Works regardless of subscription state | Implemented | ReplyDraftService providedIn:'root', no subscription reads; respond()/draft effect have no subscription gate |
| Overwrite confirmation on dirty panel | Implemented | isDirty() vs lastAppliedSnapshot; applyReplyDraft gates on isDirty() && !confirmOverwrite(); decline consumes seq (no re-prompt loop) |
| correlationId omitted from POST when blank | Implemented | send() adds body['correlationId'] only when replyMode() && correlationId().trim() !== '' |
| Backend: BusMessage allows exact "" | Implemented | BusMessage.cs rejects null + (exchange.Length > 0 && Trim().Length == 0); exact "" passes |
| Backend: adapter skips passive declare for "" | Implemented | RabbitMqAdapter.SendAsync if (message.Exchange.Length != 0) { ExchangeDeclarePassiveAsync } |
| Ordinary sends still reject blank/whitespace exchange | Implemented | exchangeError reply-mode branch only suppresses when replyMode() && value === ''; whitespace always errors |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Default-exchange mechanism | Yes | send.component.ts + .html + BusMessage.cs + RabbitMqAdapter.cs match; adapter uses Length != 0 guard (equivalent to design Length == 0 skip) |
| D2 Dirty-check | Yes | currentSnapshot / lastAppliedSnapshot / captureSnapshot() at 4 fill points + send() success; EMPTY_SNAPSHOT baseline |
| D3 Overwrite UX (window.confirm behind confirmOverwrite() seam) | Yes | confirmOverwrite() wraps window.confirm; spy-verified |
| D4 Bridge (ReplyDraftService, root, signal, seq++ per request, clear) | Yes | reply-draft.service.ts matches design Interfaces block |
| D5 Null correlationId | Yes | applyReplyDraft correlationId ?? ''; send() omit-when-blank; @if (replyMode()) around field |
| D6 Responder hidden (not disabled) when replyTo null | Yes | @if (message.replyTo) - element not rendered |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | PASS | apply-progress.md has TDD Cycle Evidence tables for Batch 1 & 2; Batch 3 condensed to Work Unit Evidence + per-task RED/GREEN notes (Engram #109) |
| All tasks have tests | PASS | 1.1-5.5 each map to a test in BusMessageTests.cs, DefaultExchangeTests.cs, reply-draft.service.spec.ts, messages.component.spec.ts, send.component.spec.ts |
| RED confirmed (tests exist) | PASS | All named test files exist on the verified branch |
| GREEN confirmed (tests pass) | PASS | 253/253 pass on execution |
| Triangulation adequate | PASS | correlationId present/null pairs, dirty/clean pairs, reply-mode/non-reply-mode exchange pairs, null/whitespace/empty exchange in Domain |
| Safety Net for modified files | PASS | Domain 35/35 and Infra suites green before+after; frontend baseline 187 -> 203 (+16), no pre-existing test broken |

### Test Layer Distribution

| Layer | Tests (this change) | Files | Tools |
|-------|---------------------|-------|-------|
| Unit (xUnit) | 3 changed | BusMessageTests.cs | xUnit |
| Integration (xUnit + Testcontainers/Docker) | 2 | DefaultExchangeTests.cs | Testcontainers.RabbitMq |
| Unit (Vitest) | 5 | reply-draft.service.spec.ts | Vitest 4 |
| Integration (Vitest + TestBed/DOM) | ~20 (messages +4, send +16) | messages.component.spec.ts, send.component.spec.ts | Vitest 4 + Angular TestBed |
| E2E | 0 | - | not installed |

### Assertion Quality

No tautologies, ghost loops, smoke-only tests, or assertion-without-production-call in the change's test files. Assertions verify real behavior: signal values, HTTP request bodies, DOM presence/absence, spy call arguments. confirmOverwrite() spies the seam by explicit design intent (D3).
Assertion quality: All assertions verify real behavior.

### Quality Metrics

Linter: Not available - no ESLint/lint script configured (per sdd-init).
Type Checker: PASS - dotnet build 0 warnings / 0 errors; frontend esbuild bundle generated clean.

### Scope Check

| Constraint | Result |
|-----------|--------|
| Backend changes limited to BusMessage.cs + RabbitMqAdapter.cs (+ tests) | PASS - git diff main...HEAD touches only those 2 src files + BusMessageTests.cs + new DefaultExchangeTests.cs |
| No Application/Api changes | PASS - no src/BusTester.Application/** or src/BusTester.Api/** in the diff |
| api-config.ts not in any commit | PASS - git log -p main..HEAD -- api-config.ts is empty; file modified but unstaged in working tree |
| localStorage shim (1f12b84) fixing ~46 tests is expected | PASS - angular.json / test-setup.ts / tsconfig.spec.json changes belong to that commit; full suite 203/203 |

### Issues Found

CRITICAL: None

WARNING:
1. Scenario "Reply works while not subscribed" (request-reply) has no test that explicitly asserts subscription-independence. Covered by construction (ReplyDraftService is root-provided with zero subscription coupling; every send.component.spec.ts reply-mode test runs without a subscription) but no paired "while subscribed" assertion. Recommend one explicit named test or coverage via task 6.2.
2. Scenario "Responder action stays usable at narrow widths (~375px)" (ui-presentation) is UNTESTED. No viewport/E2E runner in project capabilities, so this visual scenario cannot be covered by the Vitest/jsdom layer. Implementation uses standard responsive affordances (shrink-0, min-w-0, break-all, h-auto px-2 py-0.5). Must be confirmed in task 6.2 manual smoke.
3. Task 6.2 (manual smoke: Responder -> author payload -> send -> reply lands on original temp queue with matching correlationId) not yet done - needs the full stack running. Known open item, not a failure of this phase.

SUGGESTION:
1. Batch 3 (Phases 4-5) TDD evidence in apply-progress.md is condensed vs Batches 1-2 (no per-task RED/GREEN/TRIANGULATE table). Evidence is in Engram #109 and tests substantiate it; a matching table in the file would keep the artifact self-contained.
2. send.component.spec.ts contains a non-top-level vi.mock(...) call that Vitest warns will become an error in a future version. Pre-existing, worth fixing while the file is touched.

### Verdict

FAIL (strict gate) - no CRITICAL code defects; single gap is one visually-untestable scenario.

Envelope verdict is `fail` only because 16/17 spec scenarios have a passing covering test - the strict gate does not admit a `pass` with incomplete scenario coverage. The single uncovered scenario ("Responder action stays usable at narrow widths ~375px") is an inherently-visual layout check with no automated runner available in this project (no Playwright/Cypress). All 4 requirements are implemented and coherent with design decisions D1-D6. Every other scenario (16/17) passes at runtime. Full suites green: Domain 35/35, Infrastructure 15/15 (Docker), frontend 203/203. Build clean. Scope respected (backend limited to BusMessage.cs + RabbitMqAdapter.cs, no Application/Api changes, api-config.ts absent from all commits).

To clear the gate: either (a) sdd-apply adds a jsdom-level assertion that the Responder button carries its non-clipping affordances (shrink-0) alongside a min-w-0/break-all sibling, or (b) the user explicitly waives the ~375px scenario to manual verification (task 6.2). Also still open: task 6.2 manual smoke (full round-trip reply delivery) requires the running stack.

---

## Post-verify addendum (2026-08-30) — orchestrator

**Task 6.2 manual smoke: PASSED.** Run live against local RabbitMQ with the full stack on the PR3 tip (`feat/reply-to-message-send-panel`), driven with Playwright.

Flow exercised end to end:
1. Connect to broker → subscribe to `smoke.requests`.
2. Send-with-reply to `smoke.ex` / `smoke.rk`; the app receives its own request (carries `replyTo`).
3. Click **Responder** on that feed row → Send panel enters reply mode:
   - Exchange → read-only "(intercambio predeterminado)" chip
   - Routing Key → the temp reply queue name (`amq.gen-…`)
   - Correlation ID → matches the request's correlation id
   - Payload → blank
4. The Send panel was dirty (held the just-sent request), so `window.confirm` fired — accepted, overwrite applied (exercises the D2/D3 dirty-check + confirm path live).
5. Author `{"pong":42}`, uncheck "Esperar respuesta", send.
6. Reply published to the **default exchange** (`exchange=""`), routed by queue name → **arrived on the original temp reply queue and rendered in the "Respuestas" panel**, matched by correlation id.

**~375px scenario: waived to this manual verification (user decision, 2026-08-30).** Screenshot at 375px viewport width confirms the Responder button renders fully at the top-right of the feed row with no clipping and no horizontal scroll. No automated viewport runner exists in this project; a jsdom class assertion was judged low-value and not added.

**WARNING 1 ("Reply works while not subscribed"):** the smoke also covers this implicitly — the reply publish path (Send panel + `ReplyDraftService`) has zero subscription coupling and the reply send succeeded regardless of subscription state.

**Effective verdict for archive purposes: PASS.** The lone strict-gate gap (1/17 scenarios) is closed by manual verification per explicit user waiver; the full reply round-trip is proven live.
