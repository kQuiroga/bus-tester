using BusTester.Api.Middleware;
using BusTester.Application.Ports;
using BusTester.Application.Subscriptions;
using BusTester.Application.UseCases;
using BusTester.Infrastructure;

const string AngularDevCorsPolicy = "AngularDev";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<BusExceptionHandler>();
builder.Services.AddSignalR();
builder.Services.AddCors(options => options.AddPolicy(AngularDevCorsPolicy, policy => policy
    .WithOrigins("http://localhost:4200")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

// IBusPort/SubscriptionCoordinator are singletons: the connection and subscriptions are
// in-memory, session-scoped state per design (no persistence across restarts).
builder.Services.AddSingleton<IBusPort, RabbitMqAdapter>();
builder.Services.AddSingleton<IMessageBroadcaster, SignalRMessageBroadcaster>();
builder.Services.AddSingleton<SubscriptionCoordinator>();
builder.Services.AddTransient<SendMessageUseCase>();
builder.Services.AddTransient<SendMessageWithReplyUseCase>();
builder.Services.AddTransient<SubscribeUseCase>();
builder.Services.AddTransient<UnsubscribeUseCase>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseCors(AngularDevCorsPolicy);
app.MapControllers();
app.MapHub<BusHub>("/hubs/bus");

app.Run();

// Exposes the top-level-statement entry point so WebApplicationFactory<Program> (integration
// tests) can bootstrap the same host in-process.
public partial class Program;
