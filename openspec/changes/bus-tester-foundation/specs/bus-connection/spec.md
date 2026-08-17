# bus-connection Specification

## Purpose

Broker connection lifecycle and the broker-agnostic `IBusPort` contract underlying all messaging use cases.

## Requirements

### Requirement: Broker-Agnostic Port Contract

The Application layer MUST expose broker operations only through `IBusPort`. Domain and Application code MUST NOT reference any broker-specific types.

#### Scenario: Adapter is swappable

- GIVEN `SendMessage` and `Subscribe` use cases depend only on `IBusPort`
- WHEN `RabbitMqAdapter` implements `IBusPort` in Infrastructure
- THEN Domain/Application compile with no RabbitMQ.Client references
- AND a fake `IBusPort` can replace the adapter in unit tests unchanged

### Requirement: Establish and Maintain Connection

The system MUST let a developer connect to RabbitMQ using host/port/credentials, MUST hold the connection in memory for the session only, and MUST surface unreachable-broker errors without crashing.

#### Scenario: Successful connection

- GIVEN valid RabbitMQ connection details
- WHEN the developer submits connect
- THEN the connection is established and available for send/subscribe

#### Scenario: Broker unreachable

- GIVEN connection details for an unreachable broker
- WHEN the developer submits connect
- THEN the system returns an error within a bounded timeout
- AND the UI shows a clear failure message with no partial connection retained

#### Scenario: No state survives restart

- GIVEN an established connection
- WHEN the process restarts
- THEN no connection is restored automatically; the developer must reconnect
