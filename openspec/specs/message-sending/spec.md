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
