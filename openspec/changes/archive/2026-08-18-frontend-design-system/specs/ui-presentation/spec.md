# Delta for ui-presentation

> Supersedes/rewrites `frontend-tailwind-restyle`'s `ui-presentation` spec. **Carry-forward unchanged** (not reproduced): "Global Stylesheet Reaches All Feature Templates". All other prior requirements are rewritten as MODIFIED, or supplemented via ADDED. Card/status/focus tokens apply to both theme sets.

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Live Message Feed Renders Rows With a Scroll Cap
The feed MUST render each message as a distinct row using spacing/border tokens, and SHOULD cap height via a scrollable container, in both layouts.
(Previously: hardcoded, no responsive-layout tie)

#### Scenario: Each message is a distinct row
- GIVEN one or more messages have been received
- WHEN the feed renders
- THEN each occupies its own row with token-sourced spacing

#### Scenario: Feed height is capped in any layout
- GIVEN more messages than fit the feed's visible area
- WHEN the feed renders
- THEN it becomes scrollable instead of growing page height

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
