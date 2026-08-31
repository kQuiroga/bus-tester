# Delta for message-consumption

## ADDED Requirements

### Requirement: Broker-Neutral Received Message Superset

The received-message contract — the domain message mapped on receive and the SignalR `MessageReceivedDto` broadcast on the `MessageReceived` event — MUST form the same documented broker-neutral superset as the send model. The SignalR wire contract MUST stay byte-compatible: the broadcast payload keeps its existing fields (`subscriptionId`, `exchange`, `routingKey`, `payload`, `replyTo`, `correlationId`) with their current meaning. Any neutralization is additive — fields introduced by this change MUST be optional/nullable and MUST default to absent for a RabbitMQ delivery. The untouched Angular client MUST keep working without modification. RabbitMQ receive semantics MUST be observably identical to today.

#### Scenario: Existing SignalR payload is byte-compatible

- GIVEN an active RabbitMQ subscription
- WHEN a message is delivered and broadcast over SignalR
- THEN the `MessageReceived` payload contains the existing field names and values as before this change
- AND the Angular `ReceivedMessage` mapping consumes it without modification

#### Scenario: Broker-specific fields are documented as optional in the received model

- GIVEN the neutralized received-message contract
- WHEN a caller inspects it
- THEN exchange and routing key are described as broker-specific and optional
- AND any field added by this change is optional/nullable with a documented default

#### Scenario: RabbitMQ receive semantics unchanged

- GIVEN an active RabbitMQ subscription
- WHEN a message is consumed
- THEN consume, acknowledgement, and per-subscription scoping behavior are identical to before this change
