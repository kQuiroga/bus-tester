import { TestBed } from '@angular/core/testing';
import { BUS_HUB_CONNECTION, BusHubService } from './bus-hub.service';

/**
 * Minimal stand-in for @microsoft/signalr's HubConnection — only the surface BusHubService
 * actually uses (on/start/invoke), so tests never open a real socket.
 */
class FakeHubConnection {
  private readonly handlers = new Map<string, (payload: unknown) => void>();
  invoked: Array<{ method: string; args: unknown[] }> = [];
  started = false;

  on(event: string, handler: (payload: unknown) => void): void {
    this.handlers.set(event, handler);
  }

  start(): Promise<void> {
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
}

describe('BusHubService', () => {
  let fakeConnection: FakeHubConnection;
  let service: BusHubService;

  beforeEach(() => {
    fakeConnection = new FakeHubConnection();
    TestBed.configureTestingModule({
      providers: [{ provide: BUS_HUB_CONNECTION, useValue: fakeConnection }],
    });
    service = TestBed.inject(BusHubService);
  });

  it('starts with an empty messages signal', () => {
    expect(service.messages()).toEqual([]);
  });

  it('a fresh instance (simulating an app reload) ignores any pre-existing browser storage and starts empty', () => {
    // Populate both storages the way a prior "session" might have left them behind, then build a
    // brand-new service instance the same way a page reload would (fresh TestBed module + fresh
    // fake connection — no shared state with the `service` created in beforeEach). Proves the
    // feed has no client-side persistence layer reading from localStorage/sessionStorage on init
    // (message-consumption spec: "Feed resets on restart").
    localStorage.setItem('busHub.messages', JSON.stringify([{ subscriptionId: 'sub-1', exchange: 'orders', routingKey: 'orders.created', payload: '{}' }]));
    sessionStorage.setItem('busHub.messages', JSON.stringify([{ subscriptionId: 'sub-1', exchange: 'orders', routingKey: 'orders.created', payload: '{}' }]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: BUS_HUB_CONNECTION, useValue: new FakeHubConnection() }],
    });
    const freshInstanceService = TestBed.inject(BusHubService);

    expect(freshInstanceService.messages()).toEqual([]);

    localStorage.removeItem('busHub.messages');
    sessionStorage.removeItem('busHub.messages');
  });

  it('prepends each MessageReceived push to the messages signal (newest first)', () => {
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-1',
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{"id":1}',
    });
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-1',
      exchange: 'orders',
      routingKey: 'orders.updated',
      payload: '{"id":2}',
    });

    const messages = service.messages();

    expect(messages.length).toBe(2);
    expect(messages[0].routingKey).toBe('orders.updated');
    expect(messages[1].routingKey).toBe('orders.created');
  });

  it('start() starts the underlying connection', async () => {
    await service.start();
    expect(fakeConnection.started).toBe(true);
  });

  it('joinSubscription invokes JoinSubscription with the subscription id', async () => {
    await service.joinSubscription('sub-1');
    expect(fakeConnection.invoked).toEqual([{ method: 'JoinSubscription', args: ['sub-1'] }]);
  });

  it('leaveSubscription invokes LeaveSubscription with the subscription id', async () => {
    await service.leaveSubscription('sub-1');
    expect(fakeConnection.invoked).toEqual([{ method: 'LeaveSubscription', args: ['sub-1'] }]);
  });

  it('clear() resets the messages signal', () => {
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-1',
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{}',
    });

    service.clear();

    expect(service.messages()).toEqual([]);
  });
});
