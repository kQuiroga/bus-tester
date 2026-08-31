using System.Net;
using System.Net.Http.Json;
using BusTester.Api.Tests.Testing;
using BusTester.Domain.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace BusTester.Api.Tests.Controllers;

public class ConnectionsControllerTests
{
    [Fact]
    public async Task Connect_WithValidRequest_Returns204_AndBusPortReceivesConfig()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new { host = "broker.local", port = 5672, username = "guest", password = "guest" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.NotNull(factory.BusPort.ConnectedConfig);
        Assert.Equal("broker.local", factory.BusPort.ConnectedConfig!.Host);
        Assert.Equal(5672, factory.BusPort.ConnectedConfig.Port);
    }

    [Fact]
    public async Task Connect_WhenBrokerUnreachable_Returns503_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        factory.BusPort.ConnectException = new BusConnectionException("Could not connect to RabbitMQ at unreachable:5672.");
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new { host = "unreachable", port = 5672, username = "guest", password = "guest" });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(503, problem!.Status);
    }

    [Fact]
    public async Task Connect_WithEmptyHost_Returns400_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new { host = "", port = 5672, username = "guest", password = "guest" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Null(factory.BusPort.ConnectedConfig);
    }

    [Fact]
    public async Task Connect_WithServerListAndNoCredentials_Returns204_AndConfigHasServersAndNullCredentials()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new { servers = new[] { new { host = "broker.local", port = 5672 } } });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.NotNull(factory.BusPort.ConnectedConfig);
        Assert.Single(factory.BusPort.ConnectedConfig!.Servers);
        Assert.Equal("broker.local", factory.BusPort.ConnectedConfig.Host);
        Assert.Equal(5672, factory.BusPort.ConnectedConfig.Port);
        Assert.Null(factory.BusPort.ConnectedConfig.Username);
        Assert.Null(factory.BusPort.ConnectedConfig.Password);
    }

    [Fact]
    public async Task Connect_WithMultipleServersAndCredentials_Returns204_AndConfigCarriesAllServers()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new
            {
                servers = new[]
                {
                    new { host = "node-a", port = 5672 },
                    new { host = "node-b", port = 5673 },
                },
                username = "app",
                password = "s3cret",
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.NotNull(factory.BusPort.ConnectedConfig);
        Assert.Equal(2, factory.BusPort.ConnectedConfig!.Servers.Count);
        Assert.Equal("node-b", factory.BusPort.ConnectedConfig.Servers[1].Host);
        Assert.Equal(5673, factory.BusPort.ConnectedConfig.Servers[1].Port);
        Assert.Equal("app", factory.BusPort.ConnectedConfig.Username);
        Assert.Equal("s3cret", factory.BusPort.ConnectedConfig.Password);
    }

    [Fact]
    public async Task Connect_WithServerListAndUsernameButNoPassword_Returns400_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new
            {
                servers = new[] { new { host = "broker.local", port = 5672 } },
                username = "app",
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Null(factory.BusPort.ConnectedConfig);
    }

    [Fact]
    public async Task Connect_WithLegacyBodyShape_StillReturns204()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/connections",
            new { host = "broker.local", port = 5672, username = "guest", password = "guest" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.NotNull(factory.BusPort.ConnectedConfig);
        Assert.Equal("broker.local", factory.BusPort.ConnectedConfig!.Host);
        Assert.Equal("guest", factory.BusPort.ConnectedConfig.Username);
    }

    [Fact]
    public async Task Disconnect_Returns204_AndBusPortIsDisconnected()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();
        await client.PostAsJsonAsync(
            "/api/connections",
            new { host = "broker.local", port = 5672, username = "guest", password = "guest" });

        var response = await client.DeleteAsync("/api/connections");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(factory.BusPort.ConnectedConfig);
    }
}
