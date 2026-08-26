# Delta for message-sending

## ADDED Requirements

### Requirement: Request a Reply via Auto-Created Temp Queue

The system MAY let a developer request a reply when sending a message. When a reply is requested, the system MUST auto-create an exclusive, auto-delete temporary queue and auto-subscribe to it instead of requiring the developer to supply a pre-existing queue name. The system MUST set the outgoing message's `ReplyTo` to that declared queue's name, and MUST apply the `request-reply` capability's server-side CorrelationId generation when the developer leaves CorrelationId blank. Sending without requesting a reply MUST behave exactly as before this change (per the existing "Optional ReplyTo/CorrelationId on Send" requirement, unmodified).

#### Scenario: Requesting a reply auto-creates and subscribes

- GIVEN an active connection
- WHEN the developer sends a message and requests a reply without specifying an existing queue
- THEN the system auto-creates a temporary exclusive, auto-delete queue and auto-subscribes to it
- AND the outgoing message's ReplyTo is set to that queue's name

#### Scenario: Requesting a reply with blank CorrelationId

- GIVEN an active connection
- WHEN the developer requests a reply and leaves CorrelationId blank
- THEN the system generates a CorrelationId server-side
- AND publishes the message with that CorrelationId set

#### Scenario: Not requesting a reply is unaffected

- GIVEN an active connection
- WHEN the developer sends a message without requesting a reply
- THEN publish behavior is exactly as before this change
- AND no temporary queue is created
