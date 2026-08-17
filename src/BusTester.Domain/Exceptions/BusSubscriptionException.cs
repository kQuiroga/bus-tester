namespace BusTester.Domain.Exceptions;

/// <summary>
/// Thrown by an <c>IBusPort</c> adapter when a subscription cannot be started — e.g. the target
/// queue does not exist on the broker. No subscription is started when this is thrown.
/// </summary>
public sealed class BusSubscriptionException : Exception
{
    public BusSubscriptionException(string message)
        : base(message)
    {
    }

    public BusSubscriptionException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
