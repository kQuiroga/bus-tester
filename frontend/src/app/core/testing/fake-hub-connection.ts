/**
 * Minimal stand-in for @microsoft/signalr's HubConnection — only the surface `BusHubService`
 * actually uses (`on`/`start`/`invoke`/`onreconnecting`/`onreconnected`/`onclose`), so tests
 * never open a real socket. Shared between `bus-hub.service.spec.ts` and
 * `connect.component.spec.ts` — the latter transitively depends on `BUS_HUB_CONNECTION` via
 * injecting `BusHubService` (connection-status design: "Extract FakeHubConnection into a shared
 * test helper").
 */
export class FakeHubConnection {
  private readonly handlers = new Map<string, (payload: unknown) => void>();
  private reconnectingHandler: ((error?: Error) => void) | null = null;
  private reconnectedHandler: ((connectionId?: string) => void) | null = null;
  private closeHandler: ((error?: Error) => void) | null = null;

  invoked: Array<{ method: string; args: unknown[] }> = [];
  started = false;
  /** Set to an Error before calling `start()` to simulate a rejected connection attempt. */
  startError: Error | null = null;

  on(event: string, handler: (payload: unknown) => void): void {
    this.handlers.set(event, handler);
  }

  onreconnecting(handler: (error?: Error) => void): void {
    this.reconnectingHandler = handler;
  }

  onreconnected(handler: (connectionId?: string) => void): void {
    this.reconnectedHandler = handler;
  }

  onclose(handler: (error?: Error) => void): void {
    this.closeHandler = handler;
  }

  start(): Promise<void> {
    if (this.startError) {
      return Promise.reject(this.startError);
    }
    this.started = true;
    return Promise.resolve();
  }

  invoke(method: string, ...args: unknown[]): Promise<void> {
    this.invoked.push({ method, args });
    return Promise.resolve();
  }

  emit(event: string, payload: unknown): void {
    this.handlers.get(event)?.(payload);
  }

  triggerReconnecting(): void {
    this.reconnectingHandler?.();
  }

  triggerReconnected(): void {
    this.reconnectedHandler?.();
  }

  triggerClose(): void {
    this.closeHandler?.();
  }
}
