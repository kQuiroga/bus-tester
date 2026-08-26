using BusTester.Application.Ports;
using BusTester.Domain;

namespace BusTester.Application.Tests.Fakes;

/// <summary>
/// In-memory <see cref="IBusPort"/> test double used to drive use cases without a live broker.
/// Configure <see cref="SendException"/>/<see cref="SubscribeException"/> to simulate broker
/// rejections and inspect <see cref="SentMessages"/>/<see cref="SubscribedRequests"/> afterwards.
/// </summary>
public sealed class FakeBusPort : IBusPort
{
    public List<BusMessage> SentMessages { get; } = [];

    public List<SubscriptionRequest> SubscribedRequests { get; } = [];

    public Exception? SendException { get; set; }

    public Exception? SubscribeException { get; set; }

    public Func<BusMessage, CancellationToken, Task>? LastOnMessage { get; private set; }

    public int DeclareTemporaryReplyQueueCallCount { get; private set; }

    public string NextTemporaryQueueName { get; set; } = "amq.gen-fake-reply-queue";

    public Exception? DeclareTemporaryReplyQueueException { get; set; }

    public Task ConnectAsync(BusConnectionConfig config, CancellationToken ct = default) => Task.CompletedTask;

    public Task DisconnectAsync(CancellationToken ct = default) => Task.CompletedTask;

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
        LastOnMessage = onMessage;
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
        LastOnMessage = onMessage;
        return Task.FromResult((new SubscriptionHandle(Guid.NewGuid()), NextTemporaryQueueName));
    }

    public Task UnsubscribeAsync(SubscriptionHandle handle, CancellationToken ct = default) => Task.CompletedTask;
}
