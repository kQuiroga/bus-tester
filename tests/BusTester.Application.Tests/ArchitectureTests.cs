using System.Reflection;
using BusTester.Application.Ports;
using BusTester.Domain;
using Xunit;

namespace BusTester.Application.Tests;

public class ArchitectureTests
{
    [Fact]
    public void DomainAssembly_DoesNotReferenceRabbitMqClient()
    {
        var domainAssembly = typeof(BusMessage).Assembly;

        Assert.DoesNotContain(
            domainAssembly.GetReferencedAssemblies(),
            referenced => referenced.Name == "RabbitMQ.Client");
    }

    [Fact]
    public void ApplicationAssembly_DoesNotReferenceRabbitMqClient()
    {
        var applicationAssembly = typeof(IBusPort).Assembly;

        Assert.DoesNotContain(
            applicationAssembly.GetReferencedAssemblies(),
            referenced => referenced.Name == "RabbitMQ.Client");
    }
}
