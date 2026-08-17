using BusTester.Application.UseCases;
using Microsoft.AspNetCore.Mvc;

namespace BusTester.Api.Controllers;

/// <summary>Publishes a message on the active connection (message-sending spec).</summary>
[ApiController]
[Route("api/messages")]
public sealed class MessagesController : ControllerBase
{
    private readonly SendMessageUseCase _sendMessageUseCase;

    public MessagesController(SendMessageUseCase sendMessageUseCase)
    {
        _sendMessageUseCase = sendMessageUseCase;
    }

    [HttpPost]
    public async Task<IActionResult> Send([FromBody] SendMessageRequest request, CancellationToken ct)
    {
        var command = new SendMessageCommand(request.Exchange, request.RoutingKey, request.Payload);
        await _sendMessageUseCase.HandleAsync(command, ct);
        return Ok();
    }
}

public sealed record SendMessageRequest(string Exchange, string RoutingKey, string Payload);
