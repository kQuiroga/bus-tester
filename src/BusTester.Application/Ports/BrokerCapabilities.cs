namespace BusTester.Application.Ports;

/// <summary>
/// Static description of what a connected broker supports, produced by each <see cref="IBusPort"/>
/// adapter as a constant — no active connection is required to read it, and the value never
/// changes across connect/disconnect cycles.
/// </summary>
/// <param name="BrokerName">Human-readable identity of the broker, e.g. <c>"RabbitMQ"</c>.</param>
/// <param name="SupportsRequestReply">
/// Whether the send-with-reply flow (temporary reply-queue declaration, auto-subscribe, and
/// server-side CorrelationId generation) is available for this broker.
/// </param>
public sealed record BrokerCapabilities(string BrokerName, bool SupportsRequestReply);
