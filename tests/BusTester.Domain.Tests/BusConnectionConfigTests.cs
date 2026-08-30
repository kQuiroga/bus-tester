using BusTester.Domain;
using Xunit;

namespace BusTester.Domain.Tests;

public class BusConnectionConfigTests
{
    [Fact]
    public void Create_WithValidHostPortAndCredentials_SetsProperties()
    {
        var config = new BusConnectionConfig(host: "localhost", port: 5672, username: "guest", password: "guest");

        Assert.Equal("localhost", config.Host);
        Assert.Equal(5672, config.Port);
        Assert.Equal("guest", config.Username);
        Assert.Equal("guest", config.Password);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingHost_ThrowsArgumentException(string? host)
    {
        Assert.Throws<ArgumentException>(() => new BusConnectionConfig(host!, 5672, "guest", "guest"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(65536)]
    public void Create_WithInvalidPort_ThrowsArgumentException(int port)
    {
        Assert.Throws<ArgumentException>(() => new BusConnectionConfig("localhost", port, "guest", "guest"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingUsername_ThrowsArgumentException(string? username)
    {
        Assert.Throws<ArgumentException>(() => new BusConnectionConfig("localhost", 5672, username!, "guest"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingPassword_ThrowsArgumentException(string? password)
    {
        Assert.Throws<ArgumentException>(() => new BusConnectionConfig("localhost", 5672, "guest", password!));
    }

    [Fact]
    public void Create_FromServerList_ProjectsHostAndPortFromFirstServer()
    {
        var config = new BusConnectionConfig(
            new[] { new BrokerServer("first.local", 5672), new BrokerServer("second.local", 5673) });

        Assert.Equal(2, config.Servers.Count);
        Assert.Equal("first.local", config.Host);
        Assert.Equal(5672, config.Port);
    }

    [Fact]
    public void Create_FromServerList_WithoutCredentials_LeavesUsernameAndPasswordNull()
    {
        var config = new BusConnectionConfig(new[] { new BrokerServer("first.local", 5672) });

        Assert.Null(config.Username);
        Assert.Null(config.Password);
    }

    [Fact]
    public void Create_FromServerList_WithBothCredentials_SetsThem()
    {
        var config = new BusConnectionConfig(
            new[] { new BrokerServer("first.local", 5672) },
            username: "app",
            password: "s3cret");

        Assert.Equal("app", config.Username);
        Assert.Equal("s3cret", config.Password);
    }

    [Fact]
    public void Create_FromEmptyServerList_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => new BusConnectionConfig(Array.Empty<BrokerServer>()));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_FromServerList_WithBlankHostInList_ThrowsArgumentException(string? host)
    {
        Assert.Throws<ArgumentException>(
            () => new BusConnectionConfig(new[] { new BrokerServer(host!, 5672) }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(65536)]
    public void Create_FromServerList_WithOutOfRangePort_ThrowsArgumentException(int port)
    {
        Assert.Throws<ArgumentException>(
            () => new BusConnectionConfig(new[] { new BrokerServer("first.local", port) }));
    }

    [Fact]
    public void Create_FromServerList_WithUsernameButNoPassword_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(
            () => new BusConnectionConfig(new[] { new BrokerServer("first.local", 5672) }, username: "app"));
    }

    [Fact]
    public void Create_FromServerList_WithPasswordButNoUsername_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(
            () => new BusConnectionConfig(new[] { new BrokerServer("first.local", 5672) }, password: "s3cret"));
    }

    [Fact]
    public void Create_WithFourArgConstructor_ExposesSingleServerList()
    {
        var config = new BusConnectionConfig(host: "localhost", port: 5672, username: "guest", password: "guest");

        Assert.Single(config.Servers);
        Assert.Equal(new BrokerServer("localhost", 5672), config.Servers[0]);
    }
}
