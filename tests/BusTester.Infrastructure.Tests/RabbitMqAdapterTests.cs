using System.Text;
using BusTester.Application.Ports;
using BusTester.Domain;
using BusTester.Domain.Exceptions;
using RabbitMQ.Client;
using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// Integration tests against a live RabbitMQ broker (Testcontainers, Docker required). Each test
/// declares its own throwaway exchange/queue pair so tests never interfere with each other.
/// </summary>
[Collection(nameof(RabbitMqCollection))]
public class RabbitMqAdapterTests : IAsyncLifetime
{
    private readonly RabbitMqContainerFixture _fixture;
    private RabbitMqAdapter _adapter = null!;
    private IConnection _setupConnection = null!;
    private IChannel _setupChannel = null!;

    public RabbitMqAdapterTests(RabbitMqContainerFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        _adapter = new RabbitMqAdapter();
        await _adapter.ConnectAsync(_fixture.Config);

        var config = _fixture.Config;
        var factory = new ConnectionFactory
        {
            HostName = config.Host,
            Port = config.Port,
            UserName = config.Username,
            Password = config.Password,
        };
        _setupConnection = await factory.CreateConnectionAsync();
        _setupChannel = await _setupConnection.CreateChannelAsync();
    }

    public async Task DisposeAsync()
    {
        await _adapter.DisposeAsync();
        await _setupChannel.CloseAsync();
        await _setupConnection.CloseAsync();
    }

    [Fact]
    public async Task ConnectAsync_WithUnreachableHost_ThrowsBusConnectionException_WithinBoundedTimeout()
    {
        var unreachable = new BusConnectionConfig("127.0.0.1", 59999, "guest", "guest");
        await using var adapter = new RabbitMqAdapter();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        await Assert.ThrowsAsync<BusConnectionException>(() => adapter.ConnectAsync(unreachable, cts.Token));
    }

    [Fact]
    public async Task SendAsync_PublishesMessage_ConsumerReceivesIt()
    {
        var (exchange, queue) = await DeclareTopologyAsync();

        await _adapter.SendAsync(new BusMessage(exchange, queue, "{\"id\":1}"));

        Assert.Equal("{\"id\":1}", await WaitForMessageAsync(queue));
    }

    [Fact]
    public async Task SendAsync_WhenExchangeDoesNotExist_ThrowsBusPublishException_AndConnectionStaysUsable()
    {
        await Assert.ThrowsAsync<BusPublishException>(
            () => _adapter.SendAsync(new BusMessage("missing-exchange", "rk", "payload")));

        var (exchange, queue) = await DeclareTopologyAsync();
        await _adapter.SendAsync(new BusMessage(exchange, queue, "still-usable"));
        Assert.Equal("still-usable", await WaitForMessageAsync(queue));
    }

    [Fact]
    public async Task SubscribeAsync_DeliveredMessage_InvokesCallback()
    {
        var (exchange, queue) = await DeclareTopologyAsync();
        var received = new TaskCompletionSource<BusMessage>(TaskCreationOptions.RunContinuationsAsynchronously);

        await _adapter.SubscribeAsync(
            new SubscriptionRequest(queue),
            (message, _) =>
            {
                received.TrySetResult(message);
                return Task.CompletedTask;
            });

        await _adapter.SendAsync(new BusMessage(exchange, queue, "{\"id\":2}"));

        var completed = await Task.WhenAny(received.Task, Task.Delay(TimeSpan.FromSeconds(10)));
        Assert.Same(received.Task, completed);
        var message = await received.Task;
        Assert.Equal("{\"id\":2}", message.Payload);
    }

    [Fact]
    public async Task SubscribeAsync_WhenQueueDoesNotExist_ThrowsBusSubscriptionException()
    {
        await Assert.ThrowsAsync<BusSubscriptionException>(
            () => _adapter.SubscribeAsync(new SubscriptionRequest("missing-queue"), (_, _) => Task.CompletedTask));
    }

    private async Task<(string Exchange, string Queue)> DeclareTopologyAsync()
    {
        var name = $"bustester-{Guid.NewGuid():N}";
        await _setupChannel.ExchangeDeclareAsync(name, ExchangeType.Direct);
        await _setupChannel.QueueDeclareAsync(name, durable: false, exclusive: false, autoDelete: true);
        await _setupChannel.QueueBindAsync(name, name, name);
        return (name, name);
    }

    private async Task<string> WaitForMessageAsync(string queue)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            var result = await _setupChannel.BasicGetAsync(queue, autoAck: true);
            if (result is not null)
            {
                return Encoding.UTF8.GetString(result.Body.Span);
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"No message received on queue '{queue}' within timeout.");
    }
}
