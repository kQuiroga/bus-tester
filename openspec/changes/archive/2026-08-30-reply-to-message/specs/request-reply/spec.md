# Delta for request-reply

## ADDED Requirements

### Requirement: Responder Action Pre-Fills the Reply Target Into the Send Panel

A received message whose `replyTo` is non-null MUST expose a manual "Responder" action. Activating it MUST populate the existing Send panel with the reply target: Exchange set to the default-exchange convention value (an empty Exchange, per the AMQP default exchange), Routing Key set to the message's `replyTo`, and Correlation ID set to the message's `correlationId`. The payload field MUST be left fully empty, with no hint, placeholder, or seeded value. The action MUST NOT be available for a message with a null or absent `replyTo`. The action MUST function regardless of the tester's current subscription state, and MUST reuse the Send panel's existing validation, recent-sends, and template machinery rather than introducing a new composer.

#### Scenario: Message with replyTo exposes the Responder action

- GIVEN a received message that carries a non-null `replyTo`
- WHEN the message feed renders that row
- THEN a Responder action is available for that row

#### Scenario: Message without replyTo does not expose the Responder action

- GIVEN a received message whose `replyTo` is null or absent
- WHEN the message feed renders that row
- THEN no Responder action is available for that row

#### Scenario: Activating Responder pre-fills the reply target

- GIVEN a received message with `replyTo` and `correlationId` set
- WHEN the tester activates the Responder action
- THEN the Send panel Exchange holds the default-exchange convention value
- AND Routing Key holds the message's `replyTo` and Correlation ID holds the message's `correlationId`
- AND the payload field is empty with no hint or placeholder

#### Scenario: Reply works while not subscribed

- GIVEN the tester is not actively subscribed to the queue that received the message
- WHEN the tester activates the Responder action for a message with `replyTo`
- THEN the Send panel is pre-filled exactly as it would be while subscribed

#### Scenario: Message has replyTo but no correlationId

- GIVEN a received message with a non-null `replyTo` and a null or absent `correlationId`
- WHEN the tester activates the Responder action
- THEN Exchange and Routing Key are pre-filled as above
- AND Correlation ID is left blank

### Requirement: Overwriting Unsaved Send-Panel Edits Requires Confirmation

When the Send panel holds unsaved edits and the tester activates the Responder action, the system MUST warn or ask the tester to confirm before replacing the form contents. If the tester declines, the Send panel MUST be left unchanged. If the tester confirms, the Send panel MUST be overwritten with the new reply target. When the Send panel holds no unsaved edits, the pre-fill MUST proceed without any prompt. The precise definition of "unsaved edits" (the dirty-check) and the warning or confirmation UX are deferred to `sdd-design` and MUST NOT be chosen silently during implementation.

#### Scenario: Second Responder click over unsaved edits prompts first

- GIVEN the Send panel holds unsaved edits (from a prior Responder pre-fill, manual typing, a recalled recent send, or a loaded template)
- WHEN the tester activates the Responder action on another message
- THEN the system warns or asks the tester to confirm before overwriting the form

#### Scenario: Declining the confirmation preserves the form

- GIVEN the overwrite confirmation is shown
- WHEN the tester declines
- THEN the Send panel retains its existing values unchanged

#### Scenario: Confirming the overwrite applies the new reply target

- GIVEN the overwrite confirmation is shown
- WHEN the tester confirms
- THEN the Send panel is replaced with the new message's reply target

#### Scenario: Clean panel pre-fills without a prompt

- GIVEN the Send panel holds no unsaved edits
- WHEN the tester activates the Responder action
- THEN the reply target is pre-filled with no warning or confirmation
