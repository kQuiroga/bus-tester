using Microsoft.AspNetCore.SignalR;

namespace BusTester.Infrastructure;

/// <summary>
/// SignalR hub the Angular client connects to at <c>/hubs/bus</c>. Clients join a group per
/// subscription id so a push only reaches UI instances actually watching that subscription.
/// </summary>
public sealed class BusHub : Hub
{
    public Task JoinSubscription(Guid subscriptionId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupName(subscriptionId));

    public Task LeaveSubscription(Guid subscriptionId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(subscriptionId));

    public static string GroupName(Guid subscriptionId) => $"subscription-{subscriptionId}";
}
