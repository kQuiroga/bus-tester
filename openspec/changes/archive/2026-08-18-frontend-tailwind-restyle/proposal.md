# Proposal: Frontend Visual Restyle with Tailwind CSS v4

> **Retroactive proposal.** Implementation is already complete and manually verified in the working tree (uncommitted). This document captures the proposal that should have preceded that work, so SDD phases (spec/design/tasks/apply/verify/archive) have a proper record. `sdd-apply`/`sdd-verify` should validate against what already exists rather than re-implement.

## Intent

The Angular SPA (`frontend/`) had two problems:
1. **Bug**: `frontend/src/app/app.css` was the only stylesheet, but only the root `App` component declared `styleUrl: './app.css'`. Under Angular's default Emulated encapsulation, those rules never reached `ConnectComponent`, `SendComponent`, `MessagesComponent` templates — where `.panel`/`.status--ok`/`.status--error`/`.message-feed` classes actually live. The app was effectively unstyled.
2. **No design system**: no tokens, ad hoc/hardcoded colors and spacing, no coherent visual language for an internal dev tool used to inspect connection/message state.

## Scope

### In Scope
- Fix the encapsulation bug by removing all component-scoped CSS and moving every visual rule into one global stylesheet.
- Adopt Tailwind CSS v4 (utility-first, CSS-first `@theme` tokens) as the styling approach.
- Restyle `app.html` and the three feature templates: card panels, form inputs with focus rings, primary/secondary buttons, ok/error status banners, message feed as distinct rows with a scroll cap.
- Define brand + status color tokens via `@theme`.

### Out of Scope
- Dark mode (deferred, fast-follow).
- Any change to component TS logic, event bindings, `ngModel`, `disabled` state, element structure/order, or test-facing selectors.
- Angular Material / PrimeNG (evaluated and rejected — decided with user).

## Capabilities

### New Capabilities
`ui-presentation` — no new *business* capability, but the spec phase captured the presentational requirements actually implemented (panel styling, status differentiation, message-feed rows, form focus/button states) as a lightweight new capability spec with Given/When/Then scenarios, rather than leaving them as undocumented tribal knowledge. See `openspec/changes/frontend-tailwind-restyle/specs/ui-presentation/spec.md`.

### Modified Capabilities
None — existing capabilities (`bus-connection`, `message-sending`, `message-consumption`) keep identical functional behavior; only visual presentation and the encapsulation bug are affected.

## Approach

Tailwind CSS v4 was chosen over Angular Material/PrimeNG: utility-first, no added JS runtime, fits Angular 20's esbuild `@angular/build:application` builder, keeps this internal dev-tool's bundle light. Installed `tailwindcss@^4.3.3` + `@tailwindcss/postcss@^4.3.3`, added `.postcssrc.json`. Rewrote `styles.css` with `@import "tailwindcss"` + `@theme` (brand scale, status ok/error tokens) + `@layer base`. Deleted `app.css`, removed its `styleUrl` — eliminating all component-scoped CSS closes the encapsulation gap permanently. Applied Tailwind utility classes directly in templates.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/.postcssrc.json` | New | Registers `@tailwindcss/postcss` |
| `frontend/src/styles.css` | Modified | Tailwind import, `@theme` tokens, base layer |
| `frontend/src/app/app.css` | Removed | Component-scoped CSS deleted (bug fix) |
| `frontend/src/app/app.ts` | Modified | `styleUrl` reference removed |
| `frontend/src/app/app.html` | Modified | Tailwind utility classes |
| `frontend/src/app/features/{connect,send,messages}/*.html` | Modified | Tailwind utility classes |
| `frontend/package.json` / `package-lock.json` | Modified | New dev deps |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Visual regression not caught by tests (no spec queries CSS classes) | Low | Manual verification done; build/test suite still green |
| Bundle size growth from Tailwind | Low | Verified: 284.16 kB raw / ~76 kB transfer, under 500 kB/1 MB budgets |
| Future dark-mode work conflicts with token choices | Low | Tokens use `@theme` (v4 CSS-first), extensible without rework |

## Rollback Plan

Low risk, fully revertible: `git checkout -- frontend/.postcssrc.json frontend/src/styles.css frontend/src/app/app.css frontend/src/app/app.ts frontend/src/app/app.html frontend/src/app/features/connect/connect.component.html frontend/src/app/features/send/send.component.html frontend/src/app/features/messages/messages.component.html frontend/package.json frontend/package-lock.json`, then `npm uninstall tailwindcss @tailwindcss/postcss` in `frontend/`.

## Dependencies

- `tailwindcss@^4.3.3`, `@tailwindcss/postcss@^4.3.3` (new dev deps)

## Success Criteria

- [x] `npm run build` succeeds within existing budgets
- [x] `npm test -- --watch false` — 5 spec files / 18 tests pass, unchanged from baseline
- [x] No component-scoped CSS remains; all styling flows through global `styles.css` + Tailwind utilities
- [x] Connect/Send/Messages panels visually styled and legible
