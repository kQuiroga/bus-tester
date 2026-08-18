# Delta for ui-presentation

> New presentation-layer capability. No functional capability changed: `bus-connection`, `message-sending`, and `message-consumption` keep identical behavior (verified against their existing specs) — only visual rendering and a CSS-encapsulation bugfix are in scope.

## ADDED Requirements

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

### Requirement: Panels Render as Distinct Card Sections

The connect, send, and subscribe panels MUST render as visually distinct bordered/card-style sections, separated from each other and from the page background.

#### Scenario: Panels are visually separated

- GIVEN the app is rendered in a browser
- WHEN a developer views the page
- THEN the connect, send, and subscribe panels each show a card boundary (border/background contrast)
- AND no panel visually merges with an adjacent panel or the page background

### Requirement: Status Messages Are Visually Differentiated

Connection, send, and subscribe status messages MUST be visually differentiated between success ("ok") and failure ("error") outcomes using distinct color treatment.

#### Scenario: Success status is visually distinct

- GIVEN an operation (connect/send/subscribe) succeeds
- WHEN the status message renders
- THEN it uses the "ok" visual treatment, distinguishable from the "error" treatment

#### Scenario: Error status is visually distinct

- GIVEN an operation (connect/send/subscribe) fails
- WHEN the status message renders
- THEN it uses the "error" visual treatment, distinguishable from the "ok" treatment

### Requirement: Live Message Feed Renders Rows With a Scroll Cap

The live message feed MUST render each consumed message as a visually distinct row. The feed SHOULD apply a bounded, scrollable container so the feed's rendered height does not grow unbounded as messages accumulate.

#### Scenario: Each message is a distinct row

- GIVEN one or more messages have been received on the live feed
- WHEN the feed renders
- THEN each message occupies its own visually distinct row (separated by border/spacing)

#### Scenario: Feed height is capped

- GIVEN more messages arrive than fit the feed's visible area
- WHEN the feed renders
- THEN the feed container becomes scrollable instead of growing the page height without bound

### Requirement: Form Inputs and Actions Provide Visual Affordance

Form inputs MUST show a visible focus indicator (ring) when focused via keyboard or pointer. Primary and secondary actions MUST be visually distinguished from each other by style (e.g., fill vs. outline).

#### Scenario: Focused input shows a ring

- GIVEN a form input in the connect or send panel
- WHEN the input receives focus
- THEN a visible focus ring is rendered around it

#### Scenario: Primary and secondary actions differ

- GIVEN a panel with both a primary action (e.g., Connect/Send) and a secondary action
- WHEN both are rendered
- THEN their visual styles are distinguishable from one another
