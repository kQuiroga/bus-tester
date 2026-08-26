using System.Net.Sockets;
using System.Text;
using BusTester.Application.Ports;
using BusTester.Domain;
using BusTester.Domain.Exceptions;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RabbitMQ.Client.Exceptions;

namespace BusTester.Infrastructure;

/// <summary>
/// <see cref="IBusPort"/> implementation backed by RabbitMQ.Client v7's async API. Owns one
/// connection per adapter instance and one dedicated channel per subscription so an unsubscribe
/// only tears down its own consumer. Maps broker-level failures to the typed domain exceptions
/// the Application layer depends on.
/// </summary>
public sealed class RabbitMqAdapter : IBusPort, IAsyncDisposable
{
    private readonly Dictionary<SubscriptionHandle, IChannel> _subscriptionChannels = [];
    private readonly SemaphoreSlim _subscriptionsLock = new(1, 1);
    private IConnection? _connection;

    public async Task ConnectAsync(BusConnectionConfig config, CancellationToken ct = default)
    {
        var factory = new ConnectionFactory
        {
            HostName = config.Host,
            Port = config.Port,
            UserName = config.Username,
            Password = config.Password,
        };

        try
        {
            _connection = await factory.CreateConnectionAsync(ct);
        }
        catch (Exception ex) when (ex is BrokerUnreachableException or SocketException or TimeoutException)
        {
            throw new BusConnectionException($"Could not connect to RabbitMQ at {config.Host}:{config.Port}.", ex);
        }
    }

    public async Task DisconnectAsync(CancellationToken ct = default)
    {
        if (_connection is null)
        {
            return;
        }

        await _connection.CloseAsync(ct);
        await _connection.DisposeAsync();
        _connection = null;
    }

    public async Task SendAsync(BusMessage message, CancellationToken ct = default)
    {
        var connection = RequireConnection();

        try
        {
            await using var channel = await connection.CreateChannelAsync(cancellationToken: ct);

            // basic.publish has no synchronous ack, so a missing exchange would otherwise only
            // surface as an async channel close after this call already returned. A passive
            // declare forces a synchronous round trip that fails fast while the channel — scoped
            // to this single send — is still open, leaving the connection itself unaffected.
            await channel.ExchangeDeclarePassiveAsync(message.Exchange, ct);

            var body = Encoding.UTF8.GetBytes(message.Payload);

            if (message.ReplyTo is not null || message.CorrelationId is not null)
            {
                var properties = new BasicProperties
                {
                    ReplyTo = message.ReplyTo,
                    CorrelationId = message.CorrelationId,
                };
                await channel.BasicPublishAsync(
                    message.Exchange,
                    message.RoutingKey,
                    mandatory: false,
                    properties,
                    body,
                    ct);
            }
            else
            {
                await channel.BasicPublishAsync(message.Exchange, message.RoutingKey, body, ct);
            }
        }
        catch (OperationInterruptedException ex)
        {
            throw new BusPublishException($"Could not publish to exchange '{message.Exchange}'.", ex);
        }
    }

    public async Task<SubscriptionHandle> SubscribeAsync(
        SubscriptionRequest request,
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct = default)
    {
        var connection = RequireConnection();
        IChannel channel;

        try
        {
            channel = await connection.CreateChannelAsync(cancellationToken: ct);
            await WireConsumerAsync(channel, request.QueueName, onMessage, ct);
        }
        catch (OperationInterruptedException ex)
        {
            throw new BusSubscriptionException($"Could not subscribe to queue '{request.QueueName}'.", ex);
        }

        return await RegisterSubscriptionAsync(channel, ct);
    }

    public async Task<(SubscriptionHandle Handle, string QueueName)> DeclareTemporaryReplyQueueAndSubscribeAsync(
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct = default)
    {
        var connection = RequireConnection();
        IChannel channel;
        string queueName;

        try
        {
            channel = await connection.CreateChannelAsync(cancellationToken: ct);
            var declareOk = await channel.QueueDeclareAsync(
                queue: string.Empty,
                durable: false,
                exclusive: true,
                autoDelete: true,
                arguments: null,
                cancellationToken: ct);
            queueName = declareOk.QueueName;

            await WireConsumerAsync(channel, queueName, onMessage, ct);
        }
        catch (OperationInterruptedException ex)
        {
            throw new BusSubscriptionException("Could not declare/subscribe to a temporary reply queue.", ex);
        }

        var handle = await RegisterSubscriptionAsync(channel, ct);
        return (handle, queueName);
    }

    /// <summary>
    /// Registers an <see cref="AsyncEventingBasicConsumer"/> on <paramref name="channel"/> for
    /// <paramref name="queueName"/>, invoking <paramref name="onMessage"/> for each delivery.
    /// Shared by <see cref="SubscribeAsync"/> and
    /// <see cref="DeclareTemporaryReplyQueueAndSubscribeAsync"/> so both consumption paths wire
    /// their consumer identically.
    /// </summary>
    private static Task WireConsumerAsync(
        IChannel channel,
        string queueName,
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct)
    {
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, args) =>
        {
            var payload = Encoding.UTF8.GetString(args.Body.Span);
            var exchange = args.Exchange.Length == 0 ? "(default)" : args.Exchange;
            return onMessage(
                new BusMessage(
                    exchange,
                    args.RoutingKey,
                    payload,
                    args.BasicProperties.ReplyTo,
                    args.BasicProperties.CorrelationId),
                CancellationToken.None);
        };

        return channel.BasicConsumeAsync(queueName, autoAck: true, consumer, ct);
    }

    private async Task<SubscriptionHandle> RegisterSubscriptionAsync(IChannel channel, CancellationToken ct)
    {
        var handle = new SubscriptionHandle(Guid.NewGuid());
        await _subscriptionsLock.WaitAsync(ct);
        try
        {
            _subscriptionChannels[handle] = channel;
        }
        finally
        {
            _subscriptionsLock.Release();
        }

        return handle;
    }

    public async Task UnsubscribeAsync(SubscriptionHandle handle, CancellationToken ct = default)
    {
        IChannel? channel;
        await _subscriptionsLock.WaitAsync(ct);
        try
        {
            _subscriptionChannels.Remove(handle, out channel);
        }
        finally
        {
            _subscriptionsLock.Release();
        }

        if (channel is null)
        {
            return;
        }

        await channel.CloseAsync(ct);
        await channel.DisposeAsync();
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var channel in _subscriptionChannels.Values)
        {
            await channel.DisposeAsync();
        }

        if (_connection is not null)
        {
            await _connection.DisposeAsync();
        }
    }

    private IConnection RequireConnection() =>
        _connection ?? throw new BusConnectionException("No active RabbitMQ connection. Call ConnectAsync first.");
}
