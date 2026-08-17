namespace BusTester.Application.UseCases;

public sealed record SendMessageCommand(string Exchange, string RoutingKey, string Payload);
