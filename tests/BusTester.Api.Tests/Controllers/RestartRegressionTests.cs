using System.Net;
using System.Net.Http.Json;
using BusTester.Api.Controllers;
using BusTester.Api.Tests.Testing;
using BusTester.Application.Subscriptions;
using BusTester.Domain;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BusTester.Api.Tests.Controllers;

/// <summary>
/// Regression coverage for the bus-connection/message-consumption "no state survives restart" /
/// "feed resets on restart" scenarios. A true OS-level process restart isn't practical inside a
/// test suite, so this proves the equivalent property: a brand-new host instance (fresh
/// <see cref="BusTesterApiFactory"/> — its own DI container, same code as a real restart would
/// boot) has no knowledge of connections or subscriptions registered on a prior instance, because
/// nothing is persisted between them.
/// </summary>
public class RestartRegressionTests
{
    [Fact]
    public async Task FreshHostInstance_AfterPriorInstanceHadConnectionAndSubscription_StartsWithNoCarriedOverState()
    {
        SubscriptionHandle handleFromPriorInstance;
        await using (var priorInstance = new BusTesterApiFactory())
        {
            using var priorClient = priorInstance.CreateClient();
            await priorClient.PostAsJsonAsync(
                "/api/connections",
                new { host = "broker.local", port = 5672, username = "guest", password = "guest" });
            var subscribeResponse = await priorClient.PostAsJsonAsync("/api/subscriptions", new { queueName = "orders-queue" });
            var subscribed = await subscribeResponse.Content.ReadFromJsonAsync<SubscriptionResponse>();
            handleFromPriorInstance = new SubscriptionHandle(subscribed!.Id);

            var priorCoordinator = priorInstance.Services.GetRequiredService<SubscriptionCoordinator>();
            await priorCoordinator.OnMessageReceivedAsync(handleFromPriorInstance, new BusMessage("orders", "orders.created", "{\"id\":1}"));

            // Sanity: the prior instance genuinely holds this state before it goes away.
            Assert.Single(priorCoordinator.GetMessages(handleFromPriorInstance));
            Assert.NotNull(priorInstance.BusPort.ConnectedConfig);
        }

        // Simulates a process restart: a brand-new host/DI container, no shared store between it
        // and the disposed instance above.
        await using var freshInstance = new BusTesterApiFactory();
        using var freshClient = freshInstance.CreateClient();

        Assert.Null(freshInstance.BusPort.ConnectedConfig);
        var freshCoordinator = freshInstance.Services.GetRequiredService<SubscriptionCoordinator>();
        Assert.Empty(freshCoordinator.GetMessages(handleFromPriorInstance));

        // Unsubscribing the prior instance's handle still returns 204 (the controller has no
        // local existence check — it forwards straight to the port) but the fresh coordinator
        // never registered it, confirming no subscription registry carried over.
        var unsubscribeResponse = await freshClient.DeleteAsync($"/api/subscriptions/{handleFromPriorInstance.Value}");
        Assert.Equal(HttpStatusCode.NoContent, unsubscribeResponse.StatusCode);
    }
}
