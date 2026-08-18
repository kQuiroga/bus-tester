# Tasks: Frontend Visual Restyle with Tailwind CSS v4

> Retroactive: implementation is already complete, uncommitted, in the working tree. `npm run build` and `npm test -- --watch false` (5 spec files / 18 tests) already pass. Every task below is checked `[x]` with a pointer to where it's satisfied.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~240 authored (config/CSS/templates) + package-lock.json generated diff (est. ~250-400+ lines from `tailwindcss`/`@tailwindcss/postcss`/`lightningcss` platform deps, 91 matching occurrences found) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Note: `git diff --stat` could not be executed directly (no shell tool in this phase); estimate is derived from reading current file contents and grepping `package-lock.json` for Tailwind-related entries (91 occurrences). `package-lock.json` is machine-generated (npm), not hand-authored — excluded from the authored-line risk figure but included below for full snapshot awareness, since it alone could push the combined diff over 400 lines.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Tailwind toolchain + global stylesheet + encapsulation bugfix | PR 1 | `npm run build` (frontend/) | `npm test -- --watch false` (5 files/18 tests) | `git checkout -- frontend/.postcssrc.json frontend/src/styles.css frontend/src/app/app.css frontend/src/app/app.ts frontend/package.json frontend/package-lock.json`; `npm uninstall tailwindcss @tailwindcss/postcss` |
| 2 | Restyle app shell + connect/send/messages templates with Tailwind utilities | PR 2 (base: PR 1) | `npm test -- --watch false` | `npm run build` then manual visual check of Connect/Send/Messages panels | `git checkout -- frontend/src/app/app.html frontend/src/app/features/connect/connect.component.html frontend/src/app/features/send/send.component.html frontend/src/app/features/messages/messages.component.html` |

## Phase 1: Tailwind Install/Config

- [x] 1.1 Add `tailwindcss@^4.3.3` and `@tailwindcss/postcss@^4.3.3` as devDependencies — satisfied in `frontend/package.json` (devDependencies block) and `frontend/package-lock.json`.
- [x] 1.2 Create `frontend/.postcssrc.json` registering `@tailwindcss/postcss` for esbuild auto-discovery — satisfied, file exists with `{"plugins": {"@tailwindcss/postcss": {}}}`.

## Phase 2: Token/Global Stylesheet

- [x] 2.1 Rewrite `frontend/src/styles.css` with `@import "tailwindcss"` — satisfied, line 1.
- [x] 2.2 Define brand color scale (`--color-brand-50/500/600/700`) and status tokens (`--color-status-ok(-bg)`/`--color-status-error(-bg)`) in one `@theme` block — satisfied in `styles.css` lines 3-13.
- [x] 2.3 Set base body styling via `@layer base` (`bg-slate-50 text-slate-900 antialiased`) — satisfied, `styles.css` lines 15-19.

## Phase 3: Encapsulation Bugfix

- [x] 3.1 Delete `frontend/src/app/app.css` (root cause: Emulated encapsulation scoped its rules to `App`'s own template, never reaching child `ConnectComponent`/`SendComponent`/`MessagesComponent`) — satisfied, file absent from `frontend/src/app/`.
- [x] 3.2 Remove `styleUrl: './app.css'` from `App`'s `@Component` decorator — satisfied, `frontend/src/app/app.ts` has no `styleUrl` property.
- [x] 3.3 Confirm no component declares a component-scoped stylesheet anywhere under `frontend/src/app/` — satisfied, no remaining `.css`/`styleUrl` under `frontend/src/app/`.

## Phase 4: Template Restyle

- [x] 4.1 Restyle `frontend/src/app/app.html` (layout container, heading) with Tailwind utilities — satisfied, lines 1-6.
- [x] 4.2 Restyle `connect.component.html`: card panel, labeled inputs with focus-ring, primary (Connect) vs secondary (Disconnect) buttons, ok/error status banners — satisfied, `frontend/src/app/features/connect/connect.component.html`.
- [x] 4.3 Restyle `send.component.html`: card panel, labeled inputs/textarea with focus-ring, primary Send button, ok/error status banners — satisfied, `frontend/src/app/features/send/send.component.html`.
- [x] 4.4 Restyle `messages.component.html`: card panel, Subscribe/Unsubscribe buttons, error banner, scroll-capped (`max-h-64 overflow-y-auto`) message feed with per-row borders — satisfied, `frontend/src/app/features/messages/messages.component.html`.
- [x] 4.5 Verify no component TS logic, signals, event bindings, or test-facing selectors changed — satisfied; only `class` attributes and markup were added to templates.

## Phase 5: Verification

- [x] 5.1 Run `npm run build` (frontend/) and confirm bundle stays within budget — satisfied, 284.16 kB raw / ~76 kB transfer, under 500 kB/1 MB budgets.
- [x] 5.2 Run `npm test -- --watch false` and confirm no regression — satisfied, 5 spec files / 18 tests pass, unchanged baseline count.
- [x] 5.3 No new RED/GREEN test cycle required — presentation-only change, no CSS-class assertions exist in specs (documented gap in proposal Risks), functional behavior of `bus-connection`/`message-sending`/`message-consumption` capabilities unchanged.
