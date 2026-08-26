# Delta for message-consumption

## ADDED Requirements

### Requirement: Expose ReplyTo/CorrelationId on Received Messages

When an incoming AMQP delivery's `IReadOnlyBasicProperties` carries a `ReplyTo` and/or `CorrelationId`, the system MUST include those values (nullable) on the received-message data made available to consumers of that data (API responses and the SignalR broadcast payload). The system MUST NOT perform any auto-correlation, request-reply matching, or dedicated UI behavior based on these values — exposure is limited to making the data observable. Deliveries with neither value present MUST behave exactly as before this change.

#### Scenario: Received message carries both ReplyTo and CorrelationId

- GIVEN an active subscription on a queue
- WHEN a message published with ReplyTo and CorrelationId set is delivered
- THEN the received-message data broadcast via SignalR includes both values
- AND no automatic correlation or matching action is taken

#### Scenario: Received message carries only CorrelationId

- GIVEN an active subscription on a queue
- WHEN a message published with only CorrelationId set is delivered
- THEN the received-message data includes CorrelationId and omits/nulls ReplyTo

#### Scenario: Received message carries neither field

- GIVEN an active subscription on a queue
- WHEN a message published without ReplyTo or CorrelationId is delivered
- THEN the received-message data omits/nulls both fields
- AND delivery behavior is otherwise unchanged from before this change
