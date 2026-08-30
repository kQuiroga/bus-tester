# Delta for message-sending

## MODIFIED Requirements

### Requirement: Send Message to Exchange/Queue/Routing Key

The system MUST let a developer publish a message on an active connection by specifying exchange, routing key, and payload, and MUST surface broker-reported send errors without corrupting the connection.

An exactly-empty Exchange (`""`) MUST be accepted as the AMQP default exchange (which routes by queue name and always exists) — the system MUST publish such a message and MUST NOT perform a passive exchange declare for it. A whitespace-only Exchange MUST still be rejected as invalid. `POST /api/messages` therefore returns 200 for `exchange: ""` and 400 (`application/problem+json`) for a whitespace-only exchange.
(Previously: any blank Exchange, empty or whitespace, was rejected with 400 because the Domain `BusMessage` guard used `IsNullOrWhiteSpace`.)

#### Scenario: Successful publish

- GIVEN an active connection
- WHEN the developer submits exchange, routing key, and payload
- THEN the message is published via `IBusPort` and the UI confirms success

#### Scenario: Publish to the default exchange with an empty Exchange

- GIVEN an active connection
- WHEN the developer submits an exactly-empty Exchange (`""`) with a routing key and payload
- THEN the message is published to the AMQP default exchange, routed by the routing key as a queue name
- AND no passive exchange declare is attempted for the empty exchange

#### Scenario: Whitespace-only exchange is rejected

- GIVEN a send request whose Exchange is whitespace-only
- WHEN the developer attempts to send
- THEN the system rejects the request with `400` `application/problem+json` and the message never reaches `IBusPort`

#### Scenario: Invalid exchange or no connection

- GIVEN no active connection, or an exchange that does not exist on the broker
- WHEN the developer attempts to send
- THEN the system rejects the request and the UI displays the error
- AND any existing connection remains usable
