# Proposal: Console Redesign (Graphite)

## Intent

BusTester's UI has accumulated friction: the connection form permanently occupies prime column space, recent sends grow unbounded, the live feed is hard to scan in long sessions, and replying hijacks the send panel. This change folds those queued patches into one coherent frontend rework, validated by prototype artifact `0521d07b-9ac3-4ea1-a1b9-a519ff8c30e0` (`scratchpad/canvas/Main.dc.html`).

## Scope

### In Scope

- **Graphite tokens**: ground `#161616`, panel `#1f1f1f`, panel2 `#282828`, line `#363636`, ink `#ededed`, muted `#9a9a9a`; Bricolage Grotesque / Public Sans / JetBrains Mono; 12px radii, generous spacing, soft shadows; single fixed dark theme.
- **Broker-driven accent**: RabbitMQ amber `#e0a34a`, Kafka blue `#3d8ef0`.
- **Connect popup** on load, then a hidden-but-clickable status pill (reopening while connected offers disconnect / switch broker, not re-login).
- **Recent sends**: cap 5, add "Vaciar", rework layout.
- **Live messages**: new card style, better legibility, per-queue tinted pill + 6px dot.
- **Reply drawer** on the right, anchored to the message, original pinned at top.
- **Reserved, unwired broker-selector space** in the header/connection area.

### Out of Scope

Backend changes; Kafka wiring; theme switcher and light tokens; new messaging features beyond relocating reply; left-side queue color rail.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ui-presentation`: Graphite tokens, dark-only (light tokens removed), card/feed restyle, queue color coding, recent-sends cap 5 + clear, broker accent.
- `connection-status`: on-load popup plus clickable status pill, reserved broker-selector slot.
- `request-reply`: Responder opens a right-side drawer instead of pre-filling the send panel.

## Approach

Token-first and staged. Slice 1 rewrites the `@theme` layer and app shell so later slices consume tokens only; slices 2-5 restyle one panel each (connect, send, messages, reply drawer), independently mergeable and revertible. spartan-ng primitives and the container/presentational split stay.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/styles.css` | Modified | Graphite `@theme` tokens, fonts, radii |
| `frontend/src/index.html` | Modified | Font loading; fixed `.dark` |
| `frontend/src/app/app.{html,ts}` | Modified | Shell, popup/drawer hosts, accent binding |
| `frontend/src/app/features/connect/` | Modified | Popup + status pill |
| `frontend/src/app/features/send/` | Modified | Recent-sends cap/clear; reply UI removed |
| `frontend/src/app/features/messages/` | Modified | Card style, queue pill+dot, drawer trigger |
| `frontend/src/app/core/reply-draft.service.ts` | Modified | Feeds drawer, not send panel |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token rewrite breaks component styles | High | Land and review slice 1 alone |
| Specs assert current DOM, mass churn | High | Strict TDD per slice; keep behavior assertions |
| Reply relocation regresses request-reply | Medium | Preserve `reply-draft.service` contract |
| 800-line review budget exceeded | High | Chained PRs, one slice each |

## Rollback Plan

One PR per slice on a feature-branch chain; reverting a single merge commit restores that panel. Reverting slice 1 restores `styles.css` and `index.html`. No API or persisted-format change to migrate.

## Dependencies

- Prototype artifact as visual source of truth; web fonts for the three families.

## Success Criteria

- [ ] Every color, font, radius, and spacing value traces to a Graphite token.
- [ ] Connect popup shows on load, then collapses to a clickable status pill.
- [ ] Accent follows the connected broker.
- [ ] Recent sends never exceed 5 and can be cleared.
- [ ] Queues are identified by tinted pill + 6px dot, no left rail.
- [ ] Reply opens the right drawer with the original pinned; send panel hosts no reply UI.
- [ ] Broker-selector space is reserved and unwired.
- [ ] `npm test -- --watch false` passes on every slice.
