namespace BusTester.Domain;

/// <summary>
/// Broker-neutral connection configuration: one or more <see cref="BrokerServer"/> endpoints plus
/// OPTIONAL credentials. Credentials follow a both-or-neither rule. The legacy single-host RabbitMQ
/// shape (host + port + username + password) is preserved by the four-argument constructor and
/// behaves exactly as before. <see cref="Host"/> / <see cref="Port"/> project the first server so
/// existing single-endpoint callers compile unchanged.
/// </summary>
public sealed class BusConnectionConfig
{
    public IReadOnlyList<BrokerServer> Servers { get; }

    /// <summary>Optional broker username. Null when the config carries no credentials.</summary>
    public string? Username { get; }

    /// <summary>Optional broker password. Null when the config carries no credentials.</summary>
    public string? Password { get; }

    /// <summary>Convenience accessor projecting the first server's host.</summary>
    public string Host => Servers[0].Host;

    /// <summary>Convenience accessor projecting the first server's port.</summary>
    public int Port => Servers[0].Port;

    /// <summary>
    /// Primary constructor. Requires at least one server; credentials are optional but must be
    /// supplied together or not at all.
    /// </summary>
    public BusConnectionConfig(
        IReadOnlyList<BrokerServer> servers,
        string? username = null,
        string? password = null)
    {
        if (servers is null || servers.Count == 0)
        {
            throw new ArgumentException("At least one server is required.", nameof(servers));
        }

        if (servers.Any(server => server is null))
        {
            throw new ArgumentException("Server entries must not be null.", nameof(servers));
        }

        var hasUsername = !string.IsNullOrWhiteSpace(username);
        var hasPassword = !string.IsNullOrWhiteSpace(password);
        if (hasUsername != hasPassword)
        {
            throw new ArgumentException(
                "Username and password must be provided together or not at all.");
        }

        Servers = servers.ToArray();
        Username = hasUsername ? username : null;
        Password = hasPassword ? password : null;
    }

    /// <summary>
    /// Legacy single-endpoint constructor. Enforces the original four guards (non-blank host,
    /// port 1..65535, non-blank username, non-blank password) and behaves exactly as before.
    /// </summary>
    public BusConnectionConfig(string host, int port, string username, string password)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            throw new ArgumentException("Host is required.", nameof(host));
        }

        if (port is <= 0 or > 65535)
        {
            throw new ArgumentException("Port must be between 1 and 65535.", nameof(port));
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            throw new ArgumentException("Username is required.", nameof(username));
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new ArgumentException("Password is required.", nameof(password));
        }

        Servers = new[] { new BrokerServer(host, port) };
        Username = username;
        Password = password;
    }
}
