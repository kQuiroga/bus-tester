# request-reply Specification

## Purpose

Sending a message and observing its correlated reply via a broker-declared temporary queue, without any server-owned timeout or cleanup registry in this slice.

## Requirements

### Requirement: Declare and Auto-Subscribe to a Temporary Reply Queue

The system MUST let the send-with-reply flow declare a broker-generated, exclusive, auto-delete queue and automatically subscribe to it via the existing subscribe/broadcast path, without requiring the caller to supply a pre-existing or explicit queue name. Cleanup on disconnect relies solely on RabbitMQ's exclusive/auto-delete semantics; the system MUST NOT run proactive app-level unsubscribe logic in this capability.

#### Scenario: Reply queue declared and auto-subscribed

- GIVEN a developer requests a reply when sending a message
- WHEN the send-with-reply use case executes
- THEN `IBusPort` declares an exclusive, auto-delete queue with a broker-generated name
- AND the system automatically subscribes to that queue via the existing subscription path

#### Scenario: Auto-delete relies on broker cleanup alone

- GIVEN a reply queue was auto-declared as exclusive and auto-delete
- WHEN the consumer disconnects (e.g., browser tab closed) without an explicit unsubscribe
- THEN RabbitMQ deletes the queue once the last consumer is cancelled
- AND the system performs no additional proactive app-level cleanup

### Requirement: Generate CorrelationId Server-Side When Absent

When a developer requests a reply and does not supply a `CorrelationId`, the system MUST generate one server-side within the send-with-reply use case before publishing the message. A caller-supplied `CorrelationId` MUST be preserved unchanged.

#### Scenario: CorrelationId generated when blank

- GIVEN a developer requests a reply and leaves CorrelationId blank
- WHEN the send-with-reply use case executes
- THEN the system generates a CorrelationId server-side
- AND publishes the message with that CorrelationId set

#### Scenario: Caller-supplied CorrelationId is preserved

- GIVEN a developer requests a reply and supplies an explicit CorrelationId
- WHEN the send-with-reply use case executes
- THEN the system publishes the message using the supplied CorrelationId unchanged
- AND does not generate a new one

### Requirement: Return Subscription and Correlation Identifiers Immediately

The send-with-reply use case MUST return `{subscriptionId, correlationId}` to the caller immediately after publishing, without blocking on or waiting for a reply message (non-blocking, push model). No server-side timeout or reply-tracking registry is part of this capability; an unmatched subscription MUST remain active indefinitely until manually unsubscribed.

#### Scenario: Immediate response without waiting for reply

- GIVEN a developer sends a message requesting a reply
- WHEN the request completes
- THEN the response contains subscriptionId and correlationId
- AND the response is returned without waiting for any reply message to arrive

#### Scenario: No reply ever arrives

- GIVEN a developer subscribed via send-with-reply and no reply is ever published
- WHEN time passes indefinitely
- THEN the system does not time out or clean up the subscription server-side
- AND the subscription remains active until the developer manually unsubscribes

### Requirement: Multiple Replies Are Delivered Unguarded

If more than one message is published to the auto-declared reply queue before the developer unsubscribes, the system MUST deliver all of them via the existing broadcast path. The system MUST NOT enforce first-only processing or deduplicate matching messages.

#### Scenario: Multiple replies all delivered

- GIVEN an active reply subscription for a given correlationId
- WHEN two or more messages are published to the reply queue before unsubscribe
- THEN all matching messages are broadcast to the subscriber
- AND no first-only filtering or deduplication is applied

### Requirement: Responder Action Opens a Reply Drawer Anchored to the Message

A received message whose `replyTo` is non-null MUST expose a manual "Responder" action. Activating it MUST open a reply drawer on the right side of the console, anchored to that message, with the original message pinned at the top of the drawer. The drawer MUST contain a compose area pre-populated with the reply target: Exchange set to the default-exchange convention value (an empty Exchange, per the AMQP default exchange), Routing Key set to the message's `replyTo`, and Correlation ID set to the message's `correlationId`. The payload field MUST be left fully empty, with no hint, placeholder, or seeded value. Activating Responder MUST NOT modify or pre-fill the Send panel. The action MUST NOT be available for a message with a null or absent `replyTo`. The action MUST function regardless of the tester's current subscription state, and the drawer MUST reuse the existing send validation and recent-sends recording rather than introducing a separate send pipeline.
(Previously: the action pre-filled the shared Send panel and put it into a read-only "reply mode".)

#### Scenario: Message with replyTo exposes the Responder action

- GIVEN a received message that carries a non-null `replyTo`
- WHEN the message feed renders that row
- THEN a Responder action is available for that row

#### Scenario: Message without replyTo does not expose the Responder action

- GIVEN a received message whose `replyTo` is null or absent
- WHEN the message feed renders that row
- THEN no Responder action is available for that row

#### Scenario: Activating Responder opens the anchored drawer pre-filled

- GIVEN a received message with `replyTo` and `correlationId` set
- WHEN the tester activates the Responder action
- THEN a right-side drawer opens anchored to that message with the original message pinned at the top
- AND the drawer compose area holds an empty Exchange, Routing Key set to `replyTo`, and Correlation ID set to `correlationId`
- AND the payload field is empty with no hint or placeholder

#### Scenario: The Send panel is untouched by Responder

- GIVEN the Send panel holds any values or none
- WHEN the tester activates the Responder action
- THEN the Send panel's fields are unchanged and it enters no reply mode

#### Scenario: Reply works while not subscribed

- GIVEN the tester is not actively subscribed to the queue that received the message
- WHEN the tester activates the Responder action for a message with `replyTo`
- THEN the drawer opens pre-filled exactly as it would while subscribed

#### Scenario: Message has replyTo but no correlationId

- GIVEN a received message with a non-null `replyTo` and a null or absent `correlationId`
- WHEN the tester activates the Responder action
- THEN the drawer's Exchange and Routing Key are pre-filled as above
- AND Correlation ID is left blank
