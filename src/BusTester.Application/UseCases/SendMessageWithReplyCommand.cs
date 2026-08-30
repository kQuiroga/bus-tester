namespace BusTester.Application.UseCases;

/// <summary>
/// Broker-neutral send-with-reply request. <c>Target</c> is the neutral destination (RabbitMQ: the
/// AMQP exchange); <c>RoutingKey</c> is broker-specific and optional at this level.
/// </summary>
public sealed record SendMessageWithReplyCommand(
    string Target,
    string? RoutingKey,
    string Payload,
    string? CorrelationId = null,
    IReadOnlyDictionary<string, string>? Headers = null);
