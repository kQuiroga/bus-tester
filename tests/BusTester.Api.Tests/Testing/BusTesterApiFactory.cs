using BusTester.Application.Ports;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BusTester.Api.Tests.Testing;

/// <summary>
/// Boots the real <c>BusTester.Api</c> host in-process (via <see cref="TestServer"/>) with the
/// singleton <c>IBusPort</c> replaced by a <see cref="StubBusPort"/> — no live RabbitMQ broker
/// needed, and each test gets full control over connect/send/subscribe failure modes.
/// </summary>
public sealed class BusTesterApiFactory : WebApplicationFactory<Program>
{
    public StubBusPort BusPort { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IBusPort>();
            services.AddSingleton<IBusPort>(BusPort);
        });
    }
}
