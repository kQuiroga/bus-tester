using BusTester.Application.Ports;
using BusTester.Application.Tests.Fakes;
using BusTester.Application.UseCases;
using Xunit;

namespace BusTester.Application.Tests.UseCases;

public class GetBrokerCapabilitiesUseCaseTests
{
    [Fact]
    public void Handle_ReturnsTheRegisteredAdapterCapabilities()
    {
        var fakeBusPort = new FakeBusPort
        {
            Capabilities = new BrokerCapabilities("RabbitMQ", SupportsRequestReply: true),
        };
        var useCase = new GetBrokerCapabilitiesUseCase(fakeBusPort);

        var result = useCase.Handle();

        Assert.Equal("RabbitMQ", result.BrokerName);
        Assert.True(result.SupportsRequestReply);
    }

    [Fact]
    public void Handle_ReflectsAnAdapterThatDoesNotSupportRequestReply()
    {
        var fakeBusPort = new FakeBusPort
        {
            Capabilities = new BrokerCapabilities("Kafka", SupportsRequestReply: false),
        };
        var useCase = new GetBrokerCapabilitiesUseCase(fakeBusPort);

        var result = useCase.Handle();

        Assert.Equal("Kafka", result.BrokerName);
        Assert.False(result.SupportsRequestReply);
    }
}
