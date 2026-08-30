using BusTester.Application.Subscriptions;
using BusTester.Application.Tests.Fakes;
using BusTester.Application.UseCases;
using BusTester.Domain;
using BusTester.Domain.Exceptions;
using Xunit;

namespace BusTester.Application.Tests.UseCases;

public class SendMessageWithReplyUseCaseTests
{
    [Fact]
    public async Task HandleAsync_WhenCorrelationIdBlank_GeneratesOneServerSide_AndPublishesWithIt()
    {
        var fakeBusPort = new FakeBusPort();
        var useCase = new SendMessageWithReplyUseCase(fakeBusPort, new SubscriptionCoordinator());
        var command = new SendMessageWithReplyCommand("orders", "orders.created", "{\"id\":1}");

        var result = await useCase.HandleAsync(command);

        Assert.False(string.IsNullOrWhiteSpace(result.CorrelationId));
        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Equal(result.CorrelationId, published.CorrelationId);
    }

    [Fact]
    public async Task HandleAsync_WhenCorrelationIdSupplied_PreservesItUnchanged()
    {
        var fakeBusPort = new FakeBusPort();
        var useCase = new SendMessageWithReplyUseCase(fakeBusPort, new SubscriptionCoordinator());
        var command = new SendMessageWithReplyCommand("orders", "orders.created", "{\"id\":1}", CorrelationId: "corr-123");

        var result = await useCase.HandleAsync(command);

        Assert.Equal("corr-123", result.CorrelationId);
        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Equal("corr-123", published.CorrelationId);
    }

    [Fact]
    public async Task HandleAsync_SetsReplyToDeclaredQueueName_AndSubscribesBeforeSending()
    {
        var fakeBusPort = new FakeBusPort { NextTemporaryQueueName = "amq.gen-abc123" };
        var useCase = new SendMessageWithReplyUseCase(fakeBusPort, new SubscriptionCoordinator());
        var command = new SendMessageWithReplyCommand("orders", "orders.created", "{\"id\":1}");

        await useCase.HandleAsync(command);

        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Equal("amq.gen-abc123", published.ReplyTo);
        Assert.Equal(["Declare", "Send"], fakeBusPort.CallOrder);
    }

    [Fact]
    public async Task HandleAsync_WithHeaders_PassesThemThroughUnchangedIntoBusMessage()
    {
        var fakeBusPort = new FakeBusPort();
        var useCase = new SendMessageWithReplyUseCase(fakeBusPort, new SubscriptionCoordinator());
        var headers = new Dictionary<string, string> { ["NServiceBus.ContentType"] = "application/json", ["X-Custom"] = "abc" };
        var command = new SendMessageWithReplyCommand("orders", "orders.created", "{\"id\":1}", Headers: headers);

        await useCase.HandleAsync(command);

        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Equal(2, published.Headers.Count);
        Assert.Equal("application/json", published.Headers["NServiceBus.ContentType"]);
        Assert.Equal("abc", published.Headers["X-Custom"]);
    }

    [Fact]
    public async Task HandleAsync_WithoutHeaders_PublishesBusMessageWithEmptyHeaders()
    {
        var fakeBusPort = new FakeBusPort();
        var useCase = new SendMessageWithReplyUseCase(fakeBusPort, new SubscriptionCoordinator());
        var command = new SendMessageWithReplyCommand("orders", "orders.created", "{\"id\":1}");

        await useCase.HandleAsync(command);

        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Empty(published.Headers);
    }

    [Fact]
    public async Task HandleAsync_WhenSendFails_UnsubscribesTheJustCreatedHandle_AndRethrows()
    {
        var fakeBusPort = new FakeBusPort { SendException = new BusPublishException("Exchange 'missing' not found.") };
        var coordinator = new SubscriptionCoordinator();
        var useCase = new SendMessageWithReplyUseCase(fakeBusPort, coordinator);
        var command = new SendMessageWithReplyCommand("missing", "orders.created", "{\"id\":1}");

        await Assert.ThrowsAsync<BusPublishException>(() => useCase.HandleAsync(command));

        var unsubscribedHandle = Assert.Single(fakeBusPort.UnsubscribedHandles);
        Assert.Equal(["Declare", "Send", "Unsubscribe"], fakeBusPort.CallOrder);

        // If Unregister had NOT been called, this delivery would still land (Register happened
        // during HandleAsync) and GetMessages would return it — proving cleanup actually ran.
        await coordinator.OnMessageReceivedAsync(unsubscribedHandle, new BusMessage("orders", "orders.created", "{}"));
        Assert.Empty(coordinator.GetMessages(unsubscribedHandle));
    }
}
