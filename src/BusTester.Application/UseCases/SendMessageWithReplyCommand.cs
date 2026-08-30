namespace BusTester.Application.UseCases;

public sealed record SendMessageWithReplyCommand(
    string Exchange,
    string RoutingKey,
    string Payload,
    string? CorrelationId = null,
    IReadOnlyDictionary<string, string>? Headers = null);
