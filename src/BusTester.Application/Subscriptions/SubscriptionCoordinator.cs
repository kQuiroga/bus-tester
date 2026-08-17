using System.Collections.Concurrent;
using BusTester.Application.Ports;
using BusTester.Domain;

namespace BusTester.Application.Subscriptions;

/// <summary>
/// In-memory, process-lifetime registry of active subscriptions and the messages delivered to
/// each one. No persistence across restarts — a fresh instance starts every subscription empty.
/// Also forwards each delivered message to an <see cref="IMessageBroadcaster"/> (SignalR in
/// production) so the Angular UI receives it live (message-consumption: "Live delivery").
/// </summary>
public sealed class SubscriptionCoordinator
{
    private readonly ConcurrentDictionary<SubscriptionHandle, ConcurrentQueue<BusMessage>> _messagesByHandle = new();
    private readonly IMessageBroadcaster _broadcaster;

    public SubscriptionCoordinator(IMessageBroadcaster? broadcaster = null)
    {
        _broadcaster = broadcaster ?? NoOpMessageBroadcaster.Instance;
    }

    public void Register(SubscriptionHandle handle) => _messagesByHandle[handle] = new ConcurrentQueue<BusMessage>();

    public void Unregister(SubscriptionHandle handle) => _messagesByHandle.TryRemove(handle, out _);

    public async Task OnMessageReceivedAsync(SubscriptionHandle handle, BusMessage message, CancellationToken ct = default)
    {
        if (!_messagesByHandle.TryGetValue(handle, out var queue))
        {
            return;
        }

        queue.Enqueue(message);
        await _broadcaster.BroadcastAsync(handle, message, ct);
    }

    public IReadOnlyCollection<BusMessage> GetMessages(SubscriptionHandle handle) =>
        _messagesByHandle.TryGetValue(handle, out var queue) ? queue.ToArray() : [];
}
