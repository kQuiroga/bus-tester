# Delta for request-reply

## ADDED Requirements

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
