# Delta for message-consumption

## MODIFIED Requirements

### Requirement: Expose ReplyTo/CorrelationId on Received Messages

When an incoming AMQP delivery's `IReadOnlyBasicProperties` carries a `ReplyTo` and/or `CorrelationId`, the system MUST include those values (nullable) on the received-message data made available to consumers of that data — API responses, the SignalR broadcast payload, and the frontend `ReceivedMessage`/`IncomingMessage` TypeScript interface. The frontend MUST NOT drop these fields when mapping the SignalR payload into its message model. Deliveries with neither value present MUST behave exactly as before this change. Correlation-based reply filtering into a dedicated UI panel is a separate requirement (see "Reply Panel Filters Messages by CorrelationId") and is out of scope here.
(Previously: exposure was limited to API responses and the SignalR broadcast payload; the frontend `ReceivedMessage`/`IncomingMessage` interface omitted `replyTo`/`correlationId`, and the requirement explicitly forbade any dedicated UI behavior based on these values.)

#### Scenario: Received message carries both ReplyTo and CorrelationId

- GIVEN an active subscription on a queue
- WHEN a message published with ReplyTo and CorrelationId set is delivered
- THEN the received-message data broadcast via SignalR includes both values
- AND the frontend `ReceivedMessage`/`IncomingMessage` interface exposes both values without dropping them

#### Scenario: Received message carries only CorrelationId

- GIVEN an active subscription on a queue
- WHEN a message published with only CorrelationId set is delivered
- THEN the received-message data includes CorrelationId and omits/nulls ReplyTo, on both backend and frontend

#### Scenario: Received message carries neither field

- GIVEN an active subscription on a queue
- WHEN a message published without ReplyTo or CorrelationId is delivered
- THEN the received-message data omits/nulls both fields
- AND delivery behavior is otherwise unchanged from before this change

## ADDED Requirements

### Requirement: Reply Panel Filters Messages by CorrelationId

The system MUST provide a dedicated reply panel, separate from the subscription-chip feed, that filters messages delivered on a send-with-reply subscription by matching `correlationId` client-side. The reply panel MUST NOT be merged into `SubscriptionCoordinator`'s existing chip list, and no `kind` discriminator is added to that list for this purpose. The panel MUST show a "no reply yet" state indefinitely when no matching message has arrived, since no server-side timeout applies in this slice.

#### Scenario: Reply panel shows matching reply

- GIVEN a developer sent a message requesting a reply with correlationId "abc"
- WHEN a message carrying correlationId "abc" is delivered on the auto-created subscription
- THEN it appears in the dedicated reply panel
- AND it does not appear in, or alter, the ordinary subscription-chip feed

#### Scenario: No reply yet

- GIVEN a developer sent a message requesting a reply and no matching message has arrived
- WHEN the reply panel is viewed
- THEN it indicates no reply has been received yet
- AND remains in that state indefinitely until a reply arrives or the developer unsubscribes
