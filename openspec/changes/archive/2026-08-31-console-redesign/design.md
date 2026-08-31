# Design: Console Redesign (Graphite)

## Technical Approach

Token-first, five independently mergeable slices on a feature-branch chain. Slice 1 collapses `styles.css` to one dark Graphite `@theme` and adds the accent seam; slices 2–5 consume tokens only. Every visual decision is bound to a stable `data-*` DOM contract so strict TDD has a real RED assertion instead of asserting churn-prone class strings. spartan-ng primitives and the container/presentational split are preserved.

## Architecture Decisions

### D1: Keep `@custom-variant dark` + `class="dark"`, delete only the `.dark` override block

| Option | Tradeoff |
|---|---|
| Drop the variant and the class | 14 `dark:` utilities across 8 vendored `libs/ui/*` helm files silently fall back to Tailwind's `prefers-color-scheme` default and break for light-OS users |
| **Chosen**: keep variant + class; `@theme` holds Graphite values directly; `.dark {}` block deleted | Dark-only ships, vendored helm stays deterministic, no `libs/ui` edits |

Consequence: `frontend/src/styles.tokens.spec.ts` must be rewritten — its `extractBlock(css, '.dark {')` throws once that block is gone. That rewrite is slice 1's RED test.

### D2: Broker accent via `data-broker` on `<html>`, not a class or Angular style binding

`@theme` declares static `--color-broker-rabbitmq: #e0a34a` / `--color-broker-kafka: #3d8ef0`, a neutral fallback `--color-accent-neutral` (a muted grey from the Graphite ramp), and an indirection `--color-accent: var(--broker-accent, var(--color-accent-neutral))`. `styles.css` maps one rule per broker — `[data-broker='rabbitmq'] { --broker-accent: var(--color-broker-rabbitmq) }` and `[data-broker='kafka'] { --broker-accent: var(--color-broker-kafka) }`. While nothing is connected `<html>` carries no `data-broker` attribute, so `--broker-accent` is unset and the accent resolves to the neutral token — never a broker color (decision #167; ui-presentation: "with no broker connected, a neutral default accent MUST apply").

| Option | Tradeoff |
|---|---|
| `[style.--broker-accent]` on `app-root` | CDK overlays (dialog, sheet) render outside `app-root`, so the popup and drawer would lose the accent |
| Fall back to RabbitMQ amber when disconnected | Dishonest — implies a live RabbitMQ connection that does not exist yet; contradicts the ui-presentation spec (decision #167) |
| **Chosen**: `BrokerAccentService` sets `documentElement.dataset['broker']` via `effect()` + `DOCUMENT`, removing the attribute when the broker is `null` | Covers overlays, asserted with one DOM attribute test, no theme switcher, neutral until a real connection |

Opacity modifiers (`bg-accent/20` → `color-mix`) still resolve through the indirection at runtime.

### D3: Connect popup = vendored spartan `dialog`; drawer = vendored `sheet`

`@spartan-ng/brain` 1.3.3 already exports `./dialog` and `./sheet`; the CLI vendors `libs/ui/{dialog,sheet}` plus a `tsconfig.json` path, matching the existing 10 helm libs. Rejected: hand-rolled CDK overlay (re-implements focus trap and a11y already vendored).

Hidden-but-clickable is one `connectDialogOpen` signal: auto-opens on load while `!connected()`; the status pill always renders in the header and reopens the same dialog. Dialog body switches on `connected()` — credentials form when disconnected, `Desconectar` / `Cambiar broker` when connected, never re-login. The reserved broker-selector slot is an `aria-hidden`, non-focusable `[data-testid="broker-selector-slot"]` beside the pill.

### D4: Extend `ReplyTarget` additively; never fork `ReplyDraftService`

`draft` / `request()` / `clear()` / `seq` are unchanged — only the consumer flips from `SendComponent` to `ReplyDrawerComponent`. `ReplyTarget` gains an optional `origin?: { exchange; routingKey; payload; receivedAt }` so the drawer can pin the source message. Optional keeps existing `reply-draft.service.spec.ts` green.

"Anchored to the message" is achieved by pinning `origin` at the drawer top **and** marking the source row `[data-replying="true"]` with an accent ring; a right-side sheet cannot be physically anchored.

### D5: Queue color from FNV-1a mod 6, rendered via `data-queue-color`

The spec left the mapping WHAT-only. Concrete algorithm, pure and dependency-free in `features/messages/queue-color.ts`:

```ts
// FNV-1a 32-bit over UTF-16 code units, folded into six token slots.
export function queueColorIndex(queueName: string): QueueColor {
  let h = 0x811c9dc5;
  for (let i = 0; i < queueName.length; i++) {
    h ^= queueName.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (((h >>> 0) % 6) + 1) as QueueColor;
}
```

| Option | Tradeoff |
|---|---|
| Insertion order / subscription index | Colors jump when a queue is unsubscribed and resubscribed; not stable across sessions |
| `hashCode`-style `h*31+c` | Poor low-bit dispersion mod 6 — short similar queue names collide visibly |
| **Chosen**: FNV-1a 32-bit, `% 6 + 1` | Deterministic, session-stable, no dependency, one pure unit test |

`Math.imul` keeps the multiply in int32 (plain `*` loses precision past 2^53). Rendering uses `[data-queue-color='N']` → `--queue-hue`; the pill tints with `color-mix(in oklab, var(--queue-hue) 18%, transparent)` and the 6px dot is solid. Dynamic class strings are rejected — Tailwind cannot see them at build time. Collisions are accepted: six slots identify queues at a glance, they are not a uniqueness guarantee.

### D6: Recent-sends cap, clear, and migration live in `SendHistoryService`

`RECENT_SENDS_CAP` 20 → 5. Construction-time `loadCapped()` truncates to 5 **and rewrites** the key when the stored array was longer (migration on first load, per decision #152.3). `clearRecentSends()` sets `[]` and calls `removeItem` on `send-panel.recent-sends`. The component only calls the service.

### D7: Delete the unsaved-edits guard entirely (decision #152.1)

Slice 5 removes from `send.component.ts`: `replyMode`, `correlationId`, `lastAppliedDraftSeq`, `applyReplyDraft`, `confirmOverwrite`, the `replyDraft` `effect()`, both reply-exit branches in `onExchangeInput`/`onRoutingKeyInput`, the `reply-exchange-chip` template block, and the now-dead `isDirty` / `currentSnapshot` / `lastAppliedSnapshot` / `snapshotKey` / `EMPTY_SNAPSHOT` / `FormSnapshot`. `exchangeError` loses its reply-mode empty-exchange branch; the drawer validates its own empty exchange (AMQP default).

### D8: Fonts via Google Fonts `<link>` with a full fallback stack

Self-hosting adds binary assets to the review diff. `--font-display/sans/mono` each end in a system fallback so offline dev degrades instead of blocking.

### D9: Amend `ui-presentation` — reply mode leaves the Send panel; the drawer owns its own form

`sdd-spec` deferred this: the existing requirement **"Send Panel Validates Exchange and Payload as Required"** encodes a Send-panel reply mode with a read-only empty Exchange, and the `request-reply` delta strands it.

| Option | Tradeoff |
|---|---|
| Drawer hosts the existing `SendComponent`, reply mode relocates | `SendComponent` is a 350-line container owning templates, headers, expect-reply and history. Embedding it drags all of that into the drawer, keeps the `replyMode` branch alive in `exchangeError`, and makes slices 3 and 5 mutually blocking |
| **Chosen**: amend the requirement to drop reply mode from the Send panel; `ReplyDrawerComponent` owns a minimal reply form (routing key read-only, payload, send) | Send-panel validation returns to one unconditional rule (Exchange always required); drawer validation is independent and small; slices 3 and 5 decouple |

Follow-up for `sdd-tasks`: add a `MODIFIED Requirements` entry for "Send Panel Validates Exchange and Payload as Required" to `specs/ui-presentation/spec.md`, removing the reply-mode scenarios and restoring the unconditional Exchange rule. Accepted cost: the drawer duplicates a small `POST /api/messages` call rather than extracting a shared send service — extraction would inflate slice 5 past budget and is deferred.

### D10: "Cambiar broker" reuses the existing connect flow — no Kafka wiring

The connected-state pill action reopens the same dialog in its credentials form and runs the existing `disconnect()` then `connect()` against `/api/connections`. It is a re-target of the same RabbitMQ flow, not broker selection. The `broker-selector-slot` (D3) stays inert and non-focusable; `BrokerAccentService.broker` stays `null` (neutral accent) because no connection flow sets it yet — slice 2 wires a successful connect to `setBroker('rabbitmq')` and disconnect back to `setBroker(null)` (decision #167). The seam exists so the Kafka track (#143) only has to set that signal to `'kafka'`.

## Data Flow

```
MessagesComponent.respond(msg)
   │  request({ routingKey, correlationId, origin })   [seq++]
   ▼
ReplyDraftService.draft ──► ReplyDrawerComponent (sheet, side=right)
   │                              │ POST /api/messages  (exchange: '')
   │                              ▼  clear() on close
   └──► source row [data-replying="true"]

BrokerAccentService.broker ──► <html data-broker> ──► --broker-accent
                                     └── covers CDK overlay container
```

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/styles.css` | Modify | Graphite `@theme`, fonts, radii, queue tokens, accent indirection; delete `.dark` block |
| `frontend/src/styles.tokens.spec.ts` | Modify | Single-mode token contract; drop the `.dark` extraction |
| `frontend/src/index.html` | Modify | Font `<link>`; keep `class="dark"` |
| `frontend/src/app/core/broker-accent.service.ts` (+ spec) | Create | Broker signal → `<html data-broker>` |
| `frontend/src/app/app.{html,ts}` | Modify | Shell, header, dialog/sheet hosts |
| `frontend/libs/ui/dialog/`, `frontend/libs/ui/sheet/` | Create | spartan CLI vendored output + `tsconfig.json` paths |
| `frontend/src/app/features/connect/*` | Modify | Container + `connect-dialog` / `status-pill` presentational children |
| `frontend/src/app/features/send/send-history.service.ts` (+ spec) | Modify | Cap 5, `clearRecentSends()`, truncate migration |
| `frontend/src/app/features/send/send.component.{ts,html}` (+ spec) | Modify | Recent-sends layout + `Vaciar`; delete reply/dirty-guard code (D7) |
| `frontend/src/app/features/messages/queue-color.ts` (+ spec) | Create | Stable queue→color index |
| `frontend/src/app/features/messages/messages.component.{ts,html}` | Modify | Card restyle, pill + dot, drawer trigger, `data-replying` |
| `frontend/src/app/features/reply/reply-drawer.component.{ts,html}` (+ spec) | Create | Right sheet, pinned original, reply send |
| `frontend/src/app/core/reply-draft.service.ts` (+ spec) | Modify | Additive optional `origin` |
| `openspec/changes/console-redesign/specs/ui-presentation/spec.md` | Modify | D9: amend "Send Panel Validates Exchange and Payload as Required" to drop reply mode |

## Interfaces / Contracts

```ts
export interface ReplyTarget {
  routingKey: string;
  correlationId: string | null;
  /** Source message pinned at the drawer top. Optional: preserves the existing contract. */
  origin?: { exchange: string; routingKey: string; payload: string; receivedAt: string };
}

export type BrokerKind = 'rabbitmq' | 'kafka';
export function queueColorIndex(queueName: string): 1 | 2 | 3 | 4 | 5 | 6;
```

## Slicing and Delivery

Feature Branch Chain off tracker `feat/console-redesign` (draft, no-merge). PR1 → tracker; PR2 → PR1's branch; and so on. Review budget is **800 changed lines** (decision #150), not the 400 default.

| # | Slice | Depends on | Touches | Est. lines |
|---|---|---|---|---|
| 1 | Graphite tokens + shell + accent seam | — | `styles.css`, `styles.tokens.spec.ts`, `index.html`, `app.*`, `broker-accent.service` | ~330 |
| 2 | Connect popup + status pill + reserved slot | 1 | `libs/ui/dialog`, `tsconfig.json`, `features/connect/*` | ~500 |
| 3 | Send panel + recent sends (cap 5, `Vaciar`, migration) | 1 | `send-history.service`, `send.component.*` | ~300 |
| 4 | Messages feed cards + queue pill/dot | 1 | `queue-color.ts`, `messages.component.*` | ~350 |
| 5 | Reply drawer + send-panel reply removal | 3 (file), 4 (behavior) | `libs/ui/sheet`, `features/reply/*`, `reply-draft.service`, `send.component.*`, `specs/ui-presentation` | ~450 |

2, 3 and 4 are logically parallel given 1, but chain linearly so each child diff stays clean. Slice 5's dependency on 3 is file-level only — both edit `send.component.ts` — because D9 decoupled them behaviorally.

## Testing Strategy

Strict TDD is active (`apply.tdd: true`); every slice pays a RED-GREEN cost against `npm test -- --watch false` (Vitest).

| Slice | RED seam | Style-only surface |
|---|---|---|
| 1 | Rewritten `styles.tokens.spec.ts` asserts Graphite values and single-mode resolution; `broker-accent.service.spec` asserts `<html data-broker>` | fonts, radii, spacing |
| 2 | Dialog auto-opens while disconnected; pill click reopens; connected body offers disconnect not re-login; `broker-selector-slot` present and `aria-hidden` | dialog chrome |
| 3 | Cap 5 on record; `clearRecentSends()` empties memory **and** storage; oversized stored array truncated and rewritten on load | list layout |
| 4 | `queueColorIndex` stability across resubscribe; row renders `data-queue-color` | card chrome |
| 5 | Drawer opens on `respond()` with `origin` pinned; source row gets `data-replying`; `close()` calls `clear()`; send panel exposes no reply UI and no `window.confirm`; Exchange is now unconditionally required in the send panel (D9) while the drawer accepts its empty default exchange | drawer chrome |

Style-only surfaces are covered by the existing suite staying green plus the `data-*` contract assertions above. No integration or E2E harness exists in this repo; backend suites are untouched.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The only persistence boundary is `localStorage`, handled by D6's migration.

## Migration / Rollout

Only `send-panel.recent-sends` migrates: truncate to 5 and rewrite on first load, discarding older entries (decision #152.3). Corrupted data still falls back to `[]` via the existing `readArray`. No API or wire-format change. Rollback is one merge-commit revert per slice.

## Open Questions

- [ ] `scratchpad/canvas/Main.dc.html` is not present in the working tree; palette and layout values are taken from the proposal and Engram #145/#148. Re-attach the prototype before slice 2 if pixel fidelity matters.
- [ ] Exact Graphite `oklch()` conversions of the hex values are deferred to slice 1's token spec.
