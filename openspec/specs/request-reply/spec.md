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

### Requirement: Responder Action Pre-Fills the Reply Target Into the Send Panel

A received message whose `replyTo` is non-null MUST expose a manual "Responder" action. Activating it MUST populate the existing Send panel with the reply target: Exchange set to the default-exchange convention value (an empty Exchange, per the AMQP default exchange), Routing Key set to the message's `replyTo`, and Correlation ID set to the message's `correlationId`. The payload field MUST be left fully empty, with no hint, placeholder, or seeded value. The action MUST NOT be available for a message with a null or absent `replyTo`. The action MUST function regardless of the tester's current subscription state, and MUST reuse the Send panel's existing validation, recent-sends, and template machinery rather than introducing a new composer.

#### Scenario: Message with replyTo exposes the Responder action

- GIVEN a received message that carries a non-null `replyTo`
- WHEN the message feed renders that row
- THEN a Responder action is available for that row

#### Scenario: Message without replyTo does not expose the Responder action

- GIVEN a received message whose `replyTo` is null or absent
- WHEN the message feed renders that row
- THEN no Responder action is available for that row

#### Scenario: Activating Responder pre-fills the reply target

- GIVEN a received message with `replyTo` and `correlationId` set
- WHEN the tester activates the Responder action
- THEN the Send panel Exchange holds the default-exchange convention value
- AND Routing Key holds the message's `replyTo` and Correlation ID holds the message's `correlationId`
- AND the payload field is empty with no hint or placeholder

#### Scenario: Reply works while not subscribed

- GIVEN the tester is not actively subscribed to the queue that received the message
- WHEN the tester activates the Responder action for a message with `replyTo`
- THEN the Send panel is pre-filled exactly as it would be while subscribed

#### Scenario: Message has replyTo but no correlationId

- GIVEN a received message with a non-null `replyTo` and a null or absent `correlationId`
- WHEN the tester activates the Responder action
- THEN Exchange and Routing Key are pre-filled as above
- AND Correlation ID is left blank

### Requirement: Overwriting Unsaved Send-Panel Edits Requires Confirmation

When the Send panel holds unsaved edits and the tester activates the Responder action, the system MUST warn or ask the tester to confirm before replacing the form contents. If the tester declines, the Send panel MUST be left unchanged. If the tester confirms, the Send panel MUST be overwritten with the new reply target. When the Send panel holds no unsaved edits, the pre-fill MUST proceed without any prompt. The precise definition of "unsaved edits" (the dirty-check) and the warning or confirmation UX are deferred to `sdd-design` and MUST NOT be chosen silently during implementation.

#### Scenario: Second Responder click over unsaved edits prompts first

- GIVEN the Send panel holds unsaved edits (from a prior Responder pre-fill, manual typing, a recalled recent send, or a loaded template)
- WHEN the tester activates the Responder action on another message
- THEN the system warns or asks the tester to confirm before overwriting the form

#### Scenario: Declining the confirmation preserves the form

- GIVEN the overwrite confirmation is shown
- WHEN the tester declines
- THEN the Send panel retains its existing values unchanged

#### Scenario: Confirming the overwrite applies the new reply target

- GIVEN the overwrite confirmation is shown
- WHEN the tester confirms
- THEN the Send panel is replaced with the new message's reply target

#### Scenario: Clean panel pre-fills without a prompt

- GIVEN the Send panel holds no unsaved edits
- WHEN the tester activates the Responder action
- THEN the reply target is pre-filled with no warning or confirmation

### Requirement: Request-Reply Is Gated by a Capability Flag

The `BrokerCapabilities` descriptor MUST expose a `supportsRequestReply` flag, and the send-with-reply flow (temporary reply-queue declaration, auto-subscribe, server-side CorrelationId generation, and the `POST /api/messages/with-reply` endpoint) MUST be available only when the connected adapter reports `supportsRequestReply: true`. The RabbitMQ adapter MUST report `true`, and when the flag is `true` all existing request-reply behavior MUST be observably unchanged. No request-reply behavior is made broker-neutral by this change.

#### Scenario: RabbitMQ reports support and request-reply works as before

- GIVEN an active RabbitMQ connection
- WHEN the developer sends a message requesting a reply
- THEN `supportsRequestReply` is `true`
- AND the temporary reply queue, auto-subscribe, and CorrelationId behavior are identical to before this change

#### Scenario: Request-reply is rejected when the broker does not support it

- GIVEN a connected adapter whose `BrokerCapabilities` reports `supportsRequestReply: false`
- WHEN a send-with-reply request is submitted
- THEN the system rejects it with a clear error and declares no reply queue
- AND ordinary send and subscribe behavior is unaffected

#### Scenario: Capability flag is readable before connecting

- GIVEN no active connection
- WHEN the capabilities endpoint is read
- THEN `supportsRequestReply` is present for the registered adapter
