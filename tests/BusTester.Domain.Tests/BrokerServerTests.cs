using BusTester.Domain;
using Xunit;

namespace BusTester.Domain.Tests;

public class BrokerServerTests
{
    [Fact]
    public void Create_WithValidHostAndPort_SetsProperties()
    {
        var server = new BrokerServer("broker.local", 5672);

        Assert.Equal("broker.local", server.Host);
        Assert.Equal(5672, server.Port);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankHost_ThrowsArgumentException(string? host)
    {
        Assert.Throws<ArgumentException>(() => new BrokerServer(host!, 5672));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(65536)]
    public void Create_WithOutOfRangePort_ThrowsArgumentException(int port)
    {
        Assert.Throws<ArgumentException>(() => new BrokerServer("broker.local", port));
    }

    [Fact]
    public void Equality_IsByValue()
    {
        Assert.Equal(new BrokerServer("broker.local", 5672), new BrokerServer("broker.local", 5672));
        Assert.NotEqual(new BrokerServer("broker.local", 5672), new BrokerServer("broker.local", 5673));
    }
}
