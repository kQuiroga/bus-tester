namespace BusTester.Application.UseCases;

/// <summary>
/// Broker-neutral send request. <c>Target</c> is the neutral destination (RabbitMQ: the AMQP
/// exchange, <c>""</c> = default exchange); <c>RoutingKey</c> is broker-specific and optional at
/// this level (the RabbitMQ adapter enforces non-blank at publish time).
/// </summary>
public sealed record SendMessageCommand(
    string Target,
    string? RoutingKey,
    string Payload,
    string? ReplyTo = null,
    string? CorrelationId = null,
    IReadOnlyDictionary<string, string>? Headers = null);
