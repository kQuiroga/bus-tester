# Proposal: Frontend Design System Foundation

## Intent

BusTester's UI must let a developer glance at it and immediately trust what they see is live and current. The current UI (post `frontend-tailwind-restyle`) is visually coherent but has no token system, no dark mode, no responsive behavior, and no motion convention — a weak foundation for the 4 planned UX improvements (connection-status indicator, message-feed enhancements, send-panel improvements, multi-subscription chips). The user explicitly asked to lock the design/layout foundation down first, as its own change, so those 4 areas can later ship as smaller, more independent, parallelizable SDD changes.

## Scope

### In Scope
- Design tokens via Tailwind v4 `@theme`: color palette (light + dark), typography scale, spacing scale.
- Dark mode: `.dark` class + token overrides, **dark-first default** on load. No toggle UI (deferred).
- Responsive 3-column (Connect | Send | Messages) layout, laptop-first (~1024px and below stacks), degrading gracefully to phone widths (~375–428px).
- Motion/animation convention tokens (durations, easing, "new item" entry pattern), respecting `prefers-reduced-motion`. Convention only — no message-feed-specific animation implementation.
- Restructure existing Connect/Send/Messages components to consume the new tokens/layout; update Angular + Vitest tests accordingly.

### Out of Scope
- Live connection-status indicator/reconnection banner.
- Message-feed behavior: entry animations, badges, filtering, pause, JSON pretty-print.
- Send-panel behavior: inline validation, history/templates.
- Multi-subscription chips/counters.
- Command palette, backend changes, theme toggle UI.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `ui-presentation`: superseded/rewritten. New requirement text for dark-mode tokens, responsive column layout, and motion conventions; existing behavioral intent (card panels, ok/error status colors, focus rings, scroll-capped feed) is preserved but re-expressed against the new token system rather than force-keeping old wording.

## Approach

Extend the existing Tailwind v4 `@theme` setup in `frontend/src/styles.css`: add semantic OKLCH color tokens with light/dark pairs, a `@custom-variant dark`, typography/spacing scale tokens, and motion tokens (`--animate-*`, durations/easing) guarded by `prefers-reduced-motion`. Introduce a responsive grid/container pattern (CSS grid or Tailwind `grid-cols-*` + breakpoints) replacing the current fixed 3-panel markup, collapsing to stacked columns at `lg`/`md` and below. If a breakpoint/layout helper needs component logic (not pure CSS), build it TDD (RED-GREEN-REFACTOR) per Strict TDD Mode. Apply new tokens/layout to `app.html` and the three feature templates without touching component TS logic, SignalR wiring, or test-facing selectors beyond what's needed for layout classes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/styles.css` | Modified | New `@theme` tokens: color (light/dark), typography, spacing, motion; `@custom-variant dark` |
| `frontend/src/app/app.html` | Modified | Responsive grid/layout shell |
| `frontend/src/app/app.ts` | Modified (maybe) | Only if a breakpoint helper/service is introduced |
| `frontend/src/app/features/{connect,send,messages}/*.html` | Modified | New tokens applied, layout adjustments |
| `frontend/src/app/features/**/*.spec.ts` | Modified | Updated for any new markup/selectors |
| `openspec/specs/ui-presentation/spec.md` | Modified | Rewritten requirements (spec phase) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rewriting `ui-presentation` spec loses a currently-tested behavior | Med | Spec phase must map every old requirement to a new one before removal; verify against existing Vitest specs |
| Dark-first default surprises users expecting light | Low | Explicit product decision (locked); toggle UI is next-change scope |
| Responsive restructuring breaks existing component test selectors | Med | Run full Angular/Vitest suite after each component restructure |
| Motion tokens unused until later changes consume them | Low | Acceptable — this change intentionally only establishes convention |
| Follow-up changes (status indicator, feed, send-panel, subscriptions) overlap with this foundation's files if started before it lands | Med | Land this change first; scope follow-ups as separate SDD changes per user's explicit sequencing request |

## Rollback Plan

Fully revertible, no backend/SignalR impact: `git checkout -- frontend/src/styles.css frontend/src/app/app.html frontend/src/app/app.ts frontend/src/app/features/connect frontend/src/app/features/send frontend/src/app/features/messages`. No new dependencies expected (reuses existing Tailwind v4 setup); if any are added, `npm uninstall` them in `frontend/`.

## Dependencies

- Builds on existing Tailwind v4 setup (`frontend-tailwind-restyle`, archived). No new external dependencies anticipated.

## Success Criteria

- [ ] `npm run build` and `npm test -- --watch false` pass in `frontend/`
- [ ] Dark mode is the default rendered state; light-mode tokens exist and are switchable via `.dark` class removal (manually verifiable, no toggle UI required)
- [ ] 3-column layout stacks correctly at laptop width (~1024px) and remains usable at phone width (~375px)
- [ ] No SignalR/live-delivery behavior regressed (`bus-hub.service.spec.ts` and feature specs unchanged in intent, still passing)
- [ ] `ui-presentation` spec rewritten and reconciled with implementation
