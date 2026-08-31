using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// The adapter's <see cref="RabbitMqAdapter.Capabilities"/> descriptor is a constant fact about
/// the broker client and MUST be readable without an active connection (no live broker required).
/// </summary>
public class RabbitMqAdapterCapabilitiesTests
{
    [Fact]
    public async Task Capabilities_AreReadableWithNoConnection()
    {
        await using var adapter = new RabbitMqAdapter();

        Assert.Equal("RabbitMQ", adapter.Capabilities.BrokerName);
        Assert.True(adapter.Capabilities.SupportsRequestReply);
    }
}
