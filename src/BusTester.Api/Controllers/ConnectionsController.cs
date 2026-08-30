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
        var config = BuildConfig(request);
        await _busPort.ConnectAsync(config, ct);
        return NoContent();
    }

    private static BusConnectionConfig BuildConfig(ConnectRequest request)
    {
        if (request.Servers is { Count: > 0 } servers)
        {
            var endpoints = servers
                .Select(server => new BrokerServer(server.Host, server.Port))
                .ToArray();
            return new BusConnectionConfig(endpoints, request.Username, request.Password);
        }

        // Legacy single-endpoint body: { host, port, username, password }.
        return new BusConnectionConfig(request.Host!, request.Port ?? 0, request.Username!, request.Password!);
    }

    [HttpDelete]
    public async Task<IActionResult> Disconnect(CancellationToken ct)
    {
        await _busPort.DisconnectAsync(ct);
        return NoContent();
    }
}

/// <summary>
/// Accepts both the neutral multi-server shape (<c>servers: [{ host, port }]</c> with optional
/// <c>username</c>/<c>password</c>) and the legacy single-endpoint shape
/// (<c>{ host, port, username, password }</c>). When <c>servers</c> is present and non-empty it
/// wins; otherwise the legacy fields are used. No field is newly required.
/// </summary>
public sealed record ConnectRequest(
    string? Host,
    int? Port,
    string? Username,
    string? Password,
    IReadOnlyList<ConnectServer>? Servers);

public sealed record ConnectServer(string Host, int Port);
