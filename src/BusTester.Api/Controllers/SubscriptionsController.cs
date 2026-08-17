using BusTester.Application.UseCases;
using BusTester.Domain;
using Microsoft.AspNetCore.Mvc;

namespace BusTester.Api.Controllers;

/// <summary>Starts/stops a queue subscription (message-consumption spec).</summary>
[ApiController]
[Route("api/subscriptions")]
public sealed class SubscriptionsController : ControllerBase
{
    private readonly SubscribeUseCase _subscribeUseCase;
    private readonly UnsubscribeUseCase _unsubscribeUseCase;

    public SubscriptionsController(SubscribeUseCase subscribeUseCase, UnsubscribeUseCase unsubscribeUseCase)
    {
        _subscribeUseCase = subscribeUseCase;
        _unsubscribeUseCase = unsubscribeUseCase;
    }

    [HttpPost]
    public async Task<ActionResult<SubscriptionResponse>> Subscribe([FromBody] SubscribeRequest request, CancellationToken ct)
    {
        var handle = await _subscribeUseCase.HandleAsync(new SubscribeCommand(request.QueueName), ct);
        return Ok(new SubscriptionResponse(handle.Value));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Unsubscribe(Guid id, CancellationToken ct)
    {
        await _unsubscribeUseCase.HandleAsync(new SubscriptionHandle(id), ct);
        return NoContent();
    }
}

public sealed record SubscribeRequest(string QueueName);

public sealed record SubscriptionResponse(Guid Id);
