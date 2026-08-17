namespace BusTester.Domain.Exceptions;

/// <summary>
/// Thrown by an <c>IBusPort</c> adapter when a broker connection cannot be established,
/// is unreachable, or is required but not currently active.
/// </summary>
public sealed class BusConnectionException : Exception
{
    public BusConnectionException(string message)
        : base(message)
    {
    }

    public BusConnectionException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
