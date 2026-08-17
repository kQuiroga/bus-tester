using System.Net;
using System.Net.Http.Json;
using BusTester.Api.Tests.Testing;
using BusTester.Domain.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace BusTester.Api.Tests.Controllers;

public class MessagesControllerTests
{
    [Fact]
    public async Task Send_WithValidRequest_Returns200_AndBusPortReceivesMessage()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new { exchange = "orders", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sent = Assert.Single(factory.BusPort.SentMessages);
        Assert.Equal("orders", sent.Exchange);
        Assert.Equal("{\"id\":1}", sent.Payload);
    }

    [Fact]
    public async Task Send_WithNoActiveConnection_Returns503_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        factory.BusPort.SendException = new BusConnectionException("No active RabbitMQ connection. Call ConnectAsync first.");
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new { exchange = "orders", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(503, problem!.Status);
    }

    [Fact]
    public async Task Send_WhenExchangeDoesNotExistOnBroker_Returns400_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        factory.BusPort.SendException = new BusPublishException("Exchange 'missing' not found.");
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new { exchange = "missing", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(400, problem!.Status);
    }

    [Fact]
    public async Task Send_WithEmptyExchange_Returns400_AsProblemJson_AndNeverReachesBusPort()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new { exchange = "", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Empty(factory.BusPort.SentMessages);
    }
}
