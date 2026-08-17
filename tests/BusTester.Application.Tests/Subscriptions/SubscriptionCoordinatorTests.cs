using BusTester.Application.Subscriptions;
using BusTester.Application.Tests.Fakes;
using BusTester.Domain;
using Xunit;

namespace BusTester.Application.Tests.Subscriptions;

public class SubscriptionCoordinatorTests
{
    [Fact]
    public async Task OnMessageReceivedAsync_ForRegisteredHandle_BuffersAndBroadcastsMessage()
    {
        var broadcaster = new FakeMessageBroadcaster();
        var coordinator = new SubscriptionCoordinator(broadcaster);
        var handle = new SubscriptionHandle(Guid.NewGuid());
        coordinator.Register(handle);
        var message = new BusMessage("orders", "orders.created", "{\"id\":1}");

        await coordinator.OnMessageReceivedAsync(handle, message);

        Assert.Equal(new[] { message }, coordinator.GetMessages(handle));
        var broadcast = Assert.Single(broadcaster.Broadcasts);
        Assert.Equal(handle, broadcast.Handle);
        Assert.Same(message, broadcast.Message);
    }

    [Fact]
    public async Task OnMessageReceivedAsync_ForUnregisteredHandle_DoesNotBroadcast()
    {
        var broadcaster = new FakeMessageBroadcaster();
        var coordinator = new SubscriptionCoordinator(broadcaster);
        var handle = new SubscriptionHandle(Guid.NewGuid());

        await coordinator.OnMessageReceivedAsync(handle, new BusMessage("orders", "orders.created", "{}"));

        Assert.Empty(broadcaster.Broadcasts);
    }
}
