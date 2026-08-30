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
        // An empty exchange ("") is the AMQP default exchange and is explicitly allowed so a reply
        // can be published straight to a queue by name. Null and whitespace-only remain invalid.
        if (exchange is null)
        {
            throw new ArgumentException("Exchange is required.", nameof(exchange));
        }

        if (exchange.Length > 0 && exchange.Trim().Length == 0)
        {
            throw new ArgumentException("Exchange must not be whitespace-only.", nameof(exchange));
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
