# message-consumption Specification

## Purpose

Subscribing to a queue and streaming consumed messages live to the Angular UI via SignalR.

## Requirements

### Requirement: Pause and Resume the Displayed Feed

The system MUST let a developer pause the displayed message feed while `BusHubService` continues to receive and accumulate messages unchanged. Resuming MUST cause the displayed feed to jump directly to the current live list state (instant catch-up); the system MUST NOT provide a "N new messages, click to reveal" affordance for messages skipped during the pause.

#### Scenario: Pausing freezes the display

- GIVEN messages are being received into an active feed
- WHEN a developer pauses the feed
- THEN the displayed list stops updating
- AND messages continue to be received and accumulated in `BusHubService`

#### Scenario: Resuming shows instant catch-up

- GIVEN the feed was paused and further messages arrived during the pause
- WHEN a developer resumes the feed
- THEN the displayed list jumps directly to the full current live list
- AND no interstitial "new messages" control is shown

### Requirement: Filter Displayed Messages by Search Term

The system MUST let a developer filter the displayed message feed by a search term, matched case-insensitively as a substring against each message's routing key, exchange, and raw (non-pretty-printed) payload string.

#### Scenario: Search matches routing key or exchange

- GIVEN messages are displayed
- WHEN a developer enters a search term matching a message's routing key or exchange
- THEN only matching messages remain displayed

#### Scenario: Search matches raw payload

- GIVEN a displayed message's payload contains the search term as a substring
- WHEN a developer enters that term
- THEN the message remains displayed, matched against the raw payload string rather than any pretty-printed form

#### Scenario: Search combines with pause

- GIVEN the feed is paused
- WHEN a developer enters a search term
- THEN filtering applies to the paused (frozen) displayed list only, without resuming the feed

### Requirement: Subscribe and Receive Live Messages

The system MUST let a developer subscribe to a specified queue on an active connection and MUST push each consumed message to the Angular UI in near-real-time via SignalR, without persisting messages across restarts. Pause/resume and filter/search operate only on the client-displayed subset of this feed; they MUST NOT affect message delivery to, or accumulation within, `BusHubService`.

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

#### Scenario: Delivery continues while paused

- GIVEN the displayed feed is paused
- WHEN a message is published to the subscribed queue
- THEN `BusHubService` still receives and accumulates it
- AND the displayed list does not update until resume
