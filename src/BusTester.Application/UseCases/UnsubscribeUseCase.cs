using BusTester.Application.Ports;
using BusTester.Application.Subscriptions;
using BusTester.Domain;

namespace BusTester.Application.UseCases;

/// <summary>
/// Stops an active subscription: cancels the adapter's internal consumer/loop and removes the
/// subscription from the <see cref="SubscriptionCoordinator"/> registry.
/// </summary>
public sealed class UnsubscribeUseCase
{
    private readonly IBusPort _busPort;
    private readonly SubscriptionCoordinator _coordinator;

    public UnsubscribeUseCase(IBusPort busPort, SubscriptionCoordinator coordinator)
    {
        _busPort = busPort;
        _coordinator = coordinator;
    }

    public async Task HandleAsync(SubscriptionHandle handle, CancellationToken ct = default)
    {
        await _busPort.UnsubscribeAsync(handle, ct);
        _coordinator.Unregister(handle);
    }
}
