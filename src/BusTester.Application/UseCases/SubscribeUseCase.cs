using BusTester.Application.Ports;
using BusTester.Application.Subscriptions;
using BusTester.Domain;

namespace BusTester.Application.UseCases;

/// <summary>
/// Starts consuming a queue on the active broker connection and registers the resulting
/// subscription with the <see cref="SubscriptionCoordinator"/> so delivered messages are
/// buffered for the UI to read. On broker rejection (<c>BusSubscriptionException</c>,
/// <c>BusConnectionException</c>) no subscription is registered.
/// </summary>
public sealed class SubscribeUseCase
{
    private readonly IBusPort _busPort;
    private readonly SubscriptionCoordinator _coordinator;

    public SubscribeUseCase(IBusPort busPort, SubscriptionCoordinator coordinator)
    {
        _busPort = busPort;
        _coordinator = coordinator;
    }

    public async Task<SubscriptionHandle> HandleAsync(SubscribeCommand command, CancellationToken ct = default)
    {
        var request = new SubscriptionRequest(command.QueueName);
        SubscriptionHandle? handle = null;

        Task OnMessage(BusMessage message, CancellationToken messageCt) =>
            handle is null
                ? Task.CompletedTask
                : _coordinator.OnMessageReceivedAsync(handle.Value, message, messageCt);

        var registeredHandle = await _busPort.SubscribeAsync(request, OnMessage, ct);
        handle = registeredHandle;
        _coordinator.Register(registeredHandle);
        return registeredHandle;
    }
}
