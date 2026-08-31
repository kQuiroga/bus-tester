using BusTester.Application.Ports;
using BusTester.Domain;

namespace BusTester.Api.Tests.Testing;

/// <summary>
/// In-memory <see cref="IBusPort"/> test double swapped in for <c>RabbitMqAdapter</c> via DI so
/// controller integration tests run without a live broker and can force specific failure modes.
/// </summary>
public sealed class StubBusPort : IBusPort
{
    /// <summary>
    /// Defaults to the RabbitMQ descriptor so capability-agnostic controller tests are unaffected;
    /// individual tests override it to exercise capability gates.
    /// </summary>
    public BrokerCapabilities Capabilities { get; set; } = new("RabbitMQ", SupportsRequestReply: true);

    public BusConnectionConfig? ConnectedConfig { get; private set; }

    public List<BusMessage> SentMessages { get; } = [];

    public List<SubscriptionRequest> SubscribedRequests { get; } = [];

    public List<SubscriptionHandle> UnsubscribedHandles { get; } = [];

    public Exception? ConnectException { get; set; }

    public Exception? SendException { get; set; }

    public Exception? SubscribeException { get; set; }

    public int DeclareTemporaryReplyQueueCallCount { get; private set; }

    public string NextTemporaryQueueName { get; set; } = "amq.gen-stub-reply-queue";

    public Exception? DeclareTemporaryReplyQueueException { get; set; }

    public Task ConnectAsync(BusConnectionConfig config, CancellationToken ct = default)
    {
        if (ConnectException is not null)
        {
            throw ConnectException;
        }

        ConnectedConfig = config;
        return Task.CompletedTask;
    }

    public Task DisconnectAsync(CancellationToken ct = default)
    {
        ConnectedConfig = null;
        return Task.CompletedTask;
    }

    public Task SendAsync(BusMessage message, CancellationToken ct = default)
    {
        if (SendException is not null)
        {
            throw SendException;
        }

        SentMessages.Add(message);
        return Task.CompletedTask;
    }

    public Task<SubscriptionHandle> SubscribeAsync(
        SubscriptionRequest request,
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct = default)
    {
        if (SubscribeException is not null)
        {
            throw SubscribeException;
        }

        SubscribedRequests.Add(request);
        return Task.FromResult(new SubscriptionHandle(Guid.NewGuid()));
    }

    public Task<(SubscriptionHandle Handle, string QueueName)> DeclareTemporaryReplyQueueAndSubscribeAsync(
        Func<BusMessage, CancellationToken, Task> onMessage,
        CancellationToken ct = default)
    {
        if (DeclareTemporaryReplyQueueException is not null)
        {
            throw DeclareTemporaryReplyQueueException;
        }

        DeclareTemporaryReplyQueueCallCount++;
        return Task.FromResult((new SubscriptionHandle(Guid.NewGuid()), NextTemporaryQueueName));
    }

    public Task UnsubscribeAsync(SubscriptionHandle handle, CancellationToken ct = default)
    {
        UnsubscribedHandles.Add(handle);
        return Task.CompletedTask;
    }
}
