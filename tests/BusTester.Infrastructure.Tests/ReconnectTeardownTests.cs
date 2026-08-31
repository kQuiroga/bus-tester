using System.Text;
using BusTester.Application.Ports;
using BusTester.Domain;
using RabbitMQ.Client;
using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// Integration tests (Testcontainers, Docker required) pinning the issue #34 regression:
/// calling <see cref="RabbitMqAdapter.ConnectAsync"/> while already connected MUST tear down the
/// prior connection and every live subscription channel first, leaving no orphaned AMQP resource.
/// Subscription loss across a reconnect is the documented, expected behaviour.
/// </summary>
[Collection(nameof(RabbitMqCollection))]
public class ReconnectTeardownTests : IAsyncLifetime
{
    private readonly RabbitMqContainerFixture _fixture;
    private RabbitMqAdapter _adapter = null!;
    private IConnection _setupConnection = null!;
    private IChannel _setupChannel = null!;

    public ReconnectTeardownTests(RabbitMqContainerFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        _adapter = new RabbitMqAdapter();

        var config = _fixture.Config;
        var factory = new ConnectionFactory
        {
            HostName = config.Host,
            Port = config.Port,
            UserName = config.Username!,
            Password = config.Password!,
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
    public async Task ConnectAsync_WhenAlreadyConnectedWithLiveSubscription_TearsDownPriorConnectionAndChannels()
    {
        await _adapter.ConnectAsync(_fixture.Config);
        var (_, queue) = await DeclareTopologyAsync();
        await _adapter.SubscribeAsync(new SubscriptionRequest(queue), (_, _) => Task.CompletedTask);

        var priorConnection = _adapter.CurrentConnection;
        Assert.NotNull(priorConnection);
        Assert.True(priorConnection!.IsOpen);
        var priorChannels = _adapter.SubscriptionChannels.ToList();
        Assert.Single(priorChannels);
        Assert.All(priorChannels, channel => Assert.True(channel.IsOpen));

        await _adapter.ConnectAsync(_fixture.Config);

        Assert.False(priorConnection.IsOpen);
        Assert.All(priorChannels, channel => Assert.False(channel.IsOpen));
        Assert.Empty(_adapter.SubscriptionChannels);
        Assert.NotNull(_adapter.CurrentConnection);
        Assert.NotSame(priorConnection, _adapter.CurrentConnection);
        Assert.True(_adapter.CurrentConnection!.IsOpen);
    }

    [Fact]
    public async Task ConnectAsync_AfterReconnect_NewConnectionSendsAndReceives()
    {
        await _adapter.ConnectAsync(_fixture.Config);
        var (_, firstQueue) = await DeclareTopologyAsync();
        await _adapter.SubscribeAsync(new SubscriptionRequest(firstQueue), (_, _) => Task.CompletedTask);

        await _adapter.ConnectAsync(_fixture.Config);

        var (exchange, queue) = await DeclareTopologyAsync();
        var received = new TaskCompletionSource<BusMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        await _adapter.SubscribeAsync(
            new SubscriptionRequest(queue),
            (message, _) =>
            {
                received.TrySetResult(message);
                return Task.CompletedTask;
            });

        await _adapter.SendAsync(new BusMessage(exchange, queue, "{\"after\":\"reconnect\"}"));

        var completed = await Task.WhenAny(received.Task, Task.Delay(TimeSpan.FromSeconds(10)));
        Assert.Same(received.Task, completed);
        Assert.Equal("{\"after\":\"reconnect\"}", (await received.Task).Payload);
    }

    [Fact]
    public async Task ConnectAsync_TwiceWithoutSubscriptions_ClosesPriorConnection()
    {
        await _adapter.ConnectAsync(_fixture.Config);
        var priorConnection = _adapter.CurrentConnection;
        Assert.NotNull(priorConnection);

        await _adapter.ConnectAsync(_fixture.Config);

        Assert.False(priorConnection!.IsOpen);
        Assert.NotSame(priorConnection, _adapter.CurrentConnection);
    }

    private async Task<(string Exchange, string Queue)> DeclareTopologyAsync()
    {
        var name = $"bustester-{Guid.NewGuid():N}";
        await _setupChannel.ExchangeDeclareAsync(name, ExchangeType.Direct);
        await _setupChannel.QueueDeclareAsync(name, durable: false, exclusive: false, autoDelete: true);
        await _setupChannel.QueueBindAsync(name, name, name);
        return (name, name);
    }
}
