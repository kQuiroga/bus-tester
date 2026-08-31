namespace BusTester.Domain;

/// <summary>
/// Broker-neutral send/receive message. This type is a documented neutral superset: it carries the
/// fields every supported broker needs and treats broker-specific addressing as optional.
/// <list type="bullet">
///   <item><description><see cref="Target"/> is the broker-neutral destination. For RabbitMQ it is
///   the AMQP exchange; <c>""</c> means the broker default (routes by queue name). It is required
///   (non-null) but may be empty.</description></item>
///   <item><description><see cref="RoutingKey"/> is broker-specific and optional at this level.
///   RabbitMQ requires a non-blank value and the RabbitMQ adapter enforces that at publish time;
///   other brokers may ignore it.</description></item>
/// </list>
/// No wire fields are added by neutralization: the HTTP and SignalR contracts keep their existing
/// <c>exchange</c>/<c>routingKey</c> field names and map to <see cref="Target"/>/<see cref="RoutingKey"/>
/// through the controller and broadcaster seams.
/// </summary>
public sealed class BusMessage
{
    private static readonly IReadOnlyDictionary<string, string> EmptyHeaders =
        new Dictionary<string, string>();

    /// <summary>Broker-neutral destination. RabbitMQ: the AMQP exchange (<c>""</c> = default exchange).</summary>
    public string Target { get; }

    /// <summary>Broker-specific routing key. Optional at the model level; RabbitMQ requires it non-blank.</summary>
    public string? RoutingKey { get; }

    public string Payload { get; }
    public string? ReplyTo { get; }
    public string? CorrelationId { get; }
    public IReadOnlyDictionary<string, string> Headers { get; }

    public BusMessage(
        string target,
        string? routingKey,
        string payload,
        string? replyTo = null,
        string? correlationId = null,
        IReadOnlyDictionary<string, string>? headers = null)
    {
        // An empty target ("") is the AMQP default exchange and is explicitly allowed so a reply
        // can be published straight to a queue by name. Null and whitespace-only remain invalid.
        if (target is null)
        {
            throw new ArgumentException("Target is required.", nameof(target));
        }

        if (target.Length > 0 && target.Trim().Length == 0)
        {
            throw new ArgumentException("Target must not be whitespace-only.", nameof(target));
        }

        if (string.IsNullOrWhiteSpace(payload))
        {
            throw new ArgumentException("Payload is required.", nameof(payload));
        }

        Target = target;
        RoutingKey = routingKey;
        Payload = payload;
        ReplyTo = replyTo;
        CorrelationId = correlationId;
        Headers = headers ?? EmptyHeaders;
    }
}
