using BusTester.Application.Subscriptions;
using BusTester.Application.Tests.Fakes;
using BusTester.Application.UseCases;
using BusTester.Domain;
using BusTester.Domain.Exceptions;
using Xunit;

namespace BusTester.Application.Tests.UseCases;

public class SubscribeUseCaseTests
{
    [Fact]
    public async Task HandleAsync_WithValidQueue_ReturnsHandle_AndRegistersSubscription()
    {
        var fakeBusPort = new FakeBusPort();
        var coordinator = new SubscriptionCoordinator();
        var useCase = new SubscribeUseCase(fakeBusPort, coordinator);
        var command = new SubscribeCommand("orders-queue");

        var handle = await useCase.HandleAsync(command);

        var subscribed = Assert.Single(fakeBusPort.SubscribedRequests);
        Assert.Equal("orders-queue", subscribed.QueueName);
        Assert.NotEqual(default, handle.Value);
        Assert.Empty(coordinator.GetMessages(handle));
    }

    [Fact]
    public async Task HandleAsync_DeliveredMessage_IsAppendedToCoordinatorForThatHandle()
    {
        var fakeBusPort = new FakeBusPort();
        var coordinator = new SubscriptionCoordinator();
        var useCase = new SubscribeUseCase(fakeBusPort, coordinator);

        var handle = await useCase.HandleAsync(new SubscribeCommand("orders-queue"));
        var delivered = new BusMessage("orders", "orders.created", "{\"id\":1}");
        await fakeBusPort.LastOnMessage!.Invoke(delivered, CancellationToken.None);

        var messages = coordinator.GetMessages(handle);
        var message = Assert.Single(messages);
        Assert.Equal("{\"id\":1}", message.Payload);
    }

    [Fact]
    public async Task HandleAsync_WhenQueueDoesNotExist_ThrowsBusSubscriptionException_AndNoSubscriptionStarted()
    {
        var fakeBusPort = new FakeBusPort
        {
            SubscribeException = new BusSubscriptionException("Queue 'missing' not found."),
        };
        var coordinator = new SubscriptionCoordinator();
        var useCase = new SubscribeUseCase(fakeBusPort, coordinator);
        var command = new SubscribeCommand("missing");

        await Assert.ThrowsAsync<BusSubscriptionException>(() => useCase.HandleAsync(command));

        Assert.Empty(fakeBusPort.SubscribedRequests);
    }
}
