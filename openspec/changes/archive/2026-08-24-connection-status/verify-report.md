```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3c3a1314874450dd3fc4c280e75fed1248e13da84449cc13fbb02471c36f7b3a
verdict: fail
blockers: 3
critical_findings: 3
requirements: 3/5
scenarios: 14/17
test_command: npm test -- --watch=false
test_exit_code: 0
test_output_hash: sha256:3c3a1314874450dd3fc4c280e75fed1248e13da84449cc13fbb02471c36f7b3a
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:f9b7dbb0b104c9d11d56285ba56397b7050982db5c75d272120a1943d8d11b90
```

## Verification Report

**Change**: connection-status
**Version**: N/A
**Re-verification**: Yes - follow-up to prior FAIL verdict (Engram id 100). This report supersedes that one.
**Mode**: Strict TDD

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (Engram sdd/connection-status/tasks, id 98) | 26 (25 original + 1 follow-up remediation task) |
| Tasks total (openspec/changes/connection-status/tasks.md, canonical checklist) | 22 numbered checkboxes |
| Tasks complete | 22/22 (100%), 0 unchecked |
| Tasks incomplete | 0 |

Note: the Engram tasks record's "26/26" figure folds the follow-up runtime-test remediation into the existing checklist (task 5.3 was rewritten, not appended as a new numbered item) rather than adding a 23rd checkbox. The canonical openspec/changes/connection-status/tasks.md file, independently read in this pass, has 22 items, all [x], 0 [ ]. Both artifacts agree on 100% task completion; the "26" vs "22" count is a reporting-granularity mismatch, not a completion gap (see Issues/SUGGESTION). Task completion is not what drives this report's FAIL verdict below - spec scenario coverage is.

### Build and Tests Execution
**Build**: Passed (independently re-run in this verify pass)
```text
npm run build (ng build) -> exit 0
Initial total 300.57 kB, Output location: frontend/dist/frontend
Application bundle generation complete. [1.899 seconds]
```

**Tests**: 63 passed / 0 failed / 0 skipped (independently re-run in this verify pass, not taken from apply-progress claims)
```text
npm test -- --watch=false (ng test, vitest v3.2.7) -> exit 0
Test Files  7 passed (7)
     Tests  63 passed (63)
  Duration  3.68s
Files: spec-json-pretty.pipe.spec.js (3), spec-send-history.service.spec.js (8),
spec-bus-hub.service.spec.js (16), spec-send.component.spec.js (12),
spec-messages.component.spec.js (12), spec-connect.component.spec.js (10), spec-app.spec.js (2)
```
Matches apply-progress's claimed 63/63 exactly (62 prior + 1 new ownership test in connect.component.spec.ts, which grew 9 to 10 tests).

**Coverage**: Not available (no coverage tool configured in this repo, unchanged from prior verify pass)

### Spec Compliance Matrix

**Domain: connection-status**

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Hub Connection State Is Exposed Read-Only | Initial start reflects connecting then connected | bus-hub.service.spec.ts | COMPLIANT |
| Hub Connection State Is Exposed Read-Only | onreconnecting sets reconnecting state | bus-hub.service.spec.ts | COMPLIANT |
| Hub Connection State Is Exposed Read-Only | onreconnected restores connected state | bus-hub.service.spec.ts | COMPLIANT |
| Hub Connection State Is Exposed Read-Only | onclose sets disconnected state | bus-hub.service.spec.ts | COMPLIANT |
| Hub Connection State Is Exposed Read-Only | State is read-only to consumers | bus-hub.service.spec.ts plus source-verified connectionState = _connectionState.asReadonly(), no public setter | COMPLIANT |
| Hub Connection Ownership Stays With MessagesComponent | ConnectComponent never starts the hub | connect.component.spec.ts lines 199-208, new runtime test: renders ConnectComponent standalone via TestBed.createComponent, asserts fakeHubConnection.started is false. Independently re-verified: FakeHubConnection.started defaults false, set true only inside start() (fake-hub-connection.ts:16,40), not a tautology, a genuine runtime assertion | COMPLIANT (was UNTESTED/CRITICAL in prior report id 100, now RESOLVED) |
| Hub Connection Ownership Stays With MessagesComponent | Hub status renders once MessagesComponent has started it | connect.component.spec.ts: renders hub status once connectionState leaves idle, independent of connected() | COMPLIANT |
| Broker Connect and Disconnect Show a Pending State | Connect button disables during connecting | connect.component.spec.ts | COMPLIANT |
| Broker Connect and Disconnect Show a Pending State | Disconnect button disables during disconnecting | connect.component.spec.ts | COMPLIANT |
| Broker Connect and Disconnect Show a Pending State | Pending state clears on settlement | connect.component.spec.ts (4 combos) | COMPLIANT |
| Broker and Hub Status Render as Distinguishable, Combined Affordance | Broker and hub states are labeled distinctly | connect.component.spec.ts (broker-status/hub-status testids) | COMPLIANT |
| Broker and Hub Status Render as Distinguishable, Combined Affordance | Reconnecting renders inline, not as a banner | connect.component.spec.ts (shared parentElement assertion) | COMPLIANT |
| Broker and Hub Status Render as Distinguishable, Combined Affordance | Broker state never implies live continuity | none, unchanged from prior report, still no test asserting last-known-snapshot copy semantics | UNTESTED - CRITICAL (reclassified from WARNING, see Issues) |

**Domain: ui-presentation (delta)**

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Status Messages Are Visually Differentiated | Success status is visually distinct | Inherited, unchanged by this diff | COMPLIANT |
| Status Messages Are Visually Differentiated | Error status is visually distinct | Inherited, unchanged by this diff | COMPLIANT |
| Status Messages Are Visually Differentiated | Pending/reconnecting status uses the warn token | Source-verified only (connect.component.ts HUB_STATUS_CLASSES plus connect.component.html line 65 warn classes); still no test asserting the class string | UNTESTED - CRITICAL (reclassified from WARNING, see Issues) |
| Status Messages Are Visually Differentiated | Warn tokens render in both themes | Source-verified only (styles.css lines 19-26 light, 64-69 dark); still no theme-toggle harness in this repo (jsdom cannot resolve oklch) | UNTESTED - CRITICAL (reclassified from WARNING, see Issues) |

Compliance summary: 14/17 scenarios compliant (up from 13/17 in prior report id 100), 3 UNTESTED, 0 FAILING. The prior report's sole CRITICAL scenario (hub-start ownership) is now COMPLIANT with a genuine runtime test - real, independently-verified progress. However 3 pre-existing UNTESTED scenarios remain, and per this protocol's hard rule ("a spec scenario is compliant only when a covering test passed at runtime", Decision Gate: untested scenario equals CRITICAL) they must be counted as CRITICAL rather than the WARNING classification the prior report (id 100) applied to them. That prior WARNING classification was a deviation from the hard rule, not a validated exception.

### Correctness (Source-Verified This Pass)
| Requirement | Status | Notes |
|------------|--------|-------|
| HubConnectionState type plus signal wiring | Implemented | bus-hub.service.ts lines 20,40,45 match design.md interface exactly |
| ConnectComponent never calls start()/stop() | Implemented plus now runtime-tested | Zero grep matches in features/connect/; sole caller is messages.component.ts:90; runtime test added this batch closes the prior CRITICAL |
| pending signal drives 6 [disabled] bindings | Implemented | connect.component.html: 4 inputs + 2 buttons, all use || pending() |
| Combined status region (broker + hub, distinguishable) | Implemented | broker-status/hub-status testids as siblings, connect.component.html lines 62-78 |
| Warn design tokens (light + dark) | Implemented | styles.css lines 19-26 (light), 64-69 (dark), exact ok/error pattern |

Note: the "Correctness" table above reflects source-inspection evidence only. Under this protocol, source inspection alone does not satisfy spec scenario compliance for the 3 CRITICAL items below - correctness of the implementation is not in question, runtime proof is what is missing.

### Coherence (Design, Engram sdd/connection-status/design id 96)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Single boolean pending signal covers both connect/disconnect | Yes | connect.component.ts:54, matches design.md exactly |
| Hub status hidden while idle, unconditional once non-idle | Yes | HUB_STATUS_LABELS.idle = null (connect.component.ts:13), computed signal drives the @if |
| connectionState ownership lives entirely in BusHubService | Yes | No separate ConnectionStatusService introduced |
| Shared FakeHubConnection test double | Yes | frontend/src/app/core/testing/fake-hub-connection.ts, used by both spec files, extended this batch's new test with no changes needed to the fake itself |

### Diff Size (Re-verified This Pass)
Independently re-counted, not taken from apply-progress claims: git diff --stat HEAD = 7 tracked files, +283/-47 (330 lines). Untracked frontend/src/app/core/testing/fake-hub-connection.ts = 64 lines (all additions, confirmed via wc -l). Total: 8 files, approximately +347/-47 (394 total changed lines) by this independent count; apply-progress claims +345/-47 (392 total), a 2-line variance likely from counting-method differences (e.g. trailing-newline handling). Both figures agree: 8 files, within the 400-line budget, single-digit-lines margin remaining (6-8 lines depending on method). This resolves the prior report's WARNING (which flagged a much larger undercount: 383 vs the corrected approximately 392-394); the residual 2-line discrepancy is immaterial to the budget conclusion (see SUGGESTION).

### Issues Found

**CRITICAL** (3, all pre-existing UNTESTED spec scenarios, reclassified from WARNING in prior report id 100 to comply with this protocol's hard rule that an untested scenario is CRITICAL, not WARNING):

1. Spec scenario "Broker state never implies live continuity" (connection-status, Requirement "Broker and Hub Status Render as Distinguishable, Combined Affordance") has no covering runtime test. The broker "Connected" copy is unchanged from before this feature and does not explicitly signal a last-known-snapshot framing. No functional regression found (the badge is static, non-polling, and sits next to a clearly separate live hub indicator), but the scenario is formally untested and this protocol requires a passing runtime test for scenario compliance regardless of perceived low risk.
2. Spec scenario "Pending/reconnecting status uses the warn token" (ui-presentation delta) has no test asserting the applied CSS class string; verified only by source inspection of connect.component.html/connect.component.ts (HUB_STATUS_CLASSES, STATUS_WARN_CLASSES). A DOM-based test asserting the rendered class attribute contains the warn token classes (e.g. via the existing hub-status/broker-status testids already used elsewhere in this spec file) is feasible with the current Vitest/TestBed harness and would close this gap.
3. Spec scenario "Warn tokens render in both themes" has no automated coverage; jsdom (the test environment used by this repo's Vitest setup) cannot resolve oklch color values, so no theme-toggle runtime test is currently feasible without additional tooling (e.g. a real-browser or CSS-computation harness). Verified only by reading styles.css. This is the one item among the three where the "no test infrastructure available" argument is strongest, but the hard rule still classifies it as CRITICAL absent an explicit accepted exception from the user/orchestrator.

The prior CRITICAL finding from report id 100 - "Spec scenario ConnectComponent never starts the hub has no passing runtime test" - is RESOLVED. connect.component.spec.ts lines 199-208 now contain a genuine runtime assertion (expect(fakeHubConnection.started).toBe(false) after rendering ConnectComponent standalone), independently re-verified in this pass: (1) the test exists and reads as claimed, (2) FakeHubConnection.started is a real mutable flag defaulting false and set true only inside start(), not a tautological or pre-satisfied assertion, (3) the full suite including this test passes at exit 0 when independently re-run (63/63, not just taken from apply-progress's word). This scenario is no longer among the CRITICAL findings above.

**WARNING**: None remaining as WARNING-severity in this pass - both of the prior report's WARNING findings that were genuinely fixable process gaps are RESOLVED (see below), and the 3 remaining spec-coverage gaps are reclassified to CRITICAL above per the hard rule.

Prior WARNING #1 (undocumented angular.json change) is RESOLVED: apply-progress's Batch 1 Files Changed table now explicitly documents it as the Angular CLI's own non-interactive analytics-opt-out persistence, with a stated rationale for leaving it as-is. Independently re-verified: the diff is still exactly analytics: false added under cli, consistent with that explanation, and it is no longer an undocumented out-of-band change.

Prior WARNING #2 (diff-count undercount) is substantially RESOLVED: apply-progress corrected the total from the original 272/47-only figure to an 8-file, approximately 392-line total. A small residual 2-line variance against this pass's independent recount is noted below as a SUGGESTION, not a WARNING, since it does not change the budget conclusion.

**SUGGESTION**:
1. Reconcile the approximately 2-line variance between apply-progress's diff-count claim (+345/-47, 392 total) and this pass's independent recount (+347/-47, 394 total) before archive, for exactness; does not change the sub-400-line budget conclusion either way.
2. The inline warn Tailwind classes on the broker Connecting/Disconnecting paragraph (connect.component.html:65) still duplicate the STATUS_WARN_CLASSES string literal already defined in connect.component.ts, rather than reusing a bound class, unchanged minor DRY note from prior report, no functional impact.
3. Reconcile the task-count reporting mismatch: Engram sdd/connection-status/tasks (id 98) describes "26/26 tasks" (25 original + 1 follow-up), while the canonical openspec/changes/connection-status/tasks.md has 22 numbered checkboxes (task 5.3 was rewritten in place, not appended as a 23rd item). Both agree on 100% completion; only the total-count framing differs across the two artifacts.
4. For CRITICAL findings #1 and #2 above, add DOM/unit-test assertions using the existing Vitest/TestBed harness already wired into connect.component.spec.ts (no new tooling needed). For CRITICAL finding #3, either accept an explicit, documented scope exception (no theme-rendering harness exists in this repo, per design.md's stated testing-strategy constraint) or add browser/CSS-computation tooling before archive.

### Verdict
FAIL

The prior blocking finding (hub-start ownership) is now genuinely resolved with independently-verified runtime proof - real progress, not just claimed. However 3 pre-existing spec scenarios remain UNTESTED, and this protocol's hard rule requires treating any untested scenario as CRITICAL regardless of perceived risk or test-tooling constraints. The prior report (id 100) had classified these as WARNING; this re-verification pass corrects that classification to comply with the stated hard rule ("a spec scenario is compliant only when a covering test passed at runtime") and this project's verify-report admission validator, which denied a passing verdict as long as requirements/scenarios completion is below total. 22/22 tasks complete, 63/63 tests independently re-run and passing at exit 0, build independently re-run and passing at exit 0 - the implementation itself is very likely correct (strong source-inspection evidence for all 3 remaining gaps), but 3 of 17 spec scenarios lack the runtime proof this protocol requires before archive. Recommended next step: one more remediation batch adding 2 feasible DOM assertions (CRITICAL #1, #2) plus an explicit accepted-exception decision for CRITICAL #3 (theme-rendering, no harness in this repo) - or an explicit user-approved scope exception for all 3 if the team decides copy-semantics/CSS-class/theme-token assertions are out of scope for this change.
