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

The system MUST render dark by default on load via a `.dark` class with token overrides (no toggle UI yet). Light tokens MUST also exist.

#### Scenario: App loads dark by default

- GIVEN no stored theme preference
- WHEN the page loads
- THEN the root carries `.dark` and dark tokens render

#### Scenario: Light tokens exist and are switchable

- GIVEN `.dark` is removed from the root
- WHEN the page re-renders
- THEN light tokens apply, with none undefined

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

Connection, send, and subscribe status messages MUST be differentiated between success ("ok") and failure ("error") using distinct semantic color tokens.
(Previously: hardcoded, no dark-mode tokens)

#### Scenario: Success status is visually distinct

- GIVEN an operation succeeds
- WHEN the status message renders
- THEN it uses the "ok" token, distinguishable from "error"

#### Scenario: Error status is visually distinct

- GIVEN an operation fails
- WHEN the status message renders
- THEN it uses the "error" token, distinguishable from "ok"

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

The `SendComponent` MUST treat `exchange` and `payload` as required, non-blank fields, rejecting empty or whitespace-only values.

#### Scenario: Blank exchange or payload is rejected

- GIVEN `exchange` or `payload` is empty or whitespace-only
- WHEN the field is evaluated
- THEN it is marked invalid with an inline error

#### Scenario: Non-blank exchange and payload are accepted

- GIVEN `exchange` and `payload` both contain non-blank values
- WHEN evaluated
- THEN neither shows an inline error

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

The system MUST record each successful send into a newest-first "recent sends" list, capped at a fixed maximum with FIFO eviction of the oldest entry beyond the cap, and MUST let a tester recall an entry back into the form.

#### Scenario: Successful send is added newest-first and capped

- GIVEN a send completes successfully
- WHEN the recent sends list is inspected
- THEN the new entry appears first, and if the list exceeded its cap the oldest entry was evicted

#### Scenario: Recalling a recent send populates the form

- GIVEN an entry exists in the recent sends list
- WHEN the tester selects it to recall
- THEN `exchange`, `routingKey`, and `payload` are populated with that entry's values

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
