using BusTester.Domain.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace BusTester.Api.Middleware;

/// <summary>
/// Maps <c>IBusPort</c>/Domain failures to problem+json responses: 503 when the broker is
/// unreachable or no connection is active, 400 for broker-rejected or malformed requests.
/// </summary>
public sealed class BusExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        var (statusCode, title) = exception switch
        {
            BusConnectionException => (StatusCodes.Status503ServiceUnavailable, "Broker connection failed"),
            BusPublishException => (StatusCodes.Status400BadRequest, "Message could not be published"),
            BusSubscriptionException => (StatusCodes.Status400BadRequest, "Subscription could not be started"),
            ArgumentException => (StatusCodes.Status400BadRequest, "Invalid request"),
            _ => (0, string.Empty),
        };

        if (statusCode == 0)
        {
            return false;
        }

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception.Message,
        };

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, options: null, contentType: "application/problem+json", ct);

        return true;
    }
}
