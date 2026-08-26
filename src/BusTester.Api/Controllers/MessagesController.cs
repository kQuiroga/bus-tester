using BusTester.Application.UseCases;
using Microsoft.AspNetCore.Mvc;

namespace BusTester.Api.Controllers;

/// <summary>Publishes a message on the active connection (message-sending spec).</summary>
[ApiController]
[Route("api/messages")]
public sealed class MessagesController : ControllerBase
{
    private readonly SendMessageUseCase _sendMessageUseCase;
    private readonly SendMessageWithReplyUseCase _sendMessageWithReplyUseCase;

    public MessagesController(
        SendMessageUseCase sendMessageUseCase,
        SendMessageWithReplyUseCase sendMessageWithReplyUseCase)
    {
        _sendMessageUseCase = sendMessageUseCase;
        _sendMessageWithReplyUseCase = sendMessageWithReplyUseCase;
    }

    [HttpPost]
    public async Task<IActionResult> Send([FromBody] SendMessageRequest request, CancellationToken ct)
    {
        var command = new SendMessageCommand(
            request.Exchange,
            request.RoutingKey,
            request.Payload,
            request.ReplyTo,
            request.CorrelationId);
        await _sendMessageUseCase.HandleAsync(command, ct);
        return Ok();
    }

    [HttpPost("with-reply")]
    public async Task<ActionResult<SendWithReplyResponse>> SendWithReply(
        [FromBody] SendMessageWithReplyRequest request,
        CancellationToken ct)
    {
        var command = new SendMessageWithReplyCommand(
            request.Exchange,
            request.RoutingKey,
            request.Payload,
            request.CorrelationId);
        var result = await _sendMessageWithReplyUseCase.HandleAsync(command, ct);
        return Ok(new SendWithReplyResponse(result.SubscriptionId.Value, result.CorrelationId));
    }
}

public sealed record SendMessageRequest(
    string Exchange,
    string RoutingKey,
    string Payload,
    string? ReplyTo = null,
    string? CorrelationId = null);

public sealed record SendMessageWithReplyRequest(
    string Exchange,
    string RoutingKey,
    string Payload,
    string? CorrelationId = null);

public sealed record SendWithReplyResponse(Guid SubscriptionId, string CorrelationId);
