using BusTester.Domain;

namespace BusTester.Application.Ports;

/// <summary>
/// Default <see cref="IMessageBroadcaster"/> used when no UI push mechanism is wired (e.g. tests
/// that only care about the in-memory message buffer).
/// </summary>
internal sealed class NoOpMessageBroadcaster : IMessageBroadcaster
{
    public static readonly NoOpMessageBroadcaster Instance = new();

    private NoOpMessageBroadcaster()
    {
    }

    public Task BroadcastAsync(SubscriptionHandle handle, BusMessage message, CancellationToken ct = default) =>
        Task.CompletedTask;
}
