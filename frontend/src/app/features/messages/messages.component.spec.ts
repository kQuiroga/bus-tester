import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { BusHubService, ReceivedMessage } from '../../core/bus-hub.service';
import { ReplySubscriptionService } from '../../core/reply-subscription.service';
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
    clearSubscription: vi.fn((id: string) =>
      messagesSignal.update((current) => current.filter((m) => m.subscriptionId !== id)),
    ),
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
        provideHttpClient(withXhr()),
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

  it('subscribeToQueue() posts the queue name, adds a chip and joins the SignalR group on success', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');

    component.subscribeToQueue();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions'));
    expect(req.request.body).toEqual({ queueName: 'orders-queue' });
    req.flush({ id: 'sub-1' });

    expect(component.subscriptions()).toEqual([{ id: 'sub-1', queueName: 'orders-queue' }]);
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
    expect(component.subscriptions()).toEqual([]);
    expect(fakeBusHubService.joinSubscription).not.toHaveBeenCalled();
  });

  it('two concurrent subscriptions each render a chip and receive only their own messages (2.1)', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;

    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    component.queueName.set('shipping-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-2' });

    expect(component.subscriptions()).toEqual([
      { id: 'sub-1', queueName: 'orders-queue' },
      { id: 'sub-2', queueName: 'shipping-queue' },
    ]);

    fakeBusHubService.messagesSignal.set([
      msg(0, { subscriptionId: 'sub-1' }),
      msg(1, { subscriptionId: 'sub-2' }),
    ]);

    expect(component.visibleMessages()).toEqual([
      msg(0, { subscriptionId: 'sub-1' }),
      msg(1, { subscriptionId: 'sub-2' }),
    ]);
  });

  it("chipCounts() reflects each subscription's own message count only (2.2)", () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;

    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    component.queueName.set('shipping-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-2' });

    fakeBusHubService.messagesSignal.set([
      msg(0, { subscriptionId: 'sub-1' }),
      msg(1, { subscriptionId: 'sub-1' }),
      msg(2, { subscriptionId: 'sub-2' }),
    ]);

    expect(component.chipCounts()).toEqual([
      { id: 'sub-1', queueName: 'orders-queue', count: 2 },
      { id: 'sub-2', queueName: 'shipping-queue', count: 1 },
    ]);
  });

  it('subscribeToQueue() is a no-op when queueName already has an active subscription (3.1)', () => {
    const component = createSubscribedComponent();
    component.queueName.set('orders-queue');

    expect(component.isDuplicateQueue()).toBe(true);

    component.subscribeToQueue();

    httpMock.expectNone((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions'));
    expect(component.subscriptions()).toEqual([{ id: 'sub-1', queueName: 'orders-queue' }]);
  });

  it('a rejected joinSubscription surfaces the failure via errorMessage without an unhandled rejection (4.1)', async () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    fakeBusHubService.joinSubscription.mockRejectedValueOnce({ error: { detail: 'group join rejected' } });

    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    await Promise.resolve();
    await Promise.resolve();

    expect(component.errorMessage()).toBe('group join rejected');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('group join rejected');
  });

  it('a rejected leaveSubscription surfaces the failure via errorMessage without an unhandled rejection (4.2)', async () => {
    const component = createSubscribedComponent();
    fakeBusHubService.leaveSubscription.mockRejectedValueOnce({ error: { detail: 'group leave rejected' } });

    component.unsubscribe('sub-1');
    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/subscriptions/sub-1'));
    req.flush(null);

    await Promise.resolve();
    await Promise.resolve();

    expect(component.errorMessage()).toBe('group leave rejected');
  });

  it('unsubscribe(id) removes only that chip and its messages, leaving sibling subscriptions intact (5.1)', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;

    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    component.queueName.set('shipping-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-2' });

    fakeBusHubService.messagesSignal.set([
      msg(0, { subscriptionId: 'sub-1' }),
      msg(1, { subscriptionId: 'sub-2' }),
    ]);

    component.unsubscribe('sub-1');
    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/subscriptions/sub-1'));
    req.flush(null);

    expect(fakeBusHubService.leaveSubscription).toHaveBeenCalledWith('sub-1');
    expect(fakeBusHubService.clearSubscription).toHaveBeenCalledWith('sub-1');
    expect(component.subscriptions()).toEqual([{ id: 'sub-2', queueName: 'shipping-queue' }]);
    expect(component.visibleMessages()).toEqual([msg(1, { subscriptionId: 'sub-2' })]);
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

  it('unsubscribe(id) deletes the subscription, leaves the hub group and clears messages', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    component.unsubscribe('sub-1');

    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/subscriptions/sub-1'));
    req.flush(null);

    expect(fakeBusHubService.leaveSubscription).toHaveBeenCalledWith('sub-1');
    expect(fakeBusHubService.clearSubscription).toHaveBeenCalledWith('sub-1');
    expect(component.subscriptions()).toEqual([]);
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

  it('replyPanel() shows "no reply yet" (empty replies) for a pending reply with no matching message', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    replySubscriptions.add({ subscriptionId: 'reply-sub-1', correlationId: 'corr-1' });

    expect(component.replyPanel()).toEqual([
      { subscriptionId: 'reply-sub-1', correlationId: 'corr-1', replies: [] },
    ]);
  });

  it('replyPanel() shows only messages whose correlationId matches the pending subscription', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    replySubscriptions.add({ subscriptionId: 'reply-sub-1', correlationId: 'corr-1' });

    fakeBusHubService.messagesSignal.set([
      msg(0, { subscriptionId: 'reply-sub-1', correlationId: 'corr-1' }),
      msg(1, { subscriptionId: 'sub-other', correlationId: 'corr-other' }),
    ]);

    expect(component.replyPanel()).toEqual([
      {
        subscriptionId: 'reply-sub-1',
        correlationId: 'corr-1',
        replies: [msg(0, { subscriptionId: 'reply-sub-1', correlationId: 'corr-1' })],
      },
    ]);
  });

  it('replyPanel() excludes a message with matching correlationId delivered on a different subscription', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    replySubscriptions.add({ subscriptionId: 'reply-sub-1', correlationId: 'corr-1' });

    // Same correlationId as the pending reply, but delivered via an unrelated queue subscription
    // (e.g. the sender is also subscribed to the queue it just published to) — must not count as
    // a reply.
    fakeBusHubService.messagesSignal.set([
      msg(0, { subscriptionId: 'sub-other', correlationId: 'corr-1' }),
    ]);

    expect(component.replyPanel()).toEqual([
      { subscriptionId: 'reply-sub-1', correlationId: 'corr-1', replies: [] },
    ]);
  });

  it('replyPanel() delivers multiple matching replies for the same correlationId, unguarded', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    replySubscriptions.add({ subscriptionId: 'reply-sub-1', correlationId: 'corr-1' });

    fakeBusHubService.messagesSignal.set([
      msg(1, { subscriptionId: 'reply-sub-1', correlationId: 'corr-1' }),
      msg(0, { subscriptionId: 'reply-sub-1', correlationId: 'corr-1' }),
    ]);

    expect(component.replyPanel()[0].replies).toEqual([
      msg(1, { subscriptionId: 'reply-sub-1', correlationId: 'corr-1' }),
      msg(0, { subscriptionId: 'reply-sub-1', correlationId: 'corr-1' }),
    ]);
  });

  it('unsubscribeReply(id) deletes the subscription, leaves the hub group and removes the pending reply entry', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    replySubscriptions.add({ subscriptionId: 'reply-sub-1', correlationId: 'corr-1' });

    component.unsubscribeReply('reply-sub-1');
    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/subscriptions/reply-sub-1'));
    req.flush(null);

    expect(fakeBusHubService.leaveSubscription).toHaveBeenCalledWith('reply-sub-1');
    expect(replySubscriptions.pending()).toEqual([]);
    expect(component.replyPanel()).toEqual([]);
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

  it('renders the queue form and search/pause controls as hlm-* primitives', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const queueInput = root.querySelector('input[name="queueName"]');
    expect(queueInput?.getAttribute('data-slot')).toBe('input');

    const queueLabel = root.querySelector('label');
    expect(queueLabel?.getAttribute('data-slot')).toBe('label');

    const subscribeButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Suscribirse',
    );
    expect(subscribeButton?.getAttribute('data-slot')).toBe('button');

    const searchInput = root.querySelector('input[type="search"]');
    expect(searchInput?.getAttribute('data-slot')).toBe('input');

    const pauseButton = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Pausar');
    expect(pauseButton?.getAttribute('data-slot')).toBe('button');
  });

  it('renders active subscription chips as hlmBadge pills, with an icon-only unsubscribe button (lucideX)', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.queueName.set('orders-queue');
    component.subscribeToQueue();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/subscriptions')).flush({ id: 'sub-1' });

    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const chip = root.querySelector('span[data-slot="badge"]');
    expect(chip?.getAttribute('data-variant')).toBe('outline');
    expect(chip?.textContent).toContain('orders-queue');

    const unsubscribeButton = Array.from(root.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Cancelar suscripción a orders-queue'),
    );
    expect(unsubscribeButton?.getAttribute('data-slot')).toBe('button');
    expect(unsubscribeButton?.querySelector('ng-icon[name="lucideX"]')).not.toBeNull();
    expect(unsubscribeButton?.textContent).not.toContain('×');
  });

  it('renders the reply-panel unsubscribe button as icon-only (lucideX)', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    replySubscriptions.add({ subscriptionId: 'reply-sub-1', correlationId: 'corr-1' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const unsubscribeButton = Array.from(root.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Cancelar suscripción a respuesta'),
    );
    expect(unsubscribeButton?.querySelector('ng-icon[name="lucideX"]')).not.toBeNull();
  });

  it('renders a leading search icon (lucideSearch) alongside the message search input', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const searchInput = root.querySelector('input[type="search"]');
    expect(searchInput?.parentElement?.querySelector('ng-icon[name="lucideSearch"]')).not.toBeNull();
  });

  it('the pause button renders the lucidePause icon while running', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const pauseButton = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Pausar'));
    expect(pauseButton?.querySelector('ng-icon[name="lucidePause"]')).not.toBeNull();
  });

  it('the pause/resume button keeps its hlm-primitive marker and swaps to the lucidePlay icon after toggling to Reanudar (T13)', () => {
    const fixture = TestBed.createComponent(MessagesComponent);
    const component = fixture.componentInstance;
    component.togglePause();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const resumeButton = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim().includes('Reanudar'));
    expect(resumeButton?.getAttribute('data-slot')).toBe('button');
    expect(resumeButton?.querySelector('ng-icon[name="lucidePlay"]')).not.toBeNull();
  });
});
