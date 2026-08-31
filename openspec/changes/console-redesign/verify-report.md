```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1af9f3484a14e30a987091ed865a5b8baf6f65d3e053018bafc264f2450a2c5e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 1/1
scenarios: 4/4
test_command: npm test -- --watch false
test_exit_code: 0
test_output_hash: sha256:a45305f0e829acaef774553e8c06af4d8d69036bf2b5cd6d217324736db8f413
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:96d7d15b07766907f559f398fc18008c74479826d71ec27416e1e83ea9421b93
```

## Verification Report — console-redesign SLICE 3 only (PR3)

**Change**: console-redesign
**Slice**: 3 — Recent sends: cap 5, "Vaciar" control, first-load truncate-to-5 migration, layout rework
**Branch**: `feat/console-redesign-s3-send` @ `a5ab95c` (child of `feat/console-redesign-s2-connect` @ `a2d1a35`)
**Mode**: Strict TDD (Vitest) | **Verdict**: PASS WITH WARNINGS — ready to open as PR3 targeting `feat/console-redesign-s2-connect`.
**Validator**: `gentle-ai sdd-verify-validate --requirements 1 --scenarios 4` → admitted, verdict pass_with_warnings.

### Scope

Slice-3 spec scope is exactly one ui-presentation requirement: **"Recent Sends Are Recorded, Capped, and Recallable"** (4 scenarios). The other ui-presentation requirements (Dark Mode, Graphite palette, Accent) were verified with slice 1; "Queues Are Identified by a Tinted Pill and Dot" belongs to slice 4. Slices 4–5 are not implemented and are not flagged as missing. The D7 reply-mode / unsaved-edits guard code in `send.component.ts` is deliberately retained for slice 5 (task 5.8) and is not flagged.

### Completeness

| Task | State | Code match |
|---|---|---|
| 3.1 RED — service spec: cap 5 FIFO, `clearRecentSends()` memory+removeItem, `loadCapped()` truncate+rewrite | [x] | Yes — 5 new/rewritten tests in `send-history.service.spec.ts` |
| 3.2 RED — component spec: `Vaciar` → `clearRecentSends()`, recall populates fields | [x] | Yes — 2 new tests + row-action count update in `send.component.spec.ts` |
| 3.3 GREEN — `RECENT_SENDS_CAP = 5`, `loadCappedRecentSends()`, `clearRecentSends()` | [x] | Yes — `send-history.service.ts` |
| 3.4 GREEN — recent-sends layout (≤5) + `Vaciar` wired | [x] | Yes — `send.component.{ts,html}` |
| 3.5 REFACTOR — component delegates only, zero storage access | [x] | Yes — `clearRecent()` is a one-line delegate; `rg localStorage` on `send.component.ts` = 0 hits |

All slice-3 tasks 3.1–3.5 are `[x]` in `tasks.md` and consistent with the committed code. `apply-progress.md` slice-3 section (lines 184+) and Engram #163 match.

### Build & Tests

- `npm test -- --watch false` (frontend/) → **exit 0 · 13 files / 199 tests passed, 0 failed** (slice-2 baseline 13 / 193; net +6: service +4, component +2). Output hash `sha256:a45305f0…`.
- `npm run build` (frontend/) → **exit 0**. Initial bundle 630.24 kB; the 500 kB budget WARNING is the pre-existing `@angular/cdk/overlay` cost introduced by slice 2's vendored dialog (design D3), not a slice-3 regression. Slice 3 adds ~2 kB (628.09 → 630.24). Output hash `sha256:96d7d15b…`.
- Coverage: no coverage tool configured. No e2e/integration harness — Vitest unit/component layer only.

### Spec Compliance — "Recent Sends Are Recorded, Capped, and Recallable" (1 requirement / 4 scenarios)

| Scenario | Status | Covering test (passed at runtime) |
|---|---|---|
| Successful send added newest-first and capped at 5 (FIFO evict oldest) | COMPLIANT | `send-history.service.spec.ts` — "recordSend caps the list at 5 entries, evicting the oldest (FIFO)": records 6, asserts `length === 5`, `sends[0].routingKey === 'orders.5'`, `sends[4].routingKey === 'orders.1'` |
| Recalling a recent send populates `exchange`, `routingKey`, `payload` | COMPLIANT | `send.component.spec.ts` — "useRecent(entry) populates exchange/routingKey/payload from a recent send" |
| Vaciar clears the list AND deletes the persisted key; still empty after reload | COMPLIANT | `send-history.service.spec.ts` — "clearRecentSends empties the in-memory list AND removes the persisted localStorage key" (asserts `recentSends() === []` and `getItem(key) === null`) + "clearRecentSends keeps the list empty after a reload" (`TestBed.resetTestingModule()` + re-inject → `[]`). Component wiring: `send.component.spec.ts` "the 'Vaciar' control is shown only when recent sends exist and clears them via the service" |
| Upgrade migration — persisted list >5 truncated to 5 most recent AND key rewritten on first init | COMPLIANT | `send-history.service.spec.ts` — "truncates a persisted list longer than 5 to the 5 most recent AND rewrites the key on first load": seeds an 8-entry array, `resetTestingModule()` + re-inject, asserts in-memory list is the first 5 AND `JSON.parse(localStorage.getItem(key))` is those same 5 |

4/4 scenarios COMPLIANT, each with a covering test that passed at runtime.

### Migration Edge Cases

| Case | Behavior | Evidence |
|---|---|---|
| Empty / missing key | `readArray` → `[]`; `length 0 ≤ 5` → returned untouched, no write | "starts with empty recentSends…when localStorage is empty" |
| Corrupted JSON | `readArray` catch → `[]`; no throw, no rewrite | "falls back to an empty recentSends list without throwing when its localStorage entry is corrupted JSON" (line 134) |
| Exactly 5 entries | `length 5 ≤ 5` → returned untouched, `localStorage.setItem` not called | "leaves a persisted list of 5 or fewer entries untouched on load" (asserts stored list still length 5) |
| Fewer than 5 | same untouched path | covered by empty-list + 2-entry newest-first tests; 5-or-fewer test name is inclusive |
| More than 5 | `slice(0, 5)` + `setItem` rewrite | migration test above |

### Correctness / Coherence (design D6)

- `RECENT_SENDS_CAP` is `5` (`send-history.service.ts:5`). Was 20.
- Construction-time migration: `_recentSends` signal initializer calls `loadCappedRecentSends()` (`:69`) — runs once at service instantiation, matching D6 "construction-time `loadCapped()`" and the spec's "first init after upgrade".
- `loadCappedRecentSends()` (`:50`) truncates with `stored.slice(0, RECENT_SENDS_CAP)` (list is newest-first, so this keeps the 5 most recent) and `localStorage.setItem(RECENT_SENDS_KEY, …)` only when `stored.length > 5`. No preserve-and-hide. Matches decision #152.3.
- `clearRecentSends()` (`:87`) = `_recentSends.set([])` + `localStorage.removeItem(RECENT_SENDS_KEY)`. Templates untouched. Matches decision #152.2.
- `recordSend` already applies `.slice(0, RECENT_SENDS_CAP)` (`:77`), so cap-5 FIFO on new sends needs no extra code.
- Component only delegates: `clearRecent()` (`send.component.ts:379`) is `this.history.clearRecentSends();` and nothing else. No `localStorage` reference anywhere in `send.component.ts` (task 3.5).
- Deviation: D6 names the helper `loadCapped()`; implemented as module-level `loadCappedRecentSends()`, the same pattern as the existing `readArray` helper. Behaviourally identical; not a spec break.

### Layout rework

`send.component.html` recent-sends block: container `[data-testid="recent-sends"]`; header row with `Envíos recientes` + live `N/5` counter (shown only when entries exist); ghost `[data-testid="recent-sends-clear"]` "Vaciar" button with `lucideTrash2`, rendered only while `history.recentSends().length > 0`; two-line `[data-testid="recent-send-row"]` cards (exchange over routing key, `(intercambio predeterminado)` / `(sin clave de enrutamiento)` placeholders) on `bg-background/60` + `rounded-lg`; `@for` track changed from `recent.sentAt` to `$index`. "Cargar" recall button unchanged. No hardcoded radii or colors introduced — all Tailwind token classes.

### No scope leak

Slice-3 diff `a2d1a35..a5ab95c` touches only:

```
frontend/src/app/features/send/send-history.service.spec.ts | 70 +
frontend/src/app/features/send/send-history.service.ts      | 32 +
frontend/src/app/features/send/send.component.html          | 45 +
frontend/src/app/features/send/send.component.spec.ts       | 35 +
frontend/src/app/features/send/send.component.ts            |  6 +
openspec/changes/console-redesign/apply-progress.md         | 65 +
openspec/changes/console-redesign/tasks.md                  | 10 +
```

Only `features/send/**` + SDD docs. No messages-feed, queue-color, reply-drawer, connect, or token changes. Reply-mode / dirty-guard regions of `send.component.ts` are untouched (the 6 added lines are the `clearRecent()` method only). No vendored output. Working tree clean at `a5ab95c`.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | Yes | apply-progress "TDD evidence" table, tasks 3.1–3.5 |
| All tasks have tests | Yes | 3.1/3.2 are the test tasks; 3.3/3.4 driven by them; 3.5 refactor |
| RED confirmed (tests exist) | Yes | all 7 new test cases present in the two spec files |
| GREEN confirmed (tests pass) | Yes | 199/199 on fresh run |
| Triangulation | Adequate | migration path has 3 distinct cases (>5 truncate+rewrite, exactly-5 untouched, empty); clear path has 2 (removeItem + reload persistence); assertions use varied expected values, not repeated empties |
| Safety net for modified files | Yes | both spec files pre-existed; full suite (193) run green before the change per apply-progress |

RED evidence is a compile-gate (`Property 'clearRecentSends' does not exist on type 'SendHistoryService'`) rather than a red assertion for tasks 3.1/3.2 — acceptable for an additive API in a typed codebase; the behavioural assertions that follow are substantive.

### Assertion Quality Audit

New/changed test files: `send-history.service.spec.ts`, `send.component.spec.ts`.

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `send.component.spec.ts` | 223 | `expect(clearSpy).toHaveBeenCalledTimes(1)` (delegation-only test) | Mock call-count assertion with no behavioural companion in the same test | SUGGESTION |
| `send.component.spec.ts` | 416 | `expect(buttons.length).toBe(6)` | DOM element-count coupling (pre-existing pattern in this file, bumped 5→6) | SUGGESTION |

No tautologies, no assertions without a production-code call, no ghost loops, no orphan empty-array checks (every `toEqual([])` has a companion assertion of non-empty state or a prior `recordSend`). The delegation concern is mitigated by the sibling test "the 'Vaciar' control is shown only when recent sends exist…" which asserts real show/hide DOM behaviour + click wiring, and by the service-level `clearRecentSends` tests that assert the actual `[]` + `removeItem` outcome.

**Assertion quality**: 0 CRITICAL, 0 WARNING, 2 SUGGESTION.

### Test Layer Distribution

| Layer | Tests | Files | Tool |
|---|---|---|---|
| Unit (service, isolated) | 9 (`send-history.service.spec.ts`) | 1 | Vitest + TestBed |
| Component (TestBed `createComponent` + DOM queries) | remainder of `send.component.spec.ts` | 1 | Vitest + Angular TestBed |
| E2E | 0 | 0 | not installed |
| **Total (suite)** | **199** | **13** | |

### Issues

**CRITICAL**: none.

**WARNING**: none.

**SUGGESTION**:
- S1: `clearRecent()` delegation test (`send.component.spec.ts:215`) asserts only `spy.toHaveBeenCalledTimes(1)`. Consider asserting the observable outcome (list emptied in the rendered DOM) so the test survives a refactor of the delegation target's name.
- S2: The exactly-5 migration test asserts the persisted list still has length 5 but does not assert `localStorage.setItem` was *not* called. The code path is correct (early return before any write); an explicit "no rewrite" spy assertion would lock it in.
- S3: `expect(buttons.length).toBe(6)` couples a test to the total button count of the panel; a future control added elsewhere in `send.component.html` will break it for an unrelated reason.
- S4 (carried from slice 2): initial bundle remains over the 500 kB Angular budget (630.24 kB). Pre-existing `@angular/cdk/overlay` cost from slice 2; slice 3 adds ~2 kB. Not a slice-3 regression — resolve the budget globally (raise the budget or lazy-load the dialog) at chain end.

### Verdict

**PASS WITH WARNINGS** (0 blockers, 0 critical, 0 warning, 4 suggestions).

Slice 3 is **ready to open as PR3 targeting `feat/console-redesign-s2-connect`**. The spec requirement and all 4 scenarios are implemented and covered by passing tests, the design D6 contract is met, TDD was followed, and the diff is scope-clean. The build budget warning is a pre-existing slice-2 artifact, not a slice-3 regression.

**Next recommended**: `sdd-apply` for slice 4 (or open PR3 first per the feature-branch chain). No `sdd-archive` until all 5 slices land.
