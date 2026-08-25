# Delta for message-consumption

## MODIFIED Requirements

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

## ADDED Requirements

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
