using System.Net;
using System.Net.Http.Json;
using BusTester.Api.Controllers;
using BusTester.Api.Tests.Testing;
using BusTester.Domain.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace BusTester.Api.Tests.Controllers;

public class SubscriptionsControllerTests
{
    [Fact]
    public async Task Subscribe_WithValidRequest_Returns200_WithHandle_AndBusPortReceivesRequest()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/subscriptions", new { queueName = "orders-queue" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SubscriptionResponse>();
        Assert.NotEqual(Guid.Empty, body!.Id);
        var subscribed = Assert.Single(factory.BusPort.SubscribedRequests);
        Assert.Equal("orders-queue", subscribed.QueueName);
    }

    [Fact]
    public async Task Subscribe_WhenQueueDoesNotExistOnBroker_Returns400_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        factory.BusPort.SubscribeException = new BusSubscriptionException("Queue 'missing' not found.");
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/subscriptions", new { queueName = "missing" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(400, problem!.Status);
    }

    [Fact]
    public async Task Subscribe_WithNoActiveConnection_Returns503_AsProblemJson()
    {
        await using var factory = new BusTesterApiFactory();
        factory.BusPort.SubscribeException = new BusConnectionException("No active RabbitMQ connection. Call ConnectAsync first.");
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/subscriptions", new { queueName = "orders-queue" });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Unsubscribe_Returns204_AndBusPortReceivesHandle()
    {
        await using var factory = new BusTesterApiFactory();
        using var client = factory.CreateClient();
        var subscribeResponse = await client.PostAsJsonAsync("/api/subscriptions", new { queueName = "orders-queue" });
        var subscribed = await subscribeResponse.Content.ReadFromJsonAsync<SubscriptionResponse>();

        var response = await client.DeleteAsync($"/api/subscriptions/{subscribed!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var unsubscribed = Assert.Single(factory.BusPort.UnsubscribedHandles);
        Assert.Equal(subscribed.Id, unsubscribed.Value);
    }
}
