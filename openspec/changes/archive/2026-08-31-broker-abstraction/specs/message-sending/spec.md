# Delta for message-sending

## ADDED Requirements

### Requirement: Broker-Neutral Send Message Superset

The send model (`BusMessage`) and the `POST /api/messages` request DTO MUST form a documented broker-neutral superset. Broker-specific fields (the AMQP exchange and routing key) MAY be optional at the model level, but the HTTP wire contract MUST stay byte-compatible: the request keeps the existing field names `exchange` and `routingKey` with their current meaning, and any neutralization is additive — new fields introduced by this change MUST be optional and MUST NOT be required for a RabbitMQ send. Internal C# type and member names MAY change. RabbitMQ send semantics MUST be observably identical to today.

#### Scenario: Existing send request is byte-compatible

- GIVEN a `POST /api/messages` body using today's fields (`exchange`, `routingKey`, `payload`, optional `replyTo`/`correlationId`)
- WHEN the developer submits it on an active RabbitMQ connection
- THEN the request is accepted with no new required fields
- AND the message is published exactly as before this change

#### Scenario: Broker-specific fields are documented as optional in the model

- GIVEN the neutralized `BusMessage` / send DTO
- WHEN a caller inspects the contract
- THEN exchange and routing key are described as broker-specific and optional at the model level
- AND any field added by this change is optional with a documented default

#### Scenario: RabbitMQ send semantics unchanged

- GIVEN an active RabbitMQ connection
- WHEN a message is sent through the neutralized model
- THEN publish behavior, `BasicProperties` handling, and default-exchange handling are identical to before this change
