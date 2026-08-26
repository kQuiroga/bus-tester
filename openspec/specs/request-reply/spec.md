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
