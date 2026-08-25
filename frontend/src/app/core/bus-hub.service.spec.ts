import { TestBed } from '@angular/core/testing';
import { BUS_HUB_CONNECTION, BusHubService } from './bus-hub.service';
import { FakeHubConnection } from './testing/fake-hub-connection';

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

  it('clearSubscription(id) removes only that subscription\'s messages', () => {
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-1',
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{}',
    });

    service.clearSubscription('sub-1');

    expect(service.messages()).toEqual([]);
  });

  it('clearSubscription(id) leaves other subscriptions\' messages intact', () => {
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-1',
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{"id":1}',
    });
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-2',
      exchange: 'billing',
      routingKey: 'billing.updated',
      payload: '{"id":2}',
    });

    service.clearSubscription('sub-1');

    const messages = service.messages();
    expect(messages.length).toBe(1);
    expect(messages[0].subscriptionId).toBe('sub-2');
  });

  it('the first received message gets seq starting at the initial counter value (T1)', () => {
    fakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-1',
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{"id":1}',
    });

    expect(service.messages()[0].seq).toBe(0);
  });

  it('seq increments per message regardless of prepend order (T2)', () => {
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

    // Newest-first prepend: index 0 is the second emitted message, but its seq (1) is still
    // greater than the seq of the first emitted message (0) now at index 1 — seq tracks
    // receipt order, not array position.
    expect(messages[0].seq).toBe(1);
    expect(messages[1].seq).toBe(0);
  });

  it('a fresh service instance restarts its own seq counter (no shared/global state) (T3)', () => {
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
    expect(service.messages()[0].seq).toBe(1);

    TestBed.resetTestingModule();
    const freshFakeConnection = new FakeHubConnection();
    TestBed.configureTestingModule({
      providers: [{ provide: BUS_HUB_CONNECTION, useValue: freshFakeConnection }],
    });
    const freshService = TestBed.inject(BusHubService);

    freshFakeConnection.emit('MessageReceived', {
      subscriptionId: 'sub-2',
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{"id":3}',
    });

    expect(freshService.messages()[0].seq).toBe(0);
  });

  it('connectionState starts as idle (connection-status spec: "State is read-only to consumers" baseline)', () => {
    expect(service.connectionState()).toBe('idle');
  });

  it('start() sets connectionState to connecting while in flight, then connected on resolve (connection-status spec: "Initial start reflects connecting then connected")', async () => {
    const startPromise = service.start();

    expect(service.connectionState()).toBe('connecting');

    await startPromise;

    expect(service.connectionState()).toBe('connected');
  });

  it('a rejected start() sets connectionState to disconnected and still rethrows', async () => {
    fakeConnection.startError = new Error('boom');

    await expect(service.start()).rejects.toThrow('boom');
    expect(service.connectionState()).toBe('disconnected');
  });

  it('triggerReconnecting() sets connectionState to reconnecting (connection-status spec: "onreconnecting sets reconnecting state")', () => {
    fakeConnection.triggerReconnecting();

    expect(service.connectionState()).toBe('reconnecting');
  });

  it('triggerReconnected() restores connectionState to connected (connection-status spec: "onreconnected restores connected state")', () => {
    fakeConnection.triggerReconnecting();
    fakeConnection.triggerReconnected();

    expect(service.connectionState()).toBe('connected');
  });

  it('triggerClose() sets connectionState to disconnected (connection-status spec: "onclose sets disconnected state")', () => {
    fakeConnection.triggerClose();

    expect(service.connectionState()).toBe('disconnected');
  });
});
