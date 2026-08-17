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
}
