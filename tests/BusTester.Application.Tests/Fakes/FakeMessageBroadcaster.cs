using BusTester.Application.Ports;
using BusTester.Domain;

namespace BusTester.Application.Tests.Fakes;

/// <summary>
/// In-memory <see cref="IMessageBroadcaster"/> test double recording every push so tests can
/// assert the coordinator forwards delivered messages without a live SignalR hub.
/// </summary>
public sealed class FakeMessageBroadcaster : IMessageBroadcaster
{
    public List<(SubscriptionHandle Handle, BusMessage Message)> Broadcasts { get; } = [];

    public Task BroadcastAsync(SubscriptionHandle handle, BusMessage message, CancellationToken ct = default)
    {
        Broadcasts.Add((handle, message));
        return Task.CompletedTask;
    }
}
