/**
 * Base URL of the BusTester.Api host. Defaults to the ASP.NET Core dev-cert HTTPS profile in
 * src/BusTester.Api/Properties/launchSettings.json — adjust if the backend runs elsewhere.
 */
export const API_BASE_URL = 'https://localhost:7249';

/** SignalR hub endpoint the Angular client connects to for live message pushes. */
export const HUB_URL = `${API_BASE_URL}/hubs/bus`;
