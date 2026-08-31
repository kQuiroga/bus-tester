using BusTester.Domain;
using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// The neutral <see cref="BusMessage"/> allows a null/blank routing key, but RabbitMQ needs one to
/// route a publish. The adapter therefore enforces the non-blank rule that used to live in the
/// domain type. No live broker is required: the guard runs before any connection work.
/// </summary>
public class RabbitMqAdapterRoutingKeyTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SendAsync_WithBlankRoutingKey_ThrowsArgumentException(string? routingKey)
    {
        await using var adapter = new RabbitMqAdapter();

        await Assert.ThrowsAsync<ArgumentException>(
            () => adapter.SendAsync(new BusMessage("orders", routingKey, "{\"id\":1}")));
    }
}
