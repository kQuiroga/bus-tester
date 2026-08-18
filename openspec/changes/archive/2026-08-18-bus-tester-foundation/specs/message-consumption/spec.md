# message-consumption Specification

## Purpose

Subscribing to a queue and streaming consumed messages live to the Angular UI via SignalR.

## Requirements

### Requirement: Subscribe and Receive Live Messages

The system MUST let a developer subscribe to a specified queue on an active connection and MUST push each consumed message to the Angular UI in near-real-time via SignalR, without persisting messages across restarts.

#### Scenario: Live delivery

- GIVEN an active subscription on a queue
- WHEN a message is published to that queue
- THEN `RabbitMqAdapter` consumes it and the SignalR hub pushes it to the UI
- AND it appears in the live feed without a page refresh

#### Scenario: Invalid queue

- GIVEN an active connection
- WHEN the developer subscribes to a queue that does not exist
- THEN the system captures the broker error and the UI displays it
- AND no subscription is started

#### Scenario: Feed resets on restart

- GIVEN messages were received during a session
- WHEN the process restarts
- THEN previously received messages are not available and the feed starts empty
