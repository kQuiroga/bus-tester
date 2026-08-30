using System.Net;
using System.Net.Http.Json;
using BusTester.Api.Tests.Testing;
using Xunit;

namespace BusTester.Api.Tests.Controllers;

public class CapabilitiesControllerTests
{
    [Fact]
    public async Task Get_BeforeAnyConnect_Returns200_WithTheRegisteredAdapterDescriptor()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/capabilities");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CapabilitiesResponse>();
        Assert.Equal("RabbitMQ", body!.BrokerName);
        Assert.True(body.SupportsRequestReply);
    }

    [Fact]
    public async Task Get_IsStableAcrossConnectAndDisconnect()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var before = await (await client.GetAsync("/api/capabilities"))
            .Content.ReadFromJsonAsync<CapabilitiesResponse>();

        await client.PostAsJsonAsync(
            "/api/connections",
            new { host = "broker.local", port = 5672, username = "guest", password = "guest" });
        var whileConnected = await (await client.GetAsync("/api/capabilities"))
            .Content.ReadFromJsonAsync<CapabilitiesResponse>();

        await client.DeleteAsync("/api/connections");
        var afterDisconnect = await (await client.GetAsync("/api/capabilities"))
            .Content.ReadFromJsonAsync<CapabilitiesResponse>();

        Assert.Equal(before, whileConnected);
        Assert.Equal(before, afterDisconnect);
        Assert.Equal("RabbitMQ", before!.BrokerName);
        Assert.True(before.SupportsRequestReply);
    }

    private sealed record CapabilitiesResponse(string BrokerName, bool SupportsRequestReply);
}
