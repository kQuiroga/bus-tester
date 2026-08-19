# Proposal: Send Panel UX Improvements

## Intent

`SendComponent` submits blank/invalid `exchange`, `routingKey`, `payload` with no client-side feedback — errors surface only via the backend. There's also no way to recall or reuse a prior message; every send starts blank, costly during iterative bus testing. Add inline validation and localStorage-backed history/templates so testers get immediate feedback and can replay/reuse messages.

## Scope

### In Scope
- Inline validation: `exchange` and `payload` required/non-blank; `routingKey` optional but non-blank-if-present. Per-field errors, submit gated on validity.
- "Recent sends": capped, newest-first, recall-into-form.
- "Saved templates": named, save-current / load / delete.
- Both lists in `localStorage`, feature-scoped, corrupted/malformed JSON fails to empty state (never throws).
- New `send.component.spec.ts` cases: validation blocking, valid submit, history population, template save/recall.

### Out of Scope
- `connect/*`, `messages/*` (sibling changes; read only for convention consistency).
- Reactive Forms migration — no repo-wide precedent.
- Any backend/API change — no server-side history/template/draft support.
- Cross-device sync, multi-user sharing, deleting individual history entries (only capped auto-eviction).

## Capabilities

### New Capabilities
- `send-panel-validation`: inline pre-submit validation of exchange/routing-key/payload.
- `send-history-templates`: localStorage recall of recent sends + named templates.

### Modified Capabilities
None — the underlying `message-sending` publish contract (`send()` → `POST /api/messages`) is unchanged; this adds pre-submit gating and post-submit history capture around it.

## Approach

- **Validation**: hand-rolled `computed()` error signals per field + a `touched` set, matching the existing template-driven `FormsModule` + `signal()` idiom used by `connect`/`messages`/`send` (zero `ReactiveFormsModule`/`Validators` usage repo-wide). `send()` short-circuits on any error.
- **Routing key = optional-but-validated-if-present**: RabbitMQ fanout exchanges legitimately ignore routing keys, so requiring one would block valid use; when non-blank it gets the same whitespace-only rejection as other fields.
- **History/templates**: new colocated `send-history.service.ts` owns two `localStorage` keys — `send-panel.recent-sends` (capped array, FIFO-evicted, `{exchange, routingKey, payload, sentAt}`) and `send-panel.templates` (named array, `{name, exchange, routingKey, payload}`). `JSON.parse` wrapped in try/catch; any failure resets to `[]`, never throws.
- **Precedent distinction**: `bus-hub.service.spec.ts` proves the *incoming* live broker feed is intentionally non-persistent ("feed resets on restart") — a decision about a live, connection-scoped inbound stream. Send history/templates are a small, user-authored *outgoing* reference list the user explicitly wants across sessions — different data, different lifecycle, not a contradiction.
- Reuses existing `status-error`/`status-ok` tokens from `styles.css`; no style changes expected.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `send.component.ts` | Modified | Validation signals, history/template state, submit gating |
| `send.component.html` | Modified | Inline field errors, history/template UI |
| `send.component.spec.ts` | Modified | New TDD cases (validation + persistence) |
| `send-history.service.ts` | New | localStorage read/write, corrupted-JSON fallback |
| `styles.css` | Unlikely | Only additive if existing tokens are insufficient |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Validation pattern diverges from connect/messages | Low | Accepted; those are out of scope |
| History misread as contradicting `BusHubService` non-persistence | Med | Rationale documented here + in code comments |
| Corrupted localStorage breaks panel | Low | Try/catch, cap size, empty-state fallback, unit-tested |
| Diff exceeds review budget | Low | Est. ~150-250 lines, under 400; `sdd-tasks` still forecasts |

## Rollback Plan

Changes are additive, confined to `frontend/src/app/features/send/*` plus one new colocated service — no backend/routing/shared-module changes. Rollback = `git revert` the feature commit(s); `SendComponent` reverts to its current unvalidated, non-persistent form. No data migration needed; `localStorage` keys are namespaced `send-panel.*` and read only by the reverted service, so nothing else is affected.

## Dependencies

None — no backend changes, no new npm packages.

## Success Criteria

- [ ] Blank `exchange`/`payload` shows inline error, blocks submit.
- [ ] Blank `routingKey` submits fine; whitespace-only `routingKey` is rejected.
- [ ] Successful sends appear atop "recent sends" and are recallable.
- [ ] Current form can be saved as a named template and reloaded.
- [ ] Corrupted `localStorage` never throws; panel renders empty state.
- [ ] All behavior covered by Vitest cases.
