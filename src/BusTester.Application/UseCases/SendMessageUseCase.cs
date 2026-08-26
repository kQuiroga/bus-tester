using BusTester.Application.Ports;
using BusTester.Domain;

namespace BusTester.Application.UseCases;

/// <summary>
/// Publishes a message on the active broker connection. Broker/connection failures raised by
/// <see cref="IBusPort"/> (<c>BusPublishException</c>, <c>BusConnectionException</c>) propagate
/// unchanged so callers can surface them without the connection being affected.
/// </summary>
public sealed class SendMessageUseCase
{
    private readonly IBusPort _busPort;

    public SendMessageUseCase(IBusPort busPort)
    {
        _busPort = busPort;
    }

    public async Task HandleAsync(SendMessageCommand command, CancellationToken ct = default)
    {
        var message = new BusMessage(
            command.Exchange,
            command.RoutingKey,
            command.Payload,
            command.ReplyTo,
            command.CorrelationId);
        await _busPort.SendAsync(message, ct);
    }
}
