# Tasks: Frontend Design System Foundation

**TDD note**: No RED-GREEN-REFACTOR gate applies — every file is CSS (`@theme`/`.dark`/`@media`) or template markup only, no new TS logic. `sdd-apply` must not force test-first ceremony. Existing Vitest specs MUST still pass unmodified as the regression net.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–260 (6 files) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Token + markup rewrite (all 6 files) | PR 1 (single) | `npm --prefix frontend run test -- --run` | `npm --prefix frontend run build` + manual check ~1024px/~375px, `.dark` toggle in devtools | `git checkout -- frontend/src/styles.css frontend/src/index.html frontend/src/app/app.html frontend/src/app/features/{connect,send,messages}` (atomic revert) |

## Phase 1: Token Foundation (`frontend/src/styles.css`)

- [x] 1.1 Rewrite `@theme`: light OKLCH tokens `--color-background/foreground/card/card-foreground/border/primary/primary-foreground/ring`, `--color-status-ok(-bg)/error(-bg)`, `--radius-*`; drop old `--color-brand-*`/`--color-status-*` scalars (req: Design Tokens Define Color/Typography/Spacing).
- [x] 1.2 Add `@custom-variant dark (&:where(.dark, .dark *));`.
- [x] 1.3 Add `.dark { ... }` overriding every 1.1 token, none undefined (req: Dark Mode Is the Default Theme).
- [x] 1.4 Add motion tokens `--duration-fast/base/slow`, `--ease-standard`, reserved `--animate-message-enter` + `@keyframes` (req: Motion Tokens; unconsumed for now).
- [x] 1.5 Add `@media (prefers-reduced-motion: reduce)` in `@layer base`, near-zero durations app-wide (req: Motion Tokens — reduced-motion).
- [x] 1.6 Update `body` base rule to `bg-background text-foreground antialiased`.

## Phase 2: Dark-by-Default Wiring (`frontend/src/index.html`)

- [x] 2.1 Add static `class="dark"` to `<html>`, no JS. Depends on Phase 1 (req: Dark Mode Is the Default Theme).

## Phase 3: Responsive Grid Shell (`frontend/src/app/app.html`)

- [x] 3.1 Replace flex wrapper with `grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(260px,320px)_minmax(280px,1fr)_minmax(320px,1fr)] lg:gap-6` (req: Responsive Layout Adapts Across Breakpoints). Depends on Phase 1.
- [x] 3.2 Update `<h1>` from `text-slate-900` to `text-foreground`.

## Phase 4: Feature Template Rewrites (parallel, independent files, depend on Phase 1)

- [x] 4.1 `connect.component.html`: `slate-*`/`brand-*`/`status-*` → `bg-card text-card-foreground border-border` (card), `bg-status-ok-bg text-status-ok`/`bg-status-error-bg text-status-error` (status), `focus:ring-ring` (focus), distinguishable primary/secondary actions (reqs: Card Sections, Status Differentiation, Form Affordance).
- [x] 4.2 `send.component.html`: same rewrite pattern, scoped to send panel.
- [x] 4.3 `messages.component.html`: same card/token rewrite plus per-row spacing/border tokens and scrollable capped-height container (req: Live Message Feed Scroll Cap).

## Phase 5: Verification

- [x] 5.1 Run `npm --prefix frontend run test -- --run`; all existing specs pass unmodified.
- [x] 5.2 Run `npm --prefix frontend run build`; no unresolved `@theme` refs, clean compile.
- [x] 5.3 Manual check: dark-first on load, light via `.dark` removal, grid collapse/expand at ~1024px, usable at ~375–428px, visible focus rings, distinct ok/error colors. Automated agent verified dark-first render, card panels, focus ring, and ok/error status colors live in-browser (desktop width); responsive collapse verified by source inspection (`grid-cols-1` base → `lg:` 3-track override) since the sandboxed browser window couldn't resize below ~2560px. **User confirmed the ~1024px/~375px collapse directly in their own browser: looks correct.**
- [x] 5.4 Confirm no `*.component.ts`, `bus-hub.service.ts`, or backend file touched.

## Phase 6: Cleanup

- [x] 6.1 Grep `frontend/src/app` for leftover `slate-*`/`brand-*`/hardcoded hex classes; replace stragglers with tokens.
