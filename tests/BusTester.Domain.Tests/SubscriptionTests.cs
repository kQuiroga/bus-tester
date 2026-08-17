using BusTester.Domain;
using Xunit;

namespace BusTester.Domain.Tests;

public class SubscriptionTests
{
    [Fact]
    public void Create_WithValidQueueName_SetsQueueNameAndAssignsHandle()
    {
        var subscription = new Subscription(queueName: "orders-queue");

        Assert.Equal("orders-queue", subscription.QueueName);
        Assert.NotEqual(default, subscription.Handle);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithMissingQueueName_ThrowsArgumentException(string? queueName)
    {
        Assert.Throws<ArgumentException>(() => new Subscription(queueName!));
    }

    [Fact]
    public void Handle_ForTwoDifferentSubscriptions_AreNotEqual()
    {
        var first = new Subscription("orders-queue");
        var second = new Subscription("orders-queue");

        Assert.NotEqual(first.Handle, second.Handle);
    }

    [Fact]
    public void Handle_WithSameUnderlyingValue_AreEqual()
    {
        var handleA = new SubscriptionHandle(Guid.Parse("11111111-1111-1111-1111-111111111111"));
        var handleB = new SubscriptionHandle(Guid.Parse("11111111-1111-1111-1111-111111111111"));

        Assert.Equal(handleA, handleB);
    }
}
