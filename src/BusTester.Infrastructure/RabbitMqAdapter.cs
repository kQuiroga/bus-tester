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

    /// <summary>
    /// RabbitMQ statically supports the full request-reply flow (temporary exclusive/auto-delete
    /// reply queues). This is a constant client fact and needs no connection.
    /// </summary>
    public BrokerCapabilities Capabilities { get; } = new("RabbitMQ", SupportsRequestReply: true);

    /// <summary>Test hook: the adapter's current live connection, or null when disconnected.</summary>
    internal IConnection? CurrentConnection => _connection;

    /// <summary>Test hook: snapshot of the channels backing the adapter's live subscriptions.</summary>
    internal IReadOnlyCollection<IChannel> SubscriptionChannels => _subscriptionChannels.Values.ToArray();

    public async Task ConnectAsync(BusConnectionConfig config, CancellationToken ct = default)
    {
        // Issue #34: a reconnect while already connected must release the prior connection and
        // every live subscription channel first so no orphaned AMQP resource survives. Existing
        // subscriptions are intentionally lost across a reconnect (documented behaviour).
        await TeardownAsync(ct);

        var server = config.Servers[0];
        var factory = new ConnectionFactory
        {
            HostName = server.Host,
            Port = server.Port,
        };

        if (config.Username is not null)
        {
            factory.UserName = config.Username;
        }

        if (config.Password is not null)
        {
            factory.Password = config.Password;
        }

        try
        {
            _connection = await factory.CreateConnectionAsync(ct);
        }
        catch (Exception ex) when (ex is BrokerUnreachableException or SocketException or TimeoutException)
        {
            throw new BusConnectionException($"Could not connect to RabbitMQ at {server.Host}:{server.Port}.", ex);
        }
    }

    public Task DisconnectAsync(CancellationToken ct = default) => TeardownAsync(ct);

    /// <summary>
    /// Closes and disposes every live subscription channel and the connection itself, then nulls
    /// them. Idempotent: safe to call with nothing connected. Shared by <see cref="ConnectAsync"/>
    /// (reconnect), <see cref="DisconnectAsync"/>, and <see cref="DisposeAsync"/>.
    /// </summary>
    private async Task TeardownAsync(CancellationToken ct)
    {
        await _subscriptionsLock.WaitAsync(ct);
        try
        {
            foreach (var channel in _subscriptionChannels.Values)
            {
                if (channel.IsOpen)
                {
                    await channel.CloseAsync(ct);
                }

                await channel.DisposeAsync();
            }

            _subscriptionChannels.Clear();
        }
        finally
        {
            _subscriptionsLock.Release();
        }

        if (_connection is null)
        {
            return;
        }

        if (_connection.IsOpen)
        {
            await _connection.CloseAsync(ct);
        }

        await _connection.DisposeAsync();
        _connection = null;
    }

    public async Task SendAsync(BusMessage message, CancellationToken ct = default)
    {
        // BusMessage is broker-neutral and allows a null/blank routing key, but RabbitMQ needs one
        // to route the publish. Enforce it here (the rule that used to live in the domain type).
        if (string.IsNullOrWhiteSpace(message.RoutingKey))
        {
            throw new ArgumentException("RabbitMQ requires a non-blank routing key.", nameof(message));
        }

        var routingKey = message.RoutingKey;
        var connection = RequireConnection();

        try
        {
            await using var channel = await connection.CreateChannelAsync(cancellationToken: ct);

            // basic.publish has no synchronous ack, so a missing exchange would otherwise only
            // surface as an async channel close after this call already returned. A passive
            // declare forces a synchronous round trip that fails fast while the channel — scoped
            // to this single send — is still open, leaving the connection itself unaffected.
            // The AMQP default exchange ("") cannot be declared passively (the broker replies
            // ACCESS_REFUSED), and it always exists, so skip the check in that case.
            if (message.Target.Length != 0)
            {
                await channel.ExchangeDeclarePassiveAsync(message.Target, ct);
            }

            var body = Encoding.UTF8.GetBytes(message.Payload);

            if (message.ReplyTo is not null || message.CorrelationId is not null || message.Headers.Count > 0)
            {
                var properties = new BasicProperties
                {
                    ReplyTo = message.ReplyTo,
                    CorrelationId = message.CorrelationId,
                };

                if (message.Headers.Count > 0)
                {
                    properties.Headers = message.Headers.ToDictionary(
                        kv => kv.Key,
                        kv => (object?)kv.Value);
                }

                await channel.BasicPublishAsync(
                    message.Target,
                    routingKey,
                    mandatory: false,
                    properties,
                    body,
                    ct);
            }
            else
            {
                await channel.BasicPublishAsync(message.Target, routingKey, body, ct);
            }
        }
        catch (OperationInterruptedException ex)
        {
            throw new BusPublishException($"Could not publish to exchange '{message.Target}'.", ex);
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
        try
        {
            await TeardownAsync(CancellationToken.None);
        }
        catch
        {
            // Dispose must not throw: a broker-side drop during teardown is not actionable here.
        }
    }

    private IConnection RequireConnection() =>
        _connection ?? throw new BusConnectionException("No active RabbitMQ connection. Call ConnectAsync first.");
}
