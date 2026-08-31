using System.Net;
using System.Net.Http.Json;
using BusTester.Api.Tests.Testing;
using BusTester.Application.Ports;
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
        Assert.Equal("orders", sent.Target);
        Assert.Equal("{\"id\":1}", sent.Payload);
    }

    [Fact]
    public async Task Send_WithReplyToAndCorrelationId_Returns200_AndBusPortReceivesBothValues()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new
            {
                exchange = "orders",
                routingKey = "orders.created",
                payload = "{\"id\":1}",
                replyTo = "orders.reply",
                correlationId = "corr-123",
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sent = Assert.Single(factory.BusPort.SentMessages);
        Assert.Equal("orders.reply", sent.ReplyTo);
        Assert.Equal("corr-123", sent.CorrelationId);
    }

    [Fact]
    public async Task Send_WithHeaders_Returns200_AndBusPortReceivesThem()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new
            {
                exchange = "orders",
                routingKey = "orders.created",
                payload = "{\"id\":1}",
                headers = new Dictionary<string, string> { ["NServiceBus.ContentType"] = "application/json", ["X-Custom"] = "abc" },
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sent = Assert.Single(factory.BusPort.SentMessages);
        Assert.Equal(2, sent.Headers.Count);
        Assert.Equal("application/json", sent.Headers["NServiceBus.ContentType"]);
        Assert.Equal("abc", sent.Headers["X-Custom"]);
    }

    [Fact]
    public async Task SendWithReply_WithHeaders_Returns200_AndBusPortReceivesThem()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages/with-reply",
            new
            {
                exchange = "orders",
                routingKey = "orders.created",
                payload = "{\"id\":1}",
                headers = new Dictionary<string, string> { ["X-Custom"] = "abc" },
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sent = Assert.Single(factory.BusPort.SentMessages);
        Assert.Equal("abc", sent.Headers["X-Custom"]);
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
    public async Task Send_WithEmptyExchange_Returns200_AndPublishesToTheDefaultExchange()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new { exchange = "", routingKey = "orders.reply", payload = "{\"id\":1}" });

        // An empty exchange is the AMQP default exchange (routes by queue name) and is a valid
        // publish target — a reply published via the Responder action relies on this.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sent = Assert.Single(factory.BusPort.SentMessages);
        Assert.Equal("", sent.Target);
        Assert.Equal("orders.reply", sent.RoutingKey);
    }

    [Fact]
    public async Task Send_WithWhitespaceOnlyExchange_Returns400_AsProblemJson_AndNeverReachesBusPort()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages",
            new { exchange = "   ", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Empty(factory.BusPort.SentMessages);
    }

    [Fact]
    public async Task SendWithReply_WithValidRequest_Returns200_WithSubscriptionIdAndCorrelationId()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages/with-reply",
            new { exchange = "orders", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SendWithReplyResponse>();
        Assert.NotEqual(Guid.Empty, body!.SubscriptionId);
        Assert.False(string.IsNullOrWhiteSpace(body.CorrelationId));
        var sent = Assert.Single(factory.BusPort.SentMessages);
        Assert.Equal(factory.BusPort.NextTemporaryQueueName, sent.ReplyTo);
        Assert.Equal(body.CorrelationId, sent.CorrelationId);
        Assert.Equal(1, factory.BusPort.DeclareTemporaryReplyQueueCallCount);
    }

    [Fact]
    public async Task SendWithReply_WhenBrokerDoesNotSupportRequestReply_Returns409_AsProblemJson_AndNeverDeclaresAQueue()
    {
        await using var factory = new BusTesterApiFactory();
        factory.BusPort.Capabilities = new BrokerCapabilities("Kafka", SupportsRequestReply: false);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/messages/with-reply",
            new { exchange = "orders", routingKey = "orders.created", payload = "{\"id\":1}" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(409, problem!.Status);
        Assert.Equal(0, factory.BusPort.DeclareTemporaryReplyQueueCallCount);
        Assert.Empty(factory.BusPort.SentMessages);
    }

    [Fact]
    public async Task SendWithReply_WithBlankCorrelationId_GeneratesOne_AndSupplied_IsPreserved()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var blankResponse = await client.PostAsJsonAsync(
            "/api/messages/with-reply",
            new { exchange = "orders", routingKey = "orders.created", payload = "{\"id\":1}" });
        var blankBody = await blankResponse.Content.ReadFromJsonAsync<SendWithReplyResponse>();

        var suppliedResponse = await client.PostAsJsonAsync(
            "/api/messages/with-reply",
            new
            {
                exchange = "orders",
                routingKey = "orders.created",
                payload = "{\"id\":2}",
                correlationId = "corr-explicit",
            });
        var suppliedBody = await suppliedResponse.Content.ReadFromJsonAsync<SendWithReplyResponse>();

        Assert.False(string.IsNullOrWhiteSpace(blankBody!.CorrelationId));
        Assert.NotEqual("corr-explicit", blankBody.CorrelationId);
        Assert.Equal("corr-explicit", suppliedBody!.CorrelationId);
    }
}

public sealed record SendWithReplyResponse(Guid SubscriptionId, string CorrelationId);
