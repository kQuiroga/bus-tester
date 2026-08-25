# Delta for UI Presentation

## MODIFIED Requirements

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
