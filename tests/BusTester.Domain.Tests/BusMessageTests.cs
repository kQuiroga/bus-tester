using BusTester.Domain;
using Xunit;

namespace BusTester.Domain.Tests;

public class BusMessageTests
{
    [Fact]
    public void Create_WithValidTargetRoutingKeyAndPayload_SetsProperties()
    {
        var message = new BusMessage(target: "orders", routingKey: "orders.created", payload: "{\"id\":1}");

        Assert.Equal("orders", message.Target);
        Assert.Equal("orders.created", message.RoutingKey);
        Assert.Equal("{\"id\":1}", message.Payload);
    }

    [Fact]
    public void Create_WithNullTarget_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => new BusMessage(null!, "orders.created", "payload"));
    }

    [Fact]
    public void Create_WithWhitespaceOnlyTarget_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => new BusMessage("   ", "orders.created", "payload"));
    }

    [Fact]
    public void Create_WithEmptyTarget_Succeeds()
    {
        var message = new BusMessage(target: "", routingKey: "orders.reply", payload: "{\"id\":1}");

        Assert.Equal("", message.Target);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingOrBlankRoutingKey_IsAccepted(string? routingKey)
    {
        var message = new BusMessage("orders", routingKey, "payload");

        Assert.Equal(routingKey, message.RoutingKey);
    }

    [Fact]
    public void Create_WithoutRoutingKey_DefaultsToNull()
    {
        var message = new BusMessage("orders", routingKey: null, payload: "payload");

        Assert.Null(message.RoutingKey);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingPayload_ThrowsArgumentException(string? payload)
    {
        Assert.Throws<ArgumentException>(() => new BusMessage("orders", "orders.created", payload!));
    }

    [Fact]
    public void Create_WithReplyToAndCorrelationId_SetsBothProperties()
    {
        var message = new BusMessage(
            target: "orders",
            routingKey: "orders.created",
            payload: "{\"id\":1}",
            replyTo: "orders.reply",
            correlationId: "corr-123");

        Assert.Equal("orders.reply", message.ReplyTo);
        Assert.Equal("corr-123", message.CorrelationId);
    }

    [Fact]
    public void Create_WithOnlyCorrelationId_LeavesReplyToNull()
    {
        var message = new BusMessage(
            target: "orders",
            routingKey: "orders.created",
            payload: "{\"id\":1}",
            correlationId: "corr-456");

        Assert.Null(message.ReplyTo);
        Assert.Equal("corr-456", message.CorrelationId);
    }

    [Fact]
    public void Create_WithOnlyReplyTo_LeavesCorrelationIdNull()
    {
        var message = new BusMessage(
            target: "orders",
            routingKey: "orders.created",
            payload: "{\"id\":1}",
            replyTo: "orders.reply");

        Assert.Equal("orders.reply", message.ReplyTo);
        Assert.Null(message.CorrelationId);
    }

    [Fact]
    public void Create_WithoutReplyToOrCorrelationId_DefaultsBothToNull()
    {
        var message = new BusMessage(target: "orders", routingKey: "orders.created", payload: "{\"id\":1}");

        Assert.Null(message.ReplyTo);
        Assert.Null(message.CorrelationId);
    }

    [Fact]
    public void Create_WithoutHeaders_DefaultsToEmptyNonNullDictionary()
    {
        var message = new BusMessage(target: "orders", routingKey: "orders.created", payload: "{\"id\":1}");

        Assert.NotNull(message.Headers);
        Assert.Empty(message.Headers);
    }

    [Fact]
    public void Create_WithExplicitHeaders_StoresThemAsIs()
    {
        var headers = new Dictionary<string, string>
        {
            ["NServiceBus.ContentType"] = "application/json",
            ["X-Custom"] = "abc",
        };

        var message = new BusMessage(
            target: "orders",
            routingKey: "orders.created",
            payload: "{\"id\":1}",
            headers: headers);

        Assert.Equal(2, message.Headers.Count);
        Assert.Equal("application/json", message.Headers["NServiceBus.ContentType"]);
        Assert.Equal("abc", message.Headers["X-Custom"]);
    }
}
