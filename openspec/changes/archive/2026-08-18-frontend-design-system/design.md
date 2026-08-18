# Design: Frontend Design System Foundation

## Technical Approach

Extend the existing Tailwind v4 `@theme` block in `frontend/src/styles.css` (currently raw `brand-*`/`status-*` scalars) into a semantic, dark-first token set, then re-point the three feature templates and `app.html` at those tokens. Layout collapse and motion are pure CSS (Tailwind utilities + one `@theme`-declared keyframe); no new Angular logic, services, or component inputs are introduced. `bus-hub.service.ts` and every `*.component.ts` file are untouched — this is markup + CSS only.

## Architecture Decisions

### Decision: Dark mode via static `.dark` class on `<html>`, semantic OKLCH pairs

**Choice**: Base `@theme` tokens define the LIGHT palette (semantic names: `--color-background`, `--color-foreground`, `--color-card`, `--color-border`, `--color-primary`, `--color-status-ok(-bg)`, `--color-status-error(-bg)`, `--color-ring`), each as OKLCH. A `.dark { ... }` block overrides the same variable names with dark values. `@custom-variant dark (&:where(.dark, .dark *));` enables `dark:` utilities for future use. `frontend/src/index.html`'s `<html>` tag gets a static `class="dark"` — no JS, no `ngOnInit` toggle logic.
**Alternatives considered**: (a) JS-applied class on bootstrap (`document.documentElement.classList.add('dark')` in `app.ts`) — rejected, causes a flash-of-light-theme before Angular hydrates and adds fake "logic" that Strict TDD would then require testing. (b) `prefers-color-scheme` media query only — rejected, ignores the explicit "dark-first regardless of OS setting" product decision and gives no attachment point for a later manual toggle.
**Rationale**: A static HTML attribute is present before any CSS/JS runs, so there is zero flash. `classList.toggle('dark')` on `<html>` is the exact mechanism a future toggle-UI change needs — nothing here has to be re-architected, only a click handler added.

### Decision: Reuse Tailwind's default spacing/type scale; only add semantic color, radius, and motion tokens

**Choice**: No bespoke `--spacing-*`/`--font-size-*` scale. Typography uses Tailwind's existing `text-sm`/`base`/`lg`/`xl` utilities (already applied); the only new non-color tokens are motion (`--duration-*`, `--ease-*`, `--animate-message-enter`) and a `--radius-*` alias reused across cards/inputs/buttons for consistency.
**Alternatives considered**: Custom spacing/type scale — rejected as speculative for a 3-panel internal tool; would duplicate Tailwind's already-4px-based scale for no semantic gain.
**Rationale**: Minimizes token surface area to what's actually semantically distinct (color meaning, dark/light pairing, motion). Matches "don't invent tokens without purpose" from the tailwind-design-system skill.

### Decision: CSS Grid + viewport breakpoints (not container queries) for the 3-column shell

**Choice**: `app.html`'s `<main>` becomes `grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(260px,320px)_minmax(280px,1fr)_minmax(320px,1fr)] lg:gap-6`. Below `lg` (1024px) it's a single stacked column (mobile-first default); at `lg:` and above it becomes 3 tracks. No `md`-specific behavior — the requirement is binary (stacked vs. 3-col), pivoting at laptop width.
**Alternatives considered**: (a) Flexbox with `flex-wrap` — rejected, grid gives explicit, independently-sized tracks (Connect/Send narrower, Messages flexible) without wrap-order surprises. (b) Container queries (`@container`) — rejected: the shell is the single top-level app layout, not a reusable component embedded at varying widths; its driver is *viewport* width, which is exactly what media breakpoints model. Container queries stay a good fit for internal message-row wrapping in a later feed change, not for this outer shell.
**Rationale**: `lg` (1024px) matches the proposal's laptop-first pivot exactly; base styles already stack, so phone widths (375–428px) degrade for free with no extra breakpoint tier — verified via existing `sm:p-6` for minor spacing-only refinement below `lg`.

### Decision: Motion tokens + a global `prefers-reduced-motion` safety net, no animation applied yet

**Choice**: Add `--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 320ms`, `--ease-standard: cubic-bezier(0.4,0,0.2,1)`, and one reserved `--animate-message-enter: message-enter var(--duration-base) var(--ease-standard);` with its `@keyframes` — declared but referenced by zero elements in this change (Tailwind v4 only emits keyframes when a class references the `--animate-*` var, so this stays dead weight until the message-feed change consumes it). Add a global `@media (prefers-reduced-motion: reduce)` rule in `@layer base` forcing near-zero animation/transition durations app-wide.
**Alternatives considered**: Per-element `motion-reduce:` Tailwind variants only — rejected as the sole mechanism; it requires every future consumer to remember to add it. A global base-layer safety net is the standard belt-and-suspenders a11y pattern and costs nothing now.
**Rationale**: Proposal explicitly scopes this to "convention only." Declaring the token now means the later message-feed change adds one class name, no CSS authoring.

### Decision: Class-only template rewrites; zero TS/selector changes

**Choice**: `connect.component.html`, `send.component.html`, `messages.component.html`, `app.html` get their `slate-*`/`brand-*`/`status-*` literal classes replaced with semantic token classes (`bg-card`, `border-border`, `text-foreground`, `bg-primary text-primary-foreground`, `bg-status-ok-bg text-status-ok`, `focus:ring-ring`). No `*.component.ts`, no `ngModel` bindings, no `@if`/`@for` structure, no element selectors change.
**Alternatives considered**: None — this is dictated by the proposal's explicit "without touching component TS logic... beyond what's needed for layout classes" constraint.
**Rationale**: Confirmed by reading `connect.component.spec.ts` — existing Vitest specs test component TS behavior via `TestBed`/`HttpTestingController`, never query DOM classes or structure. Class/token renames and the grid-shell swap therefore require **no spec.ts changes**; this narrows the proposal's "Modified (maybe)" spec-file risk to "unaffected unless review finds a DOM-dependent assertion."

## Data Flow (dark-mode token resolution + breakpoint switch)

    index.html (<html class="dark"> static)
            │
            ▼
    styles.css: @theme (light values) + .dark{...} (dark overrides)
            │  browser resolves CSS custom properties before paint — no FOUC
            ▼
    Angular bootstraps app.html → grid shell
            │
    viewport < 1024px ──▶ grid-cols-1 (stacked)      ┐  same token set,
    viewport ≥ 1024px ──▶ 3 explicit grid tracks     ┘  purely CSS-driven

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/styles.css` | Modify | Semantic color tokens (light base + `.dark` overrides), `@custom-variant dark`, motion tokens/keyframe, reduced-motion base rule |
| `frontend/src/index.html` | Modify | Add static `class="dark"` to `<html>` |
| `frontend/src/app/app.html` | Modify | Flex-col stack → responsive CSS grid shell |
| `frontend/src/app/features/connect/connect.component.html` | Modify | Token classes only |
| `frontend/src/app/features/send/send.component.html` | Modify | Token classes only |
| `frontend/src/app/features/messages/messages.component.html` | Modify | Token classes only |
| `frontend/src/app/features/**/*.spec.ts` | None expected | See Decision above; revisit only if apply-phase review finds a DOM-class assertion |
| `openspec/specs/ui-presentation/spec.md` | Modify (separate sdd-spec phase) | See Spec Reconciliation below |

## Spec Reconciliation

The current `ui-presentation` spec (5 ADDED requirements: global stylesheet reach, card panels, status color differentiation, scroll-capped feed, focus/action affordance) all describe **behavior this design preserves**, just re-expressed against tokens instead of literal `slate-*`/`brand-*` classes — none are dropped. The in-progress spec rewrite should:
1. Keep all 5 existing requirements' *intent*, loosening literal color-name wording to reference the token system generically.
2. ADD: "Dark Mode Renders by Default" (maps to the `.dark`-on-`<html>` decision), "Responsive Column Layout Collapses Below Laptop Width" (maps to the grid/breakpoint decision), "Motion Tokens Exist and Respect Reduced-Motion" (convention only, no behavior assertion beyond token presence + the reduced-motion base rule).
This design intentionally does not author spec text — that's `sdd-spec`'s output — but every requirement it adds must trace to a decision above.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/Component (Vitest) | Existing component behavior (connect/send/subscribe flows) | No new tests — existing specs are the regression net; must stay green unchanged |
| Build | Tailwind compiles, no unresolved `@theme` refs | `npm run build` in `frontend/` |
| Manual/Visual | Dark-first render, light via `.dark` removal (devtools), grid collapse at ~1024px and ~375–428px, focus rings, status colors | Browser check per proposal Success Criteria — no automated visual-regression tooling exists in this repo, not introduced here |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change is CSS tokens + Angular template markup only.

## Migration / Rollout

No data migration. No new npm dependencies (reuses the existing Tailwind v4 setup from `frontend-tailwind-restyle`). Land as a single PR (well under the 400-line review budget: ~6 small files, mostly class-attribute edits).

**Rollback**: `git checkout -- frontend/src/styles.css frontend/src/index.html frontend/src/app/app.html frontend/src/app/features/connect frontend/src/app/features/send frontend/src/app/features/messages`. Must be reverted **atomically as one set** — reverting `styles.css` alone while templates still reference new token classes (or vice versa) leaves the UI visually broken (unstyled, not functionally broken: Angular renders unknown Tailwind classes as no-ops, it doesn't error). No backend/SignalR file is ever touched, so live-data behavior cannot regress from this rollback.

## TDD Applicability (Strict TDD Mode)

**No RED-GREEN-REFACTOR is required anywhere in this change.** No breakpoint-detection helper/service, no theme-toggle service, and no new component logic/inputs are introduced — layout collapse is native CSS Grid track-switching at the `lg` breakpoint, and dark-mode is a static HTML attribute. Every file changed is either CSS (`@theme`/`.dark`/`@media`) or Angular template markup (class-attribute swaps only). If a later `sdd-tasks`/`sdd-apply` step discovers an actual need for JS-driven breakpoint logic (e.g., conditional markup structure rather than pure CSS reflow), that specific piece — and only that piece — must follow RED-GREEN-REFACTOR; this design deliberately avoids creating that need.

## Open Questions

- [ ] None blocking. `sdd-spec` should confirm the 3 new requirement names above before `sdd-tasks` proceeds.
