# Delta for UI Presentation

## MODIFIED Requirements

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

## ADDED Requirements

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
