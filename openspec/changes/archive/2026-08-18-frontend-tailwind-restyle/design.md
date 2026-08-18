# Design: Frontend Visual Restyle with Tailwind CSS v4

> **Retroactive design.** Documents the architecture of the already-shipped, manually-verified implementation. `sdd-apply`/`sdd-verify` validate against existing code, not a plan to build.

## Technical Approach

Two changes, both presentation-only: (1) adopt Tailwind CSS v4's CSS-first configuration as the styling toolchain for Angular's esbuild-based `@angular/build:application` builder, and (2) fix a component-CSS-encapsulation bug by deleting all component-scoped CSS in favor of one global stylesheet + inline utility classes. No `ConnectComponent`/`SendComponent`/`MessagesComponent` TS logic, DI, `BusHubService`, or `ApiClientService` changed — confirmed by reading `connect.component.ts` (only `signal`/`inject`/`FormsModule`, no style references) and `app.ts` (no `styleUrl`, only `templateUrl`).

## Architecture Decisions

### Decision: Tailwind v4 CSS-first config, no `tailwind.config.js`

**Choice**: `frontend/.postcssrc.json` registers `{"plugins": {"@tailwindcss/postcss": {}}}`; no `tailwind.config.js`/`.ts` exists.
**Alternatives considered**: Tailwind v3 with a JS/TS config file; Angular Material or PrimeNG component libraries (evaluated and rejected with user per proposal — added JS runtime weight unsuited to an internal dev tool).
**Rationale**: Angular 20's `@angular/build:application` (esbuild) builder auto-discovers PostCSS config at the workspace root without extra `angular.json` wiring. v4 eliminates the JS config file entirely, so there is nothing else to author or keep in sync.

### Decision: Single global `@theme` token block in `styles.css`

**Choice**: One `@theme { }` block in `frontend/src/styles.css` defines `--color-brand-50/500/600/700` and `--color-status-ok(-bg)`/`--color-status-error(-bg)`. `@layer base { body { @apply bg-slate-50 text-slate-900 antialiased; } }` sets base document styling.
**Alternatives considered**: Per-component token files; a separate `tokens.css` imported into `styles.css`.
**Rationale**: One source of truth for brand/status colors avoids drift across the three feature components and keeps the token surface small and auditable for a dev-tool-scale app. Tailwind v4's `@theme` generates the corresponding utility classes (`bg-brand-600`, `text-status-error`, etc.) automatically from these custom properties — no plugin config needed.

### Decision: Eliminate component-scoped CSS instead of adding `styleUrl` per component

**Choice**: Deleted `frontend/src/app/app.css` and removed `styleUrl: './app.css'` from `app.ts`. All visual rules moved to (a) Tailwind utility classes written directly in each component's own template, or (b) global tokens/base rules in `styles.css`.
**Alternatives considered**: Add `styleUrl` to each of `ConnectComponent`, `SendComponent`, `MessagesComponent` pointing at scoped or shared CSS files.
**Rationale — root cause fixed, not patched**: Angular's default Emulated view encapsulation scopes a component's `styleUrl` rules to only the elements *that component's own template* renders. `App`'s template (`app.html`) only renders `<h1>` and the three custom-element tags `<app-connect>`, `<app-send>`, `<app-messages>` — it never renders the `.panel`/`.status--ok`/`.status--error`/`.message-feed` markup living inside each feature component's own template. So `app.css`'s scoped selectors never matched there, and the app was effectively unstyled. Adding per-component `styleUrl`s would work but re-introduces the same encapsulation boundary and N stylesheets to keep in sync. Moving everything to inline utilities + one global sheet removes the boundary entirely.

## Data Flow

### A. Build-time CSS pipeline

```
frontend/src/styles.css (@import "tailwindcss" + @theme tokens)
        │
        ├── frontend/.postcssrc.json → @tailwindcss/postcss plugin
        │        scans component template files (*.html) for
        │        utility class usage (app.html, connect/send/messages .html)
        ▼
@angular/build:application (esbuild) — auto-discovers .postcssrc.json
        ▼
Generated CSS bundle (global, unscoped)
        ▼
Browser — one <style>/<link> applies to the whole document,
          no ViewEncapsulation boundary involved
```

### B. Before/after: encapsulation bug

```
BEFORE (bug)
  app.ts { styleUrl: './app.css' }  ──scopes──▶  App's OWN template only
                                                   (<h1>, <app-connect>, <app-send>, <app-messages> tags)
  app.css rules (.panel, .status--ok, .message-feed)
        │
        X  never reach child component templates
        ▼
  ConnectComponent / SendComponent / MessagesComponent templates
  render .panel / .status--ok / .message-feed markup — UNSTYLED

AFTER (fix)
  app.css DELETED, no styleUrl anywhere
  All rules live in:
    - frontend/src/styles.css   (global, applies to entire document)
    - inline Tailwind utility classes in each component's own .html
        ▼
  Every template (App + Connect + Send + Messages) is styled,
  regardless of ViewEncapsulation boundaries
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/.postcssrc.json` | Created | Registers `@tailwindcss/postcss`; auto-discovered by esbuild builder |
| `frontend/src/styles.css` | Modified | `@import "tailwindcss"`, `@theme` brand/status tokens, `@layer base` |
| `frontend/src/app/app.css` | Deleted | Component-scoped CSS removed — root cause of the encapsulation bug |
| `frontend/src/app/app.ts` | Modified | `styleUrl` reference removed |
| `frontend/src/app/app.html` | Modified | Tailwind utility classes on `<main>`/`<h1>` |
| `frontend/src/app/features/{connect,send,messages}/*.html` | Modified | Panels, form inputs w/ focus rings, primary/secondary buttons, ok/error status banners, scroll-capped message feed — all via Tailwind utilities + `bg-status-*`/`text-status-*`/`bg-brand-*` tokens |
| `frontend/package.json` / `package-lock.json` | Modified | Added `tailwindcss@^4.3.3`, `@tailwindcss/postcss@^4.3.3` devDependencies |

## Interfaces / Contracts

No TS interfaces, API contracts, or component `@Input`/`@Output` signatures changed. Confirmed via `connect.component.ts`: `host`/`port`/`username`/`password`/`connected`/`errorMessage` signals and `connect()`/`disconnect()` methods are unchanged from the pre-restyle version; only `connect.component.html` gained `class="..."` attributes.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Component TS logic (signals, `connect()`/`disconnect()`, `subscribeToQueue()`) unaffected | Existing Vitest specs unchanged — 5 spec files / 18 tests, same baseline count |
| Build | PostCSS/Tailwind pipeline produces a valid bundle within budget | `npm run build` — verified 284.16 kB raw / ~76 kB transfer, under 500 kB/1 MB budgets |
| Visual | Manual verification only (no CSS-class assertions in specs) | Documented as a known gap in the proposal's Risks table; acceptable for an internal dev tool |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change is CSS/template-only.

## Migration / Rollout

No migration required. Retroactive documentation of a already-applied, uncommitted working-tree change. Rollback (if ever needed): `git checkout -- frontend/.postcssrc.json frontend/src/styles.css frontend/src/app/app.css frontend/src/app/app.ts frontend/src/app/app.html frontend/src/app/features/connect/connect.component.html frontend/src/app/features/send/send.component.html frontend/src/app/features/messages/messages.component.html frontend/package.json frontend/package-lock.json`, then `npm uninstall tailwindcss @tailwindcss/postcss` in `frontend/`.

## Open Questions

- [ ] None — implementation is complete, manually verified, and build/test suite is green.
