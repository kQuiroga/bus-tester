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

The system MUST let a developer subscribe to multiple queues concurrently on an active connection, each subscription rendered as its own chip, and MUST push each consumed message to the Angular UI in near-real-time via SignalR, scoped to its originating subscription, without persisting messages across restarts. The system MUST NOT permit two active subscriptions with the same `queueName`; Subscribe MUST be disabled/blocked when the entered `queueName` already matches an active subscription. Unsubscribing one subscription MUST remove only that subscription's messages from the displayed feed and from `BusHubService` state, leaving all other active subscriptions' messages intact. Pause/resume and filter/search operate only on the client-displayed subset of this feed; they MUST NOT affect message delivery to, or accumulation within, `BusHubService`.
(Previously: implicit single-active-subscription — Subscribe disabled once any subscription existed, and unscoped clear-all on unsubscribe.)

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

#### Scenario: Multiple concurrent subscriptions each receive their own messages

- GIVEN a developer holds active subscriptions to queue A and queue B
- WHEN a message is published to queue A
- THEN it appears attributed to queue A's chip
- AND queue B's chip count and messages remain unchanged

#### Scenario: Duplicate queueName is blocked

- GIVEN a chip already exists for queueName "orders"
- WHEN the developer enters "orders" again and attempts to subscribe
- THEN Subscribe is disabled or blocked for that entry
- AND no duplicate chip is created

#### Scenario: Unsubscribing one chip removes only that chip's messages, others remain intact

- GIVEN active subscriptions to queue A and queue B, each with received messages
- WHEN the developer unsubscribes queue A's chip
- THEN queue A's chip and its messages are removed from the feed and from `BusHubService` state
- AND queue B's chip and its messages remain fully intact and unaffected

### Requirement: Subscribe and Unsubscribe Failures Are Handled Without Unhandled Rejections

The system MUST handle errors from `joinSubscription` and `leaveSubscription` operations explicitly rather than as fire-and-forget calls, surfacing failures to the UI status area rather than producing an unhandled promise rejection.

#### Scenario: Join failure surfaces to status, no unhandled rejection

- GIVEN a subscribe action triggers `joinSubscription`
- WHEN the hub call rejects
- THEN the failure is caught and reflected in the UI status
- AND no unhandled promise rejection occurs

#### Scenario: Leave failure surfaces to status, no unhandled rejection

- GIVEN an unsubscribe action triggers `leaveSubscription`
- WHEN the hub call rejects
- THEN the failure is caught and reflected in the UI status
- AND no unhandled promise rejection occurs
