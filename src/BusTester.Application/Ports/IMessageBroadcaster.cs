using BusTester.Domain;

namespace BusTester.Application.Ports;

/// <summary>
/// Pushes a consumed message to UI clients watching a subscription. Implemented in
/// Infrastructure (SignalR) so Application depends only on this abstraction — the same
/// broker-agnostic seam pattern <see cref="IBusPort"/> provides on the broker side.
/// </summary>
public interface IMessageBroadcaster
{
    Task BroadcastAsync(SubscriptionHandle handle, BusMessage message, CancellationToken ct = default);
}
