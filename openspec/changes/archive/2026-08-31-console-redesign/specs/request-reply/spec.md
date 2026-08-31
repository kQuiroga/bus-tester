# Delta for request-reply

## RENAMED Requirements

### Requirement: Responder Action Pre-Fills the Reply Target Into the Send Panel → Responder Action Opens a Reply Drawer Anchored to the Message

(Reason: reply composition moves out of the shared Send panel into a dedicated right-side drawer so the Send panel is never hijacked.)
(Migration: tests and docs referencing Send-panel pre-fill must target the reply drawer instead.)

## MODIFIED Requirements

### Requirement: Responder Action Opens a Reply Drawer Anchored to the Message

A received message whose `replyTo` is non-null MUST expose a manual "Responder" action. Activating it MUST open a reply drawer on the right side of the console, anchored to that message, with the original message pinned at the top of the drawer. The drawer MUST contain a compose area pre-populated with the reply target: Exchange set to the default-exchange convention value (an empty Exchange, per the AMQP default exchange), Routing Key set to the message's `replyTo`, and Correlation ID set to the message's `correlationId`. The payload field MUST be left fully empty, with no hint, placeholder, or seeded value. Activating Responder MUST NOT modify or pre-fill the Send panel. The action MUST NOT be available for a message with a null or absent `replyTo`. The action MUST function regardless of the tester's current subscription state, and the drawer MUST reuse the existing send validation and recent-sends recording rather than introducing a separate send pipeline.
(Previously: the action pre-filled the shared Send panel and put it into a read-only "reply mode".)

#### Scenario: Message with replyTo exposes the Responder action

- GIVEN a received message that carries a non-null `replyTo`
- WHEN the message feed renders that row
- THEN a Responder action is available for that row

#### Scenario: Message without replyTo does not expose the Responder action

- GIVEN a received message whose `replyTo` is null or absent
- WHEN the message feed renders that row
- THEN no Responder action is available for that row

#### Scenario: Activating Responder opens the anchored drawer pre-filled

- GIVEN a received message with `replyTo` and `correlationId` set
- WHEN the tester activates the Responder action
- THEN a right-side drawer opens anchored to that message with the original message pinned at the top
- AND the drawer compose area holds an empty Exchange, Routing Key set to `replyTo`, and Correlation ID set to `correlationId`
- AND the payload field is empty with no hint or placeholder

#### Scenario: The Send panel is untouched by Responder

- GIVEN the Send panel holds any values or none
- WHEN the tester activates the Responder action
- THEN the Send panel's fields are unchanged and it enters no reply mode

#### Scenario: Reply works while not subscribed

- GIVEN the tester is not actively subscribed to the queue that received the message
- WHEN the tester activates the Responder action for a message with `replyTo`
- THEN the drawer opens pre-filled exactly as it would while subscribed

#### Scenario: Message has replyTo but no correlationId

- GIVEN a received message with a non-null `replyTo` and a null or absent `correlationId`
- WHEN the tester activates the Responder action
- THEN the drawer's Exchange and Routing Key are pre-filled as above
- AND Correlation ID is left blank

## REMOVED Requirements

### Requirement: Overwriting Unsaved Send-Panel Edits Requires Confirmation

(Reason: with reply composition moved into a dedicated drawer, activating Responder never touches Send-panel contents, so there is nothing to overwrite and no dirty-check to run.)
(Migration: None. No confirmation prompt is introduced on the drawer, and closing the drawer requires no confirmation. Remove the associated dirty-check and confirmation tests.)
