namespace BusTester.Domain;

public sealed class BusMessage
{
    private static readonly IReadOnlyDictionary<string, string> EmptyHeaders =
        new Dictionary<string, string>();

    public string Exchange { get; }
    public string RoutingKey { get; }
    public string Payload { get; }
    public string? ReplyTo { get; }
    public string? CorrelationId { get; }
    public IReadOnlyDictionary<string, string> Headers { get; }

    public BusMessage(
        string exchange,
        string routingKey,
        string payload,
        string? replyTo = null,
        string? correlationId = null,
        IReadOnlyDictionary<string, string>? headers = null)
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
        ReplyTo = replyTo;
        CorrelationId = correlationId;
        Headers = headers ?? EmptyHeaders;
    }
}
