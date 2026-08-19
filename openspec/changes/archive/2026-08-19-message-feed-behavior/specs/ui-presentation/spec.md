# Delta for ui-presentation

## ADDED Requirements

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

## MODIFIED Requirements

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
