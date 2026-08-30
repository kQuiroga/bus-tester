# Delta for bus-connection

## MODIFIED Requirements

### Requirement: Establish and Maintain Connection

The system MUST let a developer connect to a broker by supplying a connection configuration that accepts one or more servers and OPTIONAL credentials. Today's RabbitMQ input — a single host, a port, a username, and a password — MUST remain valid and MUST behave exactly as before. The system MUST hold the connection in memory for the session only, and MUST surface unreachable-broker errors without crashing. When a connect is requested while a connection already exists, the system MUST tear down the existing connection and all of its live subscriptions before establishing the new one; loss of those subscriptions is expected, documented behavior.
(Previously: the connection config required exactly one host plus mandatory username/password, and `ConnectAsync` replaced `_connection` without closing the previous one — GitHub issue #34.)

#### Scenario: Successful connection

- GIVEN valid RabbitMQ connection details
- WHEN the developer submits connect
- THEN the connection is established and available for send/subscribe

#### Scenario: Existing RabbitMQ input is still accepted unchanged

- GIVEN a connect request body with a single host, port, username, and password (today's shape)
- WHEN the developer submits connect
- THEN the request is accepted with no new required fields
- AND the connection is established exactly as before this change

#### Scenario: Multi-server, credential-less config is accepted by validation

- GIVEN a connection config carrying a list of servers and no credentials
- WHEN the developer submits connect
- THEN request validation accepts the shape (reachability is still resolved against the broker)
- AND no missing-credentials error is raised for the absent credentials

#### Scenario: Broker unreachable

- GIVEN connection details for an unreachable broker
- WHEN the developer submits connect
- THEN the system returns an error within a bounded timeout
- AND the UI shows a clear failure message with no partial connection retained

#### Scenario: Connecting while already connected tears down the prior connection (issue #34)

- GIVEN an established connection with one or more live subscriptions
- WHEN the developer submits connect again
- THEN the prior connection is closed and its subscriptions are dropped before the new connection opens
- AND no leaked or orphaned connection object remains

#### Scenario: No state survives restart

- GIVEN an established connection
- WHEN the process restarts
- THEN no connection is restored automatically; the developer must reconnect

## ADDED Requirements

### Requirement: Adapter Declares Broker Capabilities

Each `IBusPort` adapter MUST declare a `BrokerCapabilities` descriptor stating what the connected broker supports, including at minimum a `supportsRequestReply` flag. The descriptor MUST be static per registered adapter and MUST NOT require an active connection to produce.

#### Scenario: Descriptor is available without a connection

- GIVEN no active connection exists
- WHEN the registered adapter's capabilities descriptor is requested
- THEN the descriptor is returned without attempting to connect

#### Scenario: RabbitMQ adapter reports request-reply support

- GIVEN the RabbitMQ adapter is the registered `IBusPort`
- WHEN its `BrokerCapabilities` descriptor is read
- THEN `supportsRequestReply` is `true`

### Requirement: Read Broker Capabilities Endpoint

The system MUST expose a read-only endpoint that returns the registered adapter's `BrokerCapabilities` descriptor. The endpoint MUST answer at any time regardless of connection state and MUST be free of side effects.

#### Scenario: Endpoint answers before any connect

- GIVEN the API has started and no connect has occurred
- WHEN the client reads the capabilities endpoint
- THEN it returns `200` with the descriptor for the registered adapter

#### Scenario: Descriptor is stable across connection-state changes

- GIVEN the capabilities endpoint was read once
- WHEN a connection is later established or torn down
- THEN a subsequent read returns the same descriptor
