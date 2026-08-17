using BusTester.Domain;

namespace BusTester.Application.Ports;

/// <summary>
/// Broker-agnostic port hiding both push-consumer (RabbitMQ) and poll-loop (future Kafka)
/// consumption models behind a single callback-based contract. Domain and Application code
/// depend only on this interface — never on a specific broker client library.
/// </summary>
public interface IBusPort
{
    Task ConnectAsync(BusConnectionConfig config, CancellationToken ct = default);

    Task DisconnectAsync(CancellationToken ct = default);

    Task SendAsync(BusMessage message, CancellationToken ct = default);

    /// <summary>
    /// Starts consuming the requested queue and registers <paramref name="onMessage"/> to be
    /// invoked for each delivered message. Returns as soon as the adapter has started consuming
    /// (RabbitMQ: consumer registered; future Kafka: poll-loop thread launched) — never blocks
    /// waiting for the first message.
    /// </summary>
    Task<SubscriptionHandle> SubscribeAsync(
        SubscriptionRequest request,
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct = default);

    /// <summary>
    /// Cancels the adapter's internal loop/consumer for <paramref name="handle"/>, regardless of
    /// whether it originated from a push or poll consumption model.
    /// </summary>
    Task UnsubscribeAsync(SubscriptionHandle handle, CancellationToken ct = default);
}
