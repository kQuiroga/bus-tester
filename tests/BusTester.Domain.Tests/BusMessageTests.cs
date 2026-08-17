using BusTester.Domain;
using Xunit;

namespace BusTester.Domain.Tests;

public class BusMessageTests
{
    [Fact]
    public void Create_WithValidExchangeRoutingKeyAndPayload_SetsProperties()
    {
        var message = new BusMessage(exchange: "orders", routingKey: "orders.created", payload: "{\"id\":1}");

        Assert.Equal("orders", message.Exchange);
        Assert.Equal("orders.created", message.RoutingKey);
        Assert.Equal("{\"id\":1}", message.Payload);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingExchange_ThrowsArgumentException(string? exchange)
    {
        Assert.Throws<ArgumentException>(() => new BusMessage(exchange!, "orders.created", "payload"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingRoutingKey_ThrowsArgumentException(string? routingKey)
    {
        Assert.Throws<ArgumentException>(() => new BusMessage("orders", routingKey!, "payload"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingPayload_ThrowsArgumentException(string? payload)
    {
        Assert.Throws<ArgumentException>(() => new BusMessage("orders", "orders.created", payload!));
    }
}
