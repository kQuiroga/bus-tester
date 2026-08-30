using BusTester.Application.UseCases;
using Microsoft.AspNetCore.Mvc;

namespace BusTester.Api.Controllers;

/// <summary>
/// Exposes the registered adapter's broker capabilities (bus-connection spec). Read-only and
/// side-effect free: it answers at any time regardless of connection state.
/// </summary>
[ApiController]
[Route("api/capabilities")]
public sealed class CapabilitiesController : ControllerBase
{
    private readonly GetBrokerCapabilitiesUseCase _getBrokerCapabilitiesUseCase;

    public CapabilitiesController(GetBrokerCapabilitiesUseCase getBrokerCapabilitiesUseCase)
    {
        _getBrokerCapabilitiesUseCase = getBrokerCapabilitiesUseCase;
    }

    [HttpGet]
    public ActionResult<BrokerCapabilitiesResponse> Get()
    {
        var capabilities = _getBrokerCapabilitiesUseCase.Handle();
        return Ok(new BrokerCapabilitiesResponse(capabilities.BrokerName, capabilities.SupportsRequestReply));
    }
}

public sealed record BrokerCapabilitiesResponse(string BrokerName, bool SupportsRequestReply);
