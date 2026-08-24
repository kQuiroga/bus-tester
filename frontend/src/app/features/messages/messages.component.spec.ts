import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { BusHubService, ReceivedMessage } from '../../core/bus-hub.service';
import { MessagesComponent } from './messages.component';

function msg(seq: number, overrides: Partial<ReceivedMessage> = {}): ReceivedMessage {
  return {
    subscriptionId: 'sub-1',
    exchange: 'orders',
    routingKey: `orders.${seq}`,
    payload: `{"id":${seq}}`,
    seq,
    ...overrides,
  };
}

function createFakeBusHubService() {
  const messagesSignal = signal<ReceivedMessage[]>([]);
  return {
    messagesSignal,
    messages: messagesSignal.asReadonly(),
    start: vi.fn().mockResolvedValue(undefined),
    joinSubscription: vi.fn().mockResolvedValue(undefined),
    leaveSubscription: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(() => messagesSignal.set([])),
  };
}

describe('MessagesComponent', () => {
  let httpMock: HttpTestingController;
  let fakeBusHubService: ReturnType<typeof createFakeBusHubService>;

  beforeEach(async () => {
    fakeBusHubService = createFakeBusHubService();
    await TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BusHubService, useValue: fakeBusHubService },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Creates the component and completes a successful subscribe to 'sub-1', matching the flow
   *  every displayed-message test needs before it can push fixtures onto the fake hub. */
  function createSubscribedComponent(): MessagesComponent {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });
    return component;
  }

  it('subscribeToQueue() posts the queue name and joins the SignalR group on success', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');

    component.subscribeToQueue();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions'));
    expect(req.request.body).toEqual({ queueName: 'orders-queue' });
    req.flush({ id: 'sub-1' });

    expect(component.subscriptionId()).toBe('sub-1');
    expect(fakeBusHubService.joinSubscription).toHaveBeenCalledWith('sub-1');
  });

  it('subscribing to a queue that does not exist shows the error and starts no subscription', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('missing-queue');

    component.subscribeToQueue();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions'));
    req.flush(
      { title: 'Subscription could not be started', detail: "Could not subscribe to queue 'missing-queue'." },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.errorMessage()).toContain("Could not subscribe to queue 'missing-queue'");
    expect(component.subscriptionId()).toBeNull();
    expect(fakeBusHubService.joinSubscription).not.toHaveBeenCalled();
  });

  it('visibleMessages() only shows hub messages for the active subscription', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    fakeBusHubService.messagesSignal.set([
      { subscriptionId: 'sub-1', exchange: 'orders', routingKey: 'orders.updated', payload: '{"id":2}', seq: 1 },
      { subscriptionId: 'sub-2', exchange: 'other', routingKey: 'x', payload: '{}', seq: 0 },
    ]);

    expect(component.visibleMessages()).toEqual([
      { subscriptionId: 'sub-1', exchange: 'orders', routingKey: 'orders.updated', payload: '{"id":2}', seq: 1 },
    ]);
  });

  it('unsubscribe() deletes the subscription, leaves the hub group and clears messages', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    component.unsubscribe();

    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/subscriptions/sub-1'));
    req.flush(null);

    expect(fakeBusHubService.leaveSubscription).toHaveBeenCalledWith('sub-1');
    expect(fakeBusHubService.clear).toHaveBeenCalled();
    expect(component.subscriptionId()).toBeNull();
  });

  it('togglePause() freezes displayedMessages()/filteredMessages() until resume (T5)', () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([msg(0)]);
    expect(component.displayedMessages()).toEqual([msg(0)]);

    component.togglePause();
    fakeBusHubService.messagesSignal.set([msg(1), msg(0)]);

    expect(component.displayedMessages()).toEqual([msg(0)]);
    expect(component.filteredMessages()).toEqual([msg(0)]);
  });

  it('resuming jumps displayedMessages() straight to the full current list (T6)', () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([msg(0)]);
    expect(component.displayedMessages()).toEqual([msg(0)]);

    component.togglePause();
    fakeBusHubService.messagesSignal.set([msg(2), msg(1), msg(0)]);
    component.togglePause();

    expect(component.displayedMessages()).toEqual([msg(2), msg(1), msg(0)]);
  });

  it('isNewRow() is true for a message arriving while unpaused (T7)', () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([]);
    expect(component.displayedMessages()).toEqual([]);

    fakeBusHubService.messagesSignal.set([msg(0)]);

    expect(component.isNewRow(msg(0))).toBe(true);
  });

  it('isNewRow() is false for every row revealed by a resume (batch arrived during pause) (T8)', () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([]);
    expect(component.displayedMessages()).toEqual([]);

    component.togglePause();
    // A change-detection read while paused (as the template does every tick) is what lets the
    // linkedSignal record the frozen "paused" snapshot it later diffs the resume against.
    expect(component.displayedMessages()).toEqual([]);
    fakeBusHubService.messagesSignal.set([msg(1), msg(0)]);
    component.togglePause();

    expect(component.displayedMessages()).toEqual([msg(1), msg(0)]);
    expect(component.isNewRow(msg(1))).toBe(false);
    expect(component.isNewRow(msg(0))).toBe(false);
  });

  it("isNewRow() doesn't re-flag a row already shown on a later unrelated live update (T9)", () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([]);
    expect(component.displayedMessages()).toEqual([]);

    fakeBusHubService.messagesSignal.set([msg(0)]);
    expect(component.isNewRow(msg(0))).toBe(true);

    fakeBusHubService.messagesSignal.set([msg(1), msg(0)]);

    expect(component.isNewRow(msg(1))).toBe(true);
    expect(component.isNewRow(msg(0))).toBe(false);
  });

  it('searchTerm filters by case-insensitive substring on raw payload, routingKey, exchange (T10)', () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([
      msg(1, { routingKey: 'orders.created', exchange: 'orders-exchange', payload: '{"id":1}' }),
      msg(0, { routingKey: 'shipping.dispatched', exchange: 'shipping-exchange', payload: '{"trackingId":"abc"}' }),
    ]);

    component.searchTerm.set('ORDERS');
    expect(component.filteredMessages()).toEqual([
      msg(1, { routingKey: 'orders.created', exchange: 'orders-exchange', payload: '{"id":1}' }),
    ]);

    component.searchTerm.set('trackingid');
    expect(component.filteredMessages()).toEqual([
      msg(0, { routingKey: 'shipping.dispatched', exchange: 'shipping-exchange', payload: '{"trackingId":"abc"}' }),
    ]);
  });

  it('empty/whitespace searchTerm shows all displayed messages (T11)', () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([msg(1), msg(0)]);

    component.searchTerm.set('   ');
    expect(component.filteredMessages()).toEqual([msg(1), msg(0)]);

    component.searchTerm.set('');
    expect(component.filteredMessages()).toEqual([msg(1), msg(0)]);
  });

  it("search filtering doesn't affect isNewRow() classification (T12)", () => {
    const component = createSubscribedComponent();

    fakeBusHubService.messagesSignal.set([]);
    expect(component.displayedMessages()).toEqual([]);

    const orderMsg = msg(1, { routingKey: 'orders.created', exchange: 'orders-exchange' });
    const shippingMsg = msg(0, { routingKey: 'shipping.dispatched', exchange: 'shipping-exchange', payload: '{"trackingId":"abc"}' });
    fakeBusHubService.messagesSignal.set([orderMsg, shippingMsg]);
    component.searchTerm.set('orders');

    expect(component.filteredMessages()).toEqual([orderMsg]);
    expect(component.isNewRow(orderMsg)).toBe(true);
    expect(component.isNewRow(shippingMsg)).toBe(true);
  });
});
