# BusTester

A developer tool for connecting to a message broker, publishing messages, and watching consumed
messages arrive live. Walking skeleton: RabbitMQ only (Kafka is a separate future change).

Hexagonal/Clean architecture: `BusTester.Domain` → `BusTester.Application` → `BusTester.Infrastructure`
(RabbitMQ adapter, SignalR hub) → `BusTester.Api` (ASP.NET Core host + Angular SPA client).

## Prerequisites

- .NET 8 SDK
- Node.js + npm
- A running RabbitMQ broker (e.g. `docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management-alpine`)

## Run the backend

```
dotnet run --project src/BusTester.Api --launch-profile http
```

Listens on `http://localhost:5098` by default (see `src/BusTester.Api/Properties/launchSettings.json`).
Exposes `POST/DELETE /api/connections`, `POST /api/messages`, `POST/DELETE /api/subscriptions`,
and the SignalR hub at `/hubs/bus`.

## Run the frontend

```
cd frontend
npm install
npm start
```

Serves the Angular SPA at `http://localhost:4200`. Update `frontend/src/app/core/api-config.ts`
if the backend isn't running at the default `https://localhost:7249` dev-cert URL (e.g. point it
at `http://localhost:5098` when running the `http` launch profile above).

## Tests

```
dotnet test                          # all .NET test projects (Domain/Application/Api don't
                                      # need a broker; Infrastructure.Tests needs Docker for
                                      # Testcontainers RabbitMQ)
cd frontend && npm test -- --watch false   # Vitest
```

## Manual end-to-end check

1. Start RabbitMQ, the backend, and the frontend as above.
2. In the UI: connect (host/port/credentials) → subscribe to a queue → send a message on an
   exchange/routing key bound to that queue → watch it appear in the live feed without a
   refresh (message-consumption: "Live delivery").
