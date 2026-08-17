namespace BusTester.Domain;

public sealed class BusMessage
{
    public string Exchange { get; }
    public string RoutingKey { get; }
    public string Payload { get; }

    public BusMessage(string exchange, string routingKey, string payload)
    {
        if (string.IsNullOrWhiteSpace(exchange))
        {
            throw new ArgumentException("Exchange is required.", nameof(exchange));
        }

        if (string.IsNullOrWhiteSpace(routingKey))
        {
            throw new ArgumentException("Routing key is required.", nameof(routingKey));
        }

        if (string.IsNullOrWhiteSpace(payload))
        {
            throw new ArgumentException("Payload is required.", nameof(payload));
        }

        Exchange = exchange;
        RoutingKey = routingKey;
        Payload = payload;
    }
}
