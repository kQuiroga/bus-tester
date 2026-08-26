# message-sending Specification

## Purpose

Publishing a message to a RabbitMQ exchange/queue with a routing key.

## Requirements

### Requirement: Send Message to Exchange/Queue/Routing Key

The system MUST let a developer publish a message on an active connection by specifying exchange, routing key, and payload, and MUST surface broker-reported send errors without corrupting the connection.

#### Scenario: Successful publish

- GIVEN an active connection
- WHEN the developer submits exchange, routing key, and payload
- THEN the message is published via `IBusPort` and the UI confirms success

#### Scenario: Invalid exchange or no connection

- GIVEN no active connection, or an exchange that does not exist on the broker
- WHEN the developer attempts to send
- THEN the system rejects the request and the UI displays the error
- AND any existing connection remains usable

### Requirement: Optional ReplyTo/CorrelationId on Send

The system MAY accept optional `ReplyTo` and `CorrelationId` values when a developer sends a message. When either value is supplied, the system MUST publish it via AMQP `BasicProperties` on the outgoing message. `ReplyTo` and `CorrelationId` MUST be treated as independent, opaque strings — the system MUST NOT require one to be present because the other is present, and MUST NOT apply any format or length validation beyond the broker's own AMQP short-string limits. Omitting both fields MUST leave publish behavior unchanged from today (no `BasicProperties` object required).

#### Scenario: Send with both ReplyTo and CorrelationId

- GIVEN an active connection
- WHEN the developer submits exchange, routing key, payload, and both ReplyTo and CorrelationId
- THEN the message is published with `BasicProperties.ReplyTo` and `BasicProperties.CorrelationId` set to the supplied values

#### Scenario: Send with only CorrelationId, no ReplyTo

- GIVEN an active connection
- WHEN the developer submits a message with CorrelationId set and ReplyTo omitted
- THEN the message is published with `BasicProperties.CorrelationId` set and `ReplyTo` absent
- AND the send is not rejected or altered for lacking a ReplyTo

#### Scenario: Send with only ReplyTo, no CorrelationId

- GIVEN an active connection
- WHEN the developer submits a message with ReplyTo set and CorrelationId omitted
- THEN the message is published with `BasicProperties.ReplyTo` set and `CorrelationId` absent
- AND the send is not rejected or altered for lacking a CorrelationId

#### Scenario: Send without either field is unchanged

- GIVEN an active connection
- WHEN the developer submits exchange, routing key, and payload with no ReplyTo and no CorrelationId
- THEN the message is published exactly as today, with no behavioral difference from before this change

### Requirement: Send DTO Exposes Optional ReplyTo/CorrelationId

The `MessagesController` Send request DTO MUST accept optional `ReplyTo` and `CorrelationId` fields, threaded unchanged through to `IBusPort.SendAsync`. Their absence MUST NOT be rejected by request validation.

#### Scenario: API accepts request with reply headers

- GIVEN a valid Send request body including ReplyTo and CorrelationId
- WHEN the API processes the request
- THEN the message is sent with those values applied via `BasicProperties`

#### Scenario: API accepts request without reply headers

- GIVEN a valid Send request body omitting ReplyTo and CorrelationId
- WHEN the API processes the request
- THEN the request succeeds identically to the pre-existing behavior

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
