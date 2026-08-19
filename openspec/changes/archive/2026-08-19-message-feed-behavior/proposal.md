# Proposal: Live Message Feed Behavior (Highlight, Filter, Pause/Resume, JSON Pretty-Print)

## Intent

`MessagesComponent` currently renders received messages as flat, unformatted rows with no way to pause a fast-moving feed, search past messages, spot a newly-arrived one, or read structured JSON payloads. For a developer debugging a live queue, this makes the feed hard to use once traffic picks up: raw JSON payloads are unreadable single-line strings, new arrivals are indistinguishable from old rows, and there is no way to freeze the view to inspect one message without losing sight of a term while new ones scroll it away. This change adds four presentation-layer behaviors — new-message highlight, filter/search, pause/resume, JSON pretty-print — to make the feed usable for real debugging sessions.

## Scope

### In Scope
- Pause/resume: freeze the displayed feed client-side; `BusHubService` keeps accumulating messages unchanged.
- New-message highlight animation using explicit new-arrival tracking (monotonic id/seq on `ReceivedMessage`).
- Filter/search over displayed messages (routingKey/exchange/payload, case-insensitive substring).
- JSON pretty-print of message payloads via a pure Angular pipe, rendered safely (no `innerHTML`).

### Out of Scope
- Unsubscribing the SignalR group on pause (unverified backend data-loss risk — deferred).
- "N new messages" reveal-on-demand affordance (deferred; ships as instant catch-up on resume instead).
- Syntax-highlighted/colorized JSON (would require an `[innerHTML]` sanitization surface).
- Any change to `connect`/`send` features or `ApiClientService`.
- Backend/API changes — this is frontend-only (frontend doesn't participate in the Hexagonal backend).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `message-consumption`: adds pause/resume of the *displayed* feed and filter/search over displayed messages — a UI-visible qualification of "Live delivery" (delivery to the client is unaffected; only what's shown changes).
- `ui-presentation`: adds new-message highlight animation (reusing existing `--animate-message-enter` token), JSON pretty-print rendering, and search/pause control affordances to the feed row requirement.

## Approach

`BusHubService` gains a monotonic `seq` field on `ReceivedMessage`, assigned at receipt, so highlight/new-arrival detection is decoupled from DOM-insertion mechanics (needed because filter and pause/resume can also insert rows into the DOM without a message being genuinely new). `MessagesComponent` composes three signals over the live feed: a paused/live "displayed" list (`linkedSignal`, jumps to latest on resume), a `searchTerm`-filtered view on top of it, and last-seen-`seq` tracking to flag genuinely new rows for the highlight class. JSON pretty-print is a pure `JsonPrettyPipe` (`JSON.parse` → `JSON.stringify(_, null, 2)`, falls back to the raw string), rendered via interpolation in a `<pre>` — auto-escaped, no sanitizer needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/core/bus-hub.service.ts` (+ `.spec.ts`) | Modified | Add monotonic `seq` to `ReceivedMessage` at receipt |
| `frontend/src/app/features/messages/messages.component.ts` (+ `.spec.ts`) | Modified | Pause/resume, search, new-arrival tracking signals |
| `frontend/src/app/features/messages/messages.component.html` | Modified | Search input, pause/resume control, highlight class, JSON `<pre>` |
| JSON pretty-print pipe (location TBD — see question round) | New | `JsonPrettyPipe`, pure, safe fallback on parse failure |
| `frontend/src/styles.css` | Additive only | Reuse `--animate-message-enter`; new token only if proven insufficient |
| `openspec/specs/message-consumption/spec.md` | Modified | Delta: pause/resume + filter/search UI semantics |
| `openspec/specs/ui-presentation/spec.md` | Modified | Delta: highlight animation, JSON rendering, control affordances |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Batch-resume animation flood after a long pause | Medium | Explicit decision needed (cap/suppress) — see question round |
| Test fixture churn from `seq` field addition | Low | Mechanical; TDD RED-GREEN-REFACTOR covers both spec files |
| Search scope ambiguity (raw vs. pretty-printed payload) | Low | Default: match raw string; confirm in question round |
| Connect/Send boundary drift | Low | Confirmed no existing coupling; keep new state component/service-local |

## Rollback Plan

Frontend-only, no persisted data or migrations involved. Revert is a straight `git revert` of this change's commit(s), or `git checkout -- frontend/src/app/core/bus-hub.service.ts frontend/src/app/core/bus-hub.service.spec.ts frontend/src/app/features/messages/ frontend/src/styles.css` plus deleting the new pipe file, restoring `openspec/specs/message-consumption/spec.md` and `openspec/specs/ui-presentation/spec.md` to their pre-change state. No dependency or build-config changes are introduced, so no `npm uninstall` step is needed.

## Dependencies

None (no new packages; `linkedSignal` is already available in Angular 20.3).

## Success Criteria

- [ ] Pausing freezes the visible list; new messages keep accumulating in `BusHubService` and appear on resume
- [ ] A genuinely new message is highlighted; a message revealed by filter or resume is not
- [ ] Search filters the displayed list by routingKey/exchange/payload, case-insensitive
- [ ] Valid JSON payloads render pretty-printed; invalid JSON renders unchanged, no runtime error
- [ ] `npm test -- --watch false` and `npm run build` stay green

## Proposal question round

These affect scope/behavior enough to need your confirmation before spec/design lock in. Current assumptions (from exploration) are shown — answer, skip, correct the framing, or ask for a second round.

1. **Batch-resume animation flood**: many messages can arrive during a pause. Assumption: suppress the entrance animation entirely for resume-triggered batches (only live-arrival-while-unpaused messages animate), to avoid a distracting flood. Alternative: cap animation to the last N rows, or don't suppress at all. Which do you want?
2. **Search scope**: assumption is search matches the raw payload string (not the pretty-printed JSON). Should search also match against pretty-printed JSON content, or is raw-string matching sufficient for v1?
3. **JSON pretty-print pipe placement**: no `shared/` folder exists yet in this codebase. Assumption: co-locate `JsonPrettyPipe` under `features/messages/` (single consumer today) rather than create a new `shared/` layer preemptively. Agree, or do you want `shared/` established now?
4. **Resume behavior**: assumption is "instant catch-up" (b1) — resume jumps straight to the live list. The "N new messages, click to reveal" affordance (b2) is deferred to a future change. Confirm b1 is the right v1 scope?
5. **Highlight duration**: how long should the highlight state persist on a new row (e.g., a fixed duration matching the animation, or until the row scrolls out)? Assumption: only for the duration of the CSS entrance animation itself, no separate timer/highlight-hold state.
