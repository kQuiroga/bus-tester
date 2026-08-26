using BusTester.Application.Tests.Fakes;
using BusTester.Application.UseCases;
using BusTester.Domain.Exceptions;
using Xunit;

namespace BusTester.Application.Tests.UseCases;

public class SendMessageUseCaseTests
{
    [Fact]
    public async Task HandleAsync_WithValidCommand_PublishesViaBusPort()
    {
        var fakeBusPort = new FakeBusPort();
        var useCase = new SendMessageUseCase(fakeBusPort);
        var command = new SendMessageCommand("orders", "orders.created", "{\"id\":1}");

        await useCase.HandleAsync(command);

        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Equal("orders", published.Exchange);
        Assert.Equal("orders.created", published.RoutingKey);
        Assert.Equal("{\"id\":1}", published.Payload);
    }

    [Fact]
    public async Task HandleAsync_WhenExchangeDoesNotExist_ThrowsBusPublishException_AndConnectionStaysUsable()
    {
        var fakeBusPort = new FakeBusPort { SendException = new BusPublishException("Exchange 'missing' not found.") };
        var useCase = new SendMessageUseCase(fakeBusPort);
        var command = new SendMessageCommand("missing", "orders.created", "{\"id\":1}");

        await Assert.ThrowsAsync<BusPublishException>(() => useCase.HandleAsync(command));

        Assert.Empty(fakeBusPort.SentMessages);

        fakeBusPort.SendException = null;
        await useCase.HandleAsync(new SendMessageCommand("orders", "orders.created", "{\"id\":1}"));
        Assert.Single(fakeBusPort.SentMessages);
    }

    [Fact]
    public async Task HandleAsync_WithReplyToAndCorrelationId_PublishesThemViaBusPort()
    {
        var fakeBusPort = new FakeBusPort();
        var useCase = new SendMessageUseCase(fakeBusPort);
        var command = new SendMessageCommand(
            "orders",
            "orders.created",
            "{\"id\":1}",
            ReplyTo: "orders.reply",
            CorrelationId: "corr-123");

        await useCase.HandleAsync(command);

        var published = Assert.Single(fakeBusPort.SentMessages);
        Assert.Equal("orders.reply", published.ReplyTo);
        Assert.Equal("corr-123", published.CorrelationId);
    }

    [Fact]
    public async Task HandleAsync_WhenNoActiveConnection_ThrowsBusConnectionException()
    {
        var fakeBusPort = new FakeBusPort { SendException = new BusConnectionException("No active connection.") };
        var useCase = new SendMessageUseCase(fakeBusPort);
        var command = new SendMessageCommand("orders", "orders.created", "{\"id\":1}");

        await Assert.ThrowsAsync<BusConnectionException>(() => useCase.HandleAsync(command));
    }
}
