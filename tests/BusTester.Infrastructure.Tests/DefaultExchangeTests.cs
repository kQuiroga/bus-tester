using System.Text;
using BusTester.Domain;
using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;
using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// Integration tests (Testcontainers, Docker required) pinning the AMQP default-exchange
/// behaviour the reply flow depends on: the broker refuses a passive declare of the default
/// exchange, so <see cref="RabbitMqAdapter.SendAsync"/> must skip that round trip when
/// <see cref="BusMessage.Exchange"/> is empty and still route by queue name.
/// </summary>
[Collection(nameof(RabbitMqCollection))]
public class DefaultExchangeTests : IAsyncLifetime
{
    private readonly RabbitMqContainerFixture _fixture;
    private RabbitMqAdapter _adapter = null!;
    private IConnection _setupConnection = null!;
    private IChannel _setupChannel = null!;

    public DefaultExchangeTests(RabbitMqContainerFixture fixture)
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
    public async Task ExchangeDeclarePassiveAsync_ForDefaultExchange_ThrowsAccessRefused()
    {
        await using var channel = await _setupConnection.CreateChannelAsync();

        var ex = await Assert.ThrowsAsync<OperationInterruptedException>(
            () => channel.ExchangeDeclarePassiveAsync(string.Empty));

        Assert.Contains("ACCESS_REFUSED", ex.Message);
    }

    [Fact]
    public async Task SendAsync_WithEmptyExchange_RoutesByQueueName_AndPreservesCorrelationId()
    {
        var queue = $"bustester-default-{Guid.NewGuid():N}";
        await _setupChannel.QueueDeclareAsync(queue, durable: false, exclusive: false, autoDelete: true);

        await _adapter.SendAsync(new BusMessage(
            exchange: string.Empty,
            routingKey: queue,
            payload: "{\"reply\":true}",
            correlationId: "corr-default-123"));

        var result = await WaitForDeliveryAsync(queue);
        Assert.Equal("{\"reply\":true}", Encoding.UTF8.GetString(result.Body.Span));
        Assert.Equal("corr-default-123", result.BasicProperties.CorrelationId);
    }

    private async Task<BasicGetResult> WaitForDeliveryAsync(string queue)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            var result = await _setupChannel.BasicGetAsync(queue, autoAck: true);
            if (result is not null)
            {
                return result;
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"No message received on queue '{queue}' within timeout.");
    }
}
