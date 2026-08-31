namespace BusTester.Domain;

/// <summary>
/// A single broker endpoint within a <see cref="BusConnectionConfig"/>. Broker-neutral: a
/// RabbitMQ node, a Kafka bootstrap server, etc. Host must be non-blank and port in 1..65535.
/// </summary>
public sealed record BrokerServer(string Host, int Port)
{
    public string Host { get; } = string.IsNullOrWhiteSpace(Host)
        ? throw new ArgumentException("Host is required.", nameof(Host))
        : Host;

    public int Port { get; } = Port is <= 0 or > 65535
        ? throw new ArgumentException("Port must be between 1 and 65535.", nameof(Port))
        : Port;
}
