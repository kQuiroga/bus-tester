using BusTester.Domain;
using Testcontainers.RabbitMq;
using Xunit;

namespace BusTester.Infrastructure.Tests;

/// <summary>
/// Starts one RabbitMQ container for the whole test collection (Docker required). Individual
/// tests declare/tear down their own exchanges and queues against this shared broker.
/// </summary>
public sealed class RabbitMqContainerFixture : IAsyncLifetime
{
    private const string Username = "guest";
    private const string Password = "guest";

    private readonly RabbitMqContainer _container = new RabbitMqBuilder("rabbitmq:3.13-management")
        .WithUsername(Username)
        .WithPassword(Password)
        .Build();

    public BusConnectionConfig Config =>
        new(_container.Hostname, _container.GetMappedPublicPort(5672), Username, Password);

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();
}

[CollectionDefinition(nameof(RabbitMqCollection))]
public sealed class RabbitMqCollection : ICollectionFixture<RabbitMqContainerFixture>;
