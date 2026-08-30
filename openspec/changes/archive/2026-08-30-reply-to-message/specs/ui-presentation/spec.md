# Delta for ui-presentation

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Send Panel Validates Exchange and Payload as Required

The `SendComponent` MUST treat `payload` as a required, non-blank field, rejecting empty or whitespace-only values.

The `SendComponent` MUST treat `exchange` as a required, non-blank field **except** when the panel is in reply mode (entered via the Responder pre-fill). In reply mode, an exactly-empty Exchange (`""`, the AMQP default exchange) MUST be accepted and MUST NOT show an inline error; the Exchange field is rendered read-only in that state. Reply mode MUST be cleared as soon as the tester manually edits the Exchange or Routing Key, at which point the ordinary required, non-blank Exchange rule applies again. Whitespace-only Exchange values are never valid, in either mode.
(Previously: exchange and payload both unconditionally required and non-blank, with no acknowledged default-exchange case. Design resolved the conflict with an explicit `replyMode` signal — see design.md §Default-exchange mechanism.)

#### Scenario: Blank or whitespace payload is rejected

- GIVEN `payload` is empty or whitespace-only
- WHEN the field is evaluated
- THEN it is marked invalid with an inline error

#### Scenario: Blank or whitespace exchange is rejected outside reply mode

- GIVEN the panel is not in reply mode
- AND `exchange` is empty or whitespace-only
- WHEN the field is evaluated
- THEN it is marked invalid with an inline error

#### Scenario: Non-blank exchange and payload are accepted

- GIVEN `exchange` and `payload` both contain non-blank values
- WHEN evaluated
- THEN neither shows an inline error

#### Scenario: Reply-mode empty exchange is accepted

- GIVEN the Responder action pre-filled the Send panel and the panel is in reply mode
- AND Exchange is exactly `""`
- WHEN the field is evaluated
- THEN Exchange shows no inline error and submit is not blocked on that field
- AND the Exchange field is read-only

#### Scenario: Editing exchange or routing key leaves reply mode

- GIVEN the panel is in reply mode with an empty Exchange
- WHEN the tester manually edits the Exchange or Routing Key
- THEN reply mode is cleared
- AND the ordinary required, non-blank Exchange rule applies again
