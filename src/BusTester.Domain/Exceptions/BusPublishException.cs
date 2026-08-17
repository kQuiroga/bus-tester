namespace BusTester.Domain.Exceptions;

/// <summary>
/// Thrown by an <c>IBusPort</c> adapter when a message cannot be published — e.g. the target
/// exchange does not exist on the broker. The underlying connection remains usable.
/// </summary>
public sealed class BusPublishException : Exception
{
    public BusPublishException(string message)
        : base(message)
    {
    }

    public BusPublishException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
