using BusTester.Application.Ports;
using BusTester.Domain;
using Microsoft.AspNetCore.SignalR;

namespace BusTester.Infrastructure;

/// <summary>
/// <see cref="IMessageBroadcaster"/> implementation that pushes a delivered message to the
/// SignalR group for its subscription (message-consumption: "Live delivery").
/// </summary>
public sealed class SignalRMessageBroadcaster : IMessageBroadcaster
{
    private readonly IHubContext<BusHub> _hubContext;

    public SignalRMessageBroadcaster(IHubContext<BusHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task BroadcastAsync(SubscriptionHandle handle, BusMessage message, CancellationToken ct = default) =>
        _hubContext.Clients.Group(BusHub.GroupName(handle.Value)).SendAsync(
            "MessageReceived",
            new MessageReceivedDto(handle.Value, message.Exchange, message.RoutingKey, message.Payload),
            ct);
}

/// <summary>Shape pushed to the Angular client over SignalR.</summary>
public sealed record MessageReceivedDto(Guid SubscriptionId, string Exchange, string RoutingKey, string Payload);
