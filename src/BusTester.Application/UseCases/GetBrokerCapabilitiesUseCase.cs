using BusTester.Application.Ports;

namespace BusTester.Application.UseCases;

/// <summary>
/// Reads the registered adapter's <see cref="BrokerCapabilities"/>. Side-effect free and
/// answerable at any time — it never inspects or touches the connection.
/// </summary>
public sealed class GetBrokerCapabilitiesUseCase
{
    private readonly IBusPort _busPort;

    public GetBrokerCapabilitiesUseCase(IBusPort busPort)
    {
        _busPort = busPort;
    }

    public BrokerCapabilities Handle() => _busPort.Capabilities;
}
