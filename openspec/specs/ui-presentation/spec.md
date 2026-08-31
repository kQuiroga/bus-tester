# Specification: UI Presentation

> Presents the visual identity, layout, theme, and interaction affordances of BusTester's UI across light and dark themes, responsive breakpoints, and motion preferences.

## Requirements

### Requirement: Global Stylesheet Reaches All Feature Templates

The system MUST apply all visual styling through a single global stylesheet (`frontend/src/styles.css`) that reaches the `ConnectComponent`, `SendComponent`, and `MessagesComponent` templates. The system MUST NOT rely on component-scoped stylesheets (Angular `styleUrl`/`styleUrls`) for visual rules, since Emulated encapsulation prevents such rules from reaching child component templates.

#### Scenario: Styles reach feature templates

- GIVEN the Angular app is built and served
- WHEN a developer views the Connect, Send, or Messages panel
- THEN Tailwind-derived visual styling (colors, spacing, borders) is visibly applied to that panel's elements

#### Scenario: No component-scoped CSS remains

- GIVEN the codebase after the restyle
- WHEN inspecting `frontend/src/app/` for `.css` files and `styleUrl` references
- THEN no component declares a component-scoped stylesheet
- AND all styling is sourced from `frontend/src/styles.css`

### Requirement: Design Tokens Define Color, Typography, and Spacing

The system MUST define color, typography, and spacing as Tailwind v4 `@theme` tokens in `frontend/src/styles.css`. Templates MUST consume these via utility classes, not hardcoded values.

#### Scenario: Visual properties trace to theme tokens

- GIVEN the app is rendered
- WHEN inspecting a panel's color, text, or spacing
- THEN each value traces to a `--color-*`, `--font-*`/`--text-*`, or `--spacing-*` token

### Requirement: Dark Mode Is the Default Theme

The system MUST render a single fixed dark "Graphite" theme, applied on load via a `.dark` class on the root. The system MUST NOT provide a theme toggle, MUST NOT read or store a theme preference, and MUST NOT define light-theme tokens.
(Previously: dark by default, but light tokens had to exist and be switchable.)

#### Scenario: App loads dark by default

- GIVEN no stored theme preference
- WHEN the page loads
- THEN the root carries `.dark` and Graphite dark tokens render

#### Scenario: No light tokens or theme switch exist

- GIVEN the stylesheet and rendered UI
- WHEN inspected for a light-theme token block or a theme-switch control
- THEN neither is present, and every token resolves under the dark theme

### Requirement: Responsive Layout Adapts Across Breakpoints

The 3-column (Connect/Send/Messages) layout MUST render as columns at ~1024px+ and MUST stack below that, staying usable down to ~375px.

#### Scenario: Columns render at laptop width

- GIVEN the viewport is ~1024px or wider
- WHEN the app renders
- THEN the three panels render side by side

#### Scenario: Layout stacks at narrow widths

- GIVEN the viewport is narrower than ~1024px, down to ~375px
- WHEN the app renders
- THEN the panels stack vertically with no overflow or clipped controls

### Requirement: Motion Tokens Respect Reduced-Motion Preference

The system MUST define motion duration/easing tokens (`--animate-*`) as `@theme` values (convention only). Motion driven by these tokens MUST be reduced under `prefers-reduced-motion: reduce`.

#### Scenario: Motion tokens exist

- GIVEN the stylesheet
- WHEN inspecting `@theme`
- THEN duration and easing tokens are defined

#### Scenario: Reduced motion is respected

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN an element consuming a motion token renders
- THEN that motion is removed or near-instant

### Requirement: Panels Render as Distinct Card Sections

The connect, send, and subscribe panels MUST render as distinct card-style sections using `--color-card`/`--color-border` tokens, separated from each other and the page background.
(Previously: hardcoded, no dark-mode tokens)

#### Scenario: Panels are visually separated

- GIVEN the app is rendered
- WHEN a developer views the page
- THEN each panel shows a token-sourced card boundary

### Requirement: Status Messages Are Visually Differentiated

Connection, send, and subscribe status messages MUST be differentiated across a 3-state model — success ("ok"), failure ("error"), and pending/reconnecting ("warn") — using distinct semantic color tokens. The "warn" state MUST use the new `--color-status-warn`/`--color-status-warn-bg` tokens (light and dark), following the existing ok/error token pattern.
(Previously: 2-state ok/error model only, no pending/reconnecting token)

#### Scenario: Success status is visually distinct

- GIVEN an operation succeeds
- WHEN the status message renders
- THEN it uses the "ok" token, distinguishable from "error" and "warn"

#### Scenario: Error status is visually distinct

- GIVEN an operation fails
- WHEN the status message renders
- THEN it uses the "error" token, distinguishable from "ok" and "warn"

#### Scenario: Pending/reconnecting status uses the warn token

- GIVEN a broker connect/disconnect is pending, or the hub is reconnecting
- WHEN the status message renders
- THEN it uses the `--color-status-warn`/`--color-status-warn-bg` token pair, distinguishable from "ok" and "error"

#### Scenario: Warn tokens render in both themes

- GIVEN the app is rendered in light or dark theme
- WHEN a warn-state status message displays
- THEN `--color-status-warn` and `--color-status-warn-bg` resolve to defined, theme-appropriate values in both themes

### Requirement: New-Message Highlight Animation

Genuinely new messages arriving while the feed is live (not paused) MUST render with a highlight using the existing `--animate-message-enter` motion token, lasting only for the duration of that entrance animation, with no separate highlight-hold timer or state. Messages revealed by filtering, or caught up on resume from a pause, MUST NOT receive the highlight.

#### Scenario: Live arrival highlights

- GIVEN the feed is not paused
- WHEN a new message arrives
- THEN it renders with the `--animate-message-enter` highlight
- AND the highlight ends when the animation completes

#### Scenario: Resume-triggered batch suppresses the animation

- GIVEN the feed was paused and multiple messages arrived during the pause
- WHEN a developer resumes the feed
- THEN none of the caught-up messages render the highlight animation

#### Scenario: Filter-revealed message does not highlight

- GIVEN a message was already received and is not new
- WHEN a search term reveals it in the displayed list
- THEN it renders without the highlight animation

#### Scenario: Reduced motion suppresses highlight motion

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN a genuinely new message arrives while the feed is live
- THEN the highlight motion is removed or near-instant, per the existing motion-token requirement

### Requirement: JSON Payload Pretty-Print Rendering

The system MUST render a message payload that parses as valid JSON in an indented, human-readable form. A payload that fails to parse as JSON MUST render unchanged as its raw string, without throwing a runtime error. Rendering MUST NOT use `innerHTML` or any unsanitized HTML binding.

#### Scenario: Valid JSON renders pretty-printed

- GIVEN a message payload is valid JSON
- WHEN the message row renders
- THEN the payload displays indented and multi-line

#### Scenario: Invalid JSON renders unchanged

- GIVEN a message payload is not valid JSON
- WHEN the message row renders
- THEN the raw payload string displays unchanged
- AND no error is thrown

### Requirement: Live Message Feed Renders Rows With a Scroll Cap

The feed MUST render each message as a distinct row using spacing/border tokens, and SHOULD cap height via a scrollable container, in both layouts. The feed MUST provide a search input for filtering displayed messages and a pause/resume control for freezing and unfreezing the displayed list; both MUST remain usable from ~375px up through laptop widths.
(Previously: no search or pause/resume affordance)

#### Scenario: Each message is a distinct row

- GIVEN one or more messages have been received
- WHEN the feed renders
- THEN each occupies its own row with token-sourced spacing

#### Scenario: Feed height is capped in any layout

- GIVEN more messages than fit the feed's visible area
- WHEN the feed renders
- THEN it becomes scrollable instead of growing page height

#### Scenario: Search and pause controls are present and usable

- GIVEN the feed panel renders
- WHEN a developer views it at any supported width
- THEN a search input and a pause/resume control are visible and operable

### Requirement: Subscription Chip Row Renders Active Subscriptions With Live Counters

The Messages panel MUST render each active subscription as a distinct chip showing its `queueName` and a live count of messages received for that subscription only, plus an inline unsubscribe control. The chip row MUST wrap onto additional lines (not scroll horizontally) as chips accumulate, reusing the existing `flex flex-wrap items-center gap-2` pattern from the connect-status area, remaining usable with no clipping down to ~375px viewport width. The system MUST NOT impose a hard cap on the number of concurrent chips.

#### Scenario: Each active subscription renders as its own chip with a live counter

- GIVEN a developer holds two active subscriptions
- WHEN the Messages panel renders
- THEN each subscription appears as a distinct chip labeled with its queueName
- AND each chip's counter reflects only messages received for that subscription

#### Scenario: Chip row wraps at narrow widths

- GIVEN enough active subscriptions to exceed one row's width
- WHEN the viewport is ~375px or wider
- THEN the chip row wraps onto additional lines with no clipping or horizontal scroll

#### Scenario: No hard cap on concurrent chips

- GIVEN many active subscriptions exist
- WHEN the chip row renders
- THEN all chips are rendered, absorbed by wrapping, with no enforced maximum

### Requirement: Form Inputs and Actions Provide Visual Affordance

Form inputs MUST show a visible focus ring from the `--color-ring` token when focused. Primary and secondary actions MUST remain visually distinguished by style.
(Previously: hardcoded, no dark-mode tokens)

#### Scenario: Focused input shows a ring

- GIVEN a form input in the connect or send panel
- WHEN it receives focus
- THEN a visible ring renders using the `--color-ring` token

#### Scenario: Primary and secondary actions differ

- GIVEN a panel with a primary and a secondary action
- WHEN both render
- THEN their styles are distinguishable

### Requirement: Send Panel Validates Exchange and Payload as Required

The `SendComponent` MUST treat both `exchange` and `payload` as required, non-blank fields, rejecting empty or whitespace-only values with an inline error. There is no reply mode and no default-exchange exception in the Send panel: replying to a message is done entirely in the dedicated reply drawer, which owns its own validation and accepts its own exactly-empty Exchange as the AMQP default exchange (design D7/D9). The Exchange field is always an editable input.
(Previously: `exchange` was required **except** in a Send-panel "reply mode" entered via the Responder pre-fill, where an exactly-empty Exchange was accepted and the field rendered read-only. Reply mode and its unsaved-edits confirmation guard are removed; the reply drawer replaces them.)

#### Scenario: Blank or whitespace payload is rejected

- GIVEN `payload` is empty or whitespace-only
- WHEN the field is evaluated
- THEN it is marked invalid with an inline error

#### Scenario: Blank or whitespace exchange is rejected

- GIVEN `exchange` is empty or whitespace-only
- WHEN the field is evaluated
- THEN it is marked invalid with an inline error

#### Scenario: Non-blank exchange and payload are accepted

- GIVEN `exchange` and `payload` both contain non-blank values
- WHEN evaluated
- THEN neither shows an inline error

#### Scenario: The Send panel exposes no reply mode

- GIVEN the Send panel is rendered
- WHEN inspected for a reply-mode Exchange chip, a reply Correlation ID field, or an unsaved-edits confirmation prompt
- THEN none is present, and the Exchange field is always an editable input governed by the unconditional required rule

### Requirement: Send Panel Validates Routing Key as Optional-If-Present

The `SendComponent` MUST treat `routingKey` as optional, but MUST reject a non-empty value that is whitespace-only.

#### Scenario: Empty routing key is accepted

- GIVEN `routingKey` is empty
- WHEN evaluated
- THEN it is marked valid, no inline error

#### Scenario: Whitespace-only routing key is rejected

- GIVEN `routingKey` contains only whitespace
- WHEN evaluated
- THEN it is marked invalid with an inline error

### Requirement: Graphite Palette, Typography, and Radii

Color tokens MUST realize the Graphite palette: ground `#161616`, panel `#1f1f1f`, panel-2 `#282828`, line `#363636`, ink `#ededed`, muted `#9a9a9a`. Typography MUST use Bricolage Grotesque for display, Public Sans for body, and JetBrains Mono for monospace. Corner radii MUST derive from a 12px base token. Cards and the feed MUST render on these surface tokens with soft shadows.

#### Scenario: Graphite palette and fonts are applied

- GIVEN the app is rendered
- WHEN inspecting background, surface, border, and text colors and fonts
- THEN they resolve to the Graphite palette values and the three declared font families

#### Scenario: Radii trace to the 12px base token

- GIVEN a rounded panel, card, or control
- WHEN inspecting its border radius
- THEN the value derives from the 12px radius token, not a hardcoded value

### Requirement: Accent Color Follows the Connected Broker

The system MUST expose an accent color token bound to the connected broker: RabbitMQ amber `#e0a34a`, Kafka blue `#3d8ef0`. Interactive accents (primary actions, focus, active states) MUST consume this token. When no broker is connected, a neutral default accent MUST apply.

#### Scenario: Accent reflects the RabbitMQ broker

- GIVEN the console is connected to a RabbitMQ broker
- WHEN accented elements render
- THEN the accent token resolves to `#e0a34a`

#### Scenario: Accent falls back when disconnected

- GIVEN no broker connection is active
- WHEN accented elements render
- THEN a neutral default accent applies, not a broker color

### Requirement: Queues Are Identified by a Tinted Pill and Dot

Each message row and each subscription chip MUST identify its queue with a tinted pill carrying the queue name plus a 6px color dot, using a color derived deterministically from the queue name. The system MUST NOT render a left-side queue color rail.

#### Scenario: Message row shows a queue pill and dot

- GIVEN a message received on a named queue
- WHEN its feed row renders
- THEN a tinted pill with the queue name and a 6px dot of the same hue are shown

#### Scenario: The same queue keeps the same color

- GIVEN two messages received on the same queue
- WHEN both rows render
- THEN their pill and dot colors match

#### Scenario: No left color rail is rendered

- GIVEN the message feed renders
- WHEN inspected
- THEN no left-edge per-queue color rail is present

### Requirement: Submit Is Gated on Form Validity

The `SendComponent` MUST block submission while any field is invalid and MUST show per-field inline errors identifying what to correct.

#### Scenario: Submit is blocked while invalid

- GIVEN any field is invalid
- WHEN the tester attempts to submit
- THEN the send request is not dispatched and inline errors remain visible

#### Scenario: Submit proceeds when valid

- GIVEN all fields pass validation
- WHEN the tester submits
- THEN the send request is dispatched with no inline errors

### Requirement: Recent Sends Are Recorded, Capped, and Recallable

The system MUST record each successful send into a newest-first "recent sends" list, capped at exactly 5 entries with FIFO eviction of the oldest entry beyond the cap, and MUST let a tester recall an entry back into the form. The panel MUST provide a "Vaciar" control that clears the list, removing every in-memory entry AND deleting the persisted `localStorage` key so the list stays empty after reload. On the first load where the persisted list holds more than 5 entries, the system MUST truncate it to the 5 most recent and rewrite the persisted key, discarding the older entries (no preserve-and-hide).
(Previously: cap was an unspecified fixed maximum; no clear control; no upgrade migration.)

#### Scenario: Successful send is added newest-first and capped at 5

- GIVEN a send completes successfully
- WHEN the recent sends list is inspected
- THEN the new entry appears first, and if the list exceeded 5 the oldest entry was evicted

#### Scenario: Recalling a recent send populates the form

- GIVEN an entry exists in the recent sends list
- WHEN the tester selects it to recall
- THEN `exchange`, `routingKey`, and `payload` are populated with that entry's values

#### Scenario: Vaciar clears the list and its persisted key

- GIVEN the recent sends list has one or more entries
- WHEN the tester activates "Vaciar"
- THEN the list is emptied AND the persisted `localStorage` key is deleted
- AND the list is still empty after a page reload

#### Scenario: Upgrade migration truncates a longer persisted list

- GIVEN a persisted recent-sends list with more than 5 entries from a prior version
- WHEN the send panel initializes for the first time after the upgrade
- THEN only the 5 most recent entries are kept and the persisted key is rewritten with just those 5

### Requirement: Named Templates Can Be Saved, Loaded, and Deleted

The system MUST let a tester save the current form as a named template, load a saved template's values into the form, and delete a saved template.

#### Scenario: Saving current form as a template

- GIVEN the tester provides a name and the form holds values
- WHEN the tester saves the template
- THEN a new named template entry is persisted with those values

#### Scenario: Loading a template populates the form

- GIVEN a saved template exists
- WHEN the tester loads it
- THEN `exchange`, `routingKey`, and `payload` are populated with the template's values

#### Scenario: Deleting a template removes it

- GIVEN a saved template exists
- WHEN the tester deletes it
- THEN it no longer appears in the saved templates list

### Requirement: History and Templates Persist via Feature-Scoped localStorage

Recent sends and saved templates MUST persist in `localStorage` under keys scoped to the send panel feature, distinct from any other feature's data.

#### Scenario: Data persists across reloads

- GIVEN recent sends and/or saved templates exist
- WHEN the page is reloaded
- THEN each list is restored from its own feature-scoped `localStorage` key

### Requirement: Corrupted Persisted Data Fails Gracefully to Empty State

WHEN persisted recent-sends or templates data is missing, malformed, or not valid JSON, the system MUST NOT throw and MUST fall back to an empty list for the affected data.

#### Scenario: Malformed JSON falls back to empty, no throw

- GIVEN the `localStorage` entry for recent sends or templates contains malformed JSON
- WHEN the send panel initializes
- THEN no error is thrown and the affected list renders empty

### Requirement: Message Row Renders a Responder Action Gated on replyTo

Each row of the live message feed (`MessagesComponent`) MUST render a Responder action that is visible and enabled only when that message's `replyTo` is non-null. For a message with a null or absent `replyTo`, the action MUST be hidden or rendered in a disabled state. The control MUST follow the existing row action affordances and remain usable without clipping or overflow from ~375px viewport width up through laptop widths, consistent with the other feed controls.

#### Scenario: Responder action shows for a message with replyTo

- GIVEN a rendered feed row for a message with a non-null `replyTo`
- WHEN the row renders
- THEN the Responder action is visible and enabled

#### Scenario: Responder action is unavailable for a message without replyTo

- GIVEN a rendered feed row for a message with a null or absent `replyTo`
- WHEN the row renders
- THEN the Responder action is hidden or disabled and cannot be activated

#### Scenario: Responder action stays usable at narrow widths

- GIVEN the feed renders at ~375px viewport width
- WHEN a row with a `replyTo` renders
- THEN the Responder action is visible and operable with no clipping or horizontal scroll
