# Delta for message-sending

## ADDED Requirements

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
