using System.Text.Json;
using BusTester.Domain;
using BusTester.Infrastructure;
using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// Pins the byte-compatible SignalR wire contract for the broker-neutral received model: the
/// <c>MessageReceived</c> payload keeps its existing field names and the neutral
/// <see cref="BusMessage.Target"/>/<see cref="BusMessage.RoutingKey"/> map onto <c>exchange</c>/
/// <c>routingKey</c> so the untouched Angular client keeps working. No broker required.
/// </summary>
public class MessageReceivedDtoTests
{
    // SignalR's JsonHubProtocol serializes payloads with the camelCase naming policy.
    private static readonly JsonSerializerOptions SignalRLike = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [Fact]
    public void FromDomain_MapsTargetOntoExchangeField_AndKeepsRoutingKey()
    {
        var handle = Guid.NewGuid();
        var message = new BusMessage("orders", "orders.created", "{\"id\":1}", replyTo: "orders.reply", correlationId: "corr-1");

        var dto = MessageReceivedDto.FromDomain(handle, message);

        Assert.Equal(handle, dto.SubscriptionId);
        Assert.Equal("orders", dto.Exchange);
        Assert.Equal("orders.created", dto.RoutingKey);
        Assert.Equal("{\"id\":1}", dto.Payload);
        Assert.Equal("orders.reply", dto.ReplyTo);
        Assert.Equal("corr-1", dto.CorrelationId);
    }

    [Fact]
    public void FromDomain_WithNullRoutingKey_EmitsEmptyStringSoTheClientStillGetsAString()
    {
        var message = new BusMessage("", routingKey: null, payload: "{\"reply\":true}");

        var dto = MessageReceivedDto.FromDomain(Guid.NewGuid(), message);

        Assert.Equal("", dto.Exchange);
        Assert.Equal("", dto.RoutingKey);
    }

    [Fact]
    public void Serialized_KeepsExistingWireFieldNames()
    {
        var message = new BusMessage("orders", "orders.created", "{\"id\":1}", replyTo: "orders.reply", correlationId: "corr-1");
        var dto = MessageReceivedDto.FromDomain(Guid.NewGuid(), message);

        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(dto, SignalRLike));
        var names = doc.RootElement.EnumerateObject().Select(p => p.Name).ToArray();

        Assert.Equal(
            new[] { "subscriptionId", "exchange", "routingKey", "payload", "replyTo", "correlationId" },
            names);
    }
}
