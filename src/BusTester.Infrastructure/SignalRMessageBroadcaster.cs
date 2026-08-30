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
            MessageReceivedDto.FromDomain(handle.Value, message),
            ct);
}

/// <summary>
/// Shape pushed to the Angular client over SignalR. This is the byte-compatible wire seam for the
/// broker-neutral received model: the payload keeps its existing field names
/// (<c>subscriptionId</c>, <c>exchange</c>, <c>routingKey</c>, <c>payload</c>, <c>replyTo</c>,
/// <c>correlationId</c>). The neutral <see cref="BusMessage.Target"/> maps to <c>exchange</c> and
/// the optional <see cref="BusMessage.RoutingKey"/> maps to <c>routingKey</c> (empty string when
/// absent) so the untouched client keeps working.
/// </summary>
public sealed record MessageReceivedDto(
    Guid SubscriptionId,
    string Exchange,
    string RoutingKey,
    string Payload,
    string? ReplyTo = null,
    string? CorrelationId = null)
{
    /// <summary>Maps a broker-neutral <see cref="BusMessage"/> onto the byte-compatible SignalR payload.</summary>
    public static MessageReceivedDto FromDomain(Guid subscriptionId, BusMessage message) =>
        new(
            subscriptionId,
            message.Target,
            message.RoutingKey ?? string.Empty,
            message.Payload,
            message.ReplyTo,
            message.CorrelationId);
}
