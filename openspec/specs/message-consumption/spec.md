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

### Requirement: Expose ReplyTo/CorrelationId on Received Messages

When an incoming AMQP delivery's `IReadOnlyBasicProperties` carries a `ReplyTo` and/or `CorrelationId`, the system MUST include those values (nullable) on the received-message data made available to consumers of that data — API responses, the SignalR broadcast payload, and the frontend `ReceivedMessage`/`IncomingMessage` TypeScript interface. The frontend MUST NOT drop these fields when mapping the SignalR payload into its message model. Deliveries with neither value present MUST behave exactly as before this change. Correlation-based reply filtering into a dedicated UI panel is a separate requirement (see "Reply Panel Filters Messages by CorrelationId") and is out of scope here.
(Previously: exposure was limited to API responses and the SignalR broadcast payload; the frontend `ReceivedMessage`/`IncomingMessage` interface omitted `replyTo`/`correlationId`, and the requirement explicitly forbade any dedicated UI behavior based on these values.)

#### Scenario: Received message carries both ReplyTo and CorrelationId

- GIVEN an active subscription on a queue
- WHEN a message published with ReplyTo and CorrelationId set is delivered
- THEN the received-message data broadcast via SignalR includes both values
- AND the frontend `ReceivedMessage`/`IncomingMessage` interface exposes both values without dropping them

#### Scenario: Received message carries only CorrelationId

- GIVEN an active subscription on a queue
- WHEN a message published with only CorrelationId set is delivered
- THEN the received-message data includes CorrelationId and omits/nulls ReplyTo, on both backend and frontend

#### Scenario: Received message carries neither field

- GIVEN an active subscription on a queue
- WHEN a message published without ReplyTo or CorrelationId is delivered
- THEN the received-message data omits/nulls both fields
- AND delivery behavior is otherwise unchanged from before this change

### Requirement: Reply Panel Filters Messages by CorrelationId

The system MUST provide a dedicated reply panel, separate from the subscription-chip feed, that filters messages delivered on a send-with-reply subscription by matching `correlationId` client-side. The reply panel MUST NOT be merged into `SubscriptionCoordinator`'s existing chip list, and no `kind` discriminator is added to that list for this purpose. The panel MUST show a "no reply yet" state indefinitely when no matching message has arrived, since no server-side timeout applies in this slice.

#### Scenario: Reply panel shows matching reply

- GIVEN a developer sent a message requesting a reply with correlationId "abc"
- WHEN a message carrying correlationId "abc" is delivered on the auto-created subscription
- THEN it appears in the dedicated reply panel
- AND it does not appear in, or alter, the ordinary subscription-chip feed

#### Scenario: No reply yet

- GIVEN a developer sent a message requesting a reply and no matching message has arrived
- WHEN the reply panel is viewed
- THEN it indicates no reply has been received yet
- AND remains in that state indefinitely until a reply arrives or the developer unsubscribes

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
