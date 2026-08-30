using BusTester.Application.Ports;
using BusTester.Application.Subscriptions;
using BusTester.Domain;

namespace BusTester.Application.UseCases;

/// <summary>
/// Result of <see cref="SendMessageWithReplyUseCase"/>: the reply subscription identifier and the
/// (possibly server-generated) correlation id the caller should match replies against.
/// </summary>
public sealed record SendWithReplyResult(SubscriptionHandle SubscriptionId, string CorrelationId);

/// <summary>
/// Declares and auto-subscribes to a temporary reply queue, then publishes the message with
/// <c>ReplyTo</c> set to that queue and a <c>CorrelationId</c> (generated server-side when the
/// caller leaves it blank). Subscribes before sending (race-safe, mirrors
/// <see cref="SubscribeUseCase"/>'s null-handle-closure pattern) and, if <c>SendAsync</c> throws,
/// unsubscribes and unregisters the just-created handle before rethrowing — no orphaned temp
/// queue is left registered for a message that was never published.
/// </summary>
public sealed class SendMessageWithReplyUseCase
{
    private readonly IBusPort _busPort;
    private readonly SubscriptionCoordinator _coordinator;

    public SendMessageWithReplyUseCase(IBusPort busPort, SubscriptionCoordinator coordinator)
    {
        _busPort = busPort;
        _coordinator = coordinator;
    }

    public async Task<SendWithReplyResult> HandleAsync(SendMessageWithReplyCommand command, CancellationToken ct = default)
    {
        SubscriptionHandle? handle = null;

        Task OnMessage(BusMessage message, CancellationToken messageCt) =>
            handle is null
                ? Task.CompletedTask
                : _coordinator.OnMessageReceivedAsync(handle.Value, message, messageCt);

        var (registeredHandle, queueName) = await _busPort.DeclareTemporaryReplyQueueAndSubscribeAsync(OnMessage, ct);
        handle = registeredHandle;
        _coordinator.Register(registeredHandle);

        var correlationId = string.IsNullOrWhiteSpace(command.CorrelationId)
            ? Guid.NewGuid().ToString()
            : command.CorrelationId;

        var message = new BusMessage(command.Target, command.RoutingKey, command.Payload, queueName, correlationId, command.Headers);

        try
        {
            await _busPort.SendAsync(message, ct);
        }
        catch
        {
            await _busPort.UnsubscribeAsync(registeredHandle, ct);
            _coordinator.Unregister(registeredHandle);
            throw;
        }

        return new SendWithReplyResult(registeredHandle, correlationId);
    }
}
