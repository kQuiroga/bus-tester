using BusTester.Application.Ports;
using BusTester.Domain;
using Microsoft.AspNetCore.Mvc;

namespace BusTester.Api.Controllers;

/// <summary>Establishes/tears down the session-only broker connection (bus-connection spec).</summary>
[ApiController]
[Route("api/connections")]
public sealed class ConnectionsController : ControllerBase
{
    private readonly IBusPort _busPort;

    public ConnectionsController(IBusPort busPort)
    {
        _busPort = busPort;
    }

    [HttpPost]
    public async Task<IActionResult> Connect([FromBody] ConnectRequest request, CancellationToken ct)
    {
        var config = new BusConnectionConfig(request.Host, request.Port, request.Username, request.Password);
        await _busPort.ConnectAsync(config, ct);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> Disconnect(CancellationToken ct)
    {
        await _busPort.DisconnectAsync(ct);
        return NoContent();
    }
}

public sealed record ConnectRequest(string Host, int Port, string Username, string Password);
