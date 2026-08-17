using System.Collections.Concurrent;
using BusTester.Domain;

namespace BusTester.Application.Subscriptions;

/// <summary>
/// In-memory, process-lifetime registry of active subscriptions and the messages delivered to
/// each one. No persistence across restarts — a fresh instance starts every subscription empty.
/// </summary>
public sealed class SubscriptionCoordinator
{
    private readonly ConcurrentDictionary<SubscriptionHandle, ConcurrentQueue<BusMessage>> _messagesByHandle = new();

    public void Register(SubscriptionHandle handle) => _messagesByHandle[handle] = new ConcurrentQueue<BusMessage>();

    public void Unregister(SubscriptionHandle handle) => _messagesByHandle.TryRemove(handle, out _);

    public Task OnMessageReceivedAsync(SubscriptionHandle handle, BusMessage message, CancellationToken ct = default)
    {
        if (_messagesByHandle.TryGetValue(handle, out var queue))
        {
            queue.Enqueue(message);
        }

        return Task.CompletedTask;
    }

    public IReadOnlyCollection<BusMessage> GetMessages(SubscriptionHandle handle) =>
        _messagesByHandle.TryGetValue(handle, out var queue) ? queue.ToArray() : [];
}
