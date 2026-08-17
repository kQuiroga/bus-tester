import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { BusHubService, ReceivedMessage } from '../../core/bus-hub.service';
import { MessagesComponent } from './messages.component';

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
      { subscriptionId: 'sub-1', exchange: 'orders', routingKey: 'orders.updated', payload: '{"id":2}' },
      { subscriptionId: 'sub-2', exchange: 'other', routingKey: 'x', payload: '{}' },
    ]);

    expect(component.visibleMessages()).toEqual([
      { subscriptionId: 'sub-1', exchange: 'orders', routingKey: 'orders.updated', payload: '{"id":2}' },
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
});
