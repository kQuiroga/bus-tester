namespace BusTester.Domain;

public sealed class BusConnectionConfig
{
    public string Host { get; }
    public int Port { get; }
    public string Username { get; }
    public string Password { get; }

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

        Host = host;
        Port = port;
        Username = username;
        Password = password;
    }
}
