namespace BusTester.Domain.Exceptions;

/// <summary>
/// Thrown when a send-with-reply request is made while the connected adapter's
/// <c>BrokerCapabilities.SupportsRequestReply</c> is <c>false</c>. No reply queue is declared and
/// ordinary send/subscribe behaviour is unaffected. Maps to HTTP 409 Conflict.
/// </summary>
public sealed class RequestReplyNotSupportedException : Exception
{
    public RequestReplyNotSupportedException(string message)
        : base(message)
    {
    }

    public RequestReplyNotSupportedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
