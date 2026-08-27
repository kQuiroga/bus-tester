import { vi } from 'vitest';

vi.mock('@spartan-ng/brain/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { toast } from '@spartan-ng/brain/sonner';
import { BusHubService } from '../../core/bus-hub.service';
import { ReplySubscriptionService } from '../../core/reply-subscription.service';
import { SendComponent } from './send.component';
import { SendHistoryService } from './send-history.service';

function createFakeBusHubService() {
  return {
    messages: signal([]).asReadonly(),
    start: vi.fn().mockResolvedValue(undefined),
    joinSubscription: vi.fn().mockResolvedValue(undefined),
    leaveSubscription: vi.fn().mockResolvedValue(undefined),
    clearSubscription: vi.fn(),
  };
}

const RECENT_SENDS_KEY = 'send-panel.recent-sends';
const TEMPLATES_KEY = 'send-panel.templates';

describe('SendComponent', () => {
  let httpMock: HttpTestingController;
  let fakeBusHubService: ReturnType<typeof createFakeBusHubService>;

  beforeEach(async () => {
    localStorage.removeItem(RECENT_SENDS_KEY);
    localStorage.removeItem(TEMPLATES_KEY);
    vi.clearAllMocks();
    fakeBusHubService = createFakeBusHubService();
    await TestBed.configureTestingModule({
      imports: [SendComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: BusHubService, useValue: fakeBusHubService },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(RECENT_SENDS_KEY);
    localStorage.removeItem(TEMPLATES_KEY);
  });

  it('submits exchange/routingKey/payload as POST /api/messages and confirms success', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('orders');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');

    component.send();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
    expect(req.request.body).toEqual({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    req.flush(null);

    expect(toast.success).toHaveBeenCalledWith('Mensaje enviado.', { class: 'bg-status-ok-bg text-status-ok' });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the broker error for an invalid exchange and leaves the form usable', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('missing-exchange');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');

    component.send();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
    req.flush(
      { title: 'Message could not be published', detail: "Could not publish to exchange 'missing-exchange'." },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(toast.error).toHaveBeenCalledWith("Could not publish to exchange 'missing-exchange'.", {
      class: 'bg-status-error-bg text-status-error',
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('blocks submit and touches all fields when exchange and payload are blank', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('');
    component.routingKey.set('orders.created');
    component.payload.set('');

    component.send();

    httpMock.expectNone((r) => r.url.endsWith('/api/messages'));
    expect(component.hasErrors()).toBe(true);
    expect(component.exchangeError()).toBe('El exchange es obligatorio.');
    expect(component.payloadError()).toBe('El payload es obligatorio.');
    expect(component.touched().has('exchange')).toBe(true);
    expect(component.touched().has('payload')).toBe(true);
    expect(component.touched().has('routingKey')).toBe(true);
  });

  it('shows a field error only once the field is touched (via blur), before any submit attempt', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('');

    expect(component.touched().has('exchange')).toBe(false);

    component.onBlur('exchange');

    expect(component.touched().has('exchange')).toBe(true);
    expect(component.exchangeError()).toBe('El exchange es obligatorio.');
  });

  it('blocks submit when routingKey is whitespace-only', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('orders');
    component.routingKey.set('   ');
    component.payload.set('{"id":1}');

    component.send();

    httpMock.expectNone((r) => r.url.endsWith('/api/messages'));
    expect(component.hasErrors()).toBe(true);
    expect(component.routingKeyError()).toBe('La clave de enrutamiento no puede estar en blanco.');
  });

  it('accepts an empty routingKey (optional field) and submits successfully', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('orders');
    component.routingKey.set('');
    component.payload.set('{"id":1}');

    component.send();

    expect(component.routingKeyError()).toBeNull();
    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
    req.flush(null);

    expect(toast.success).toHaveBeenCalledWith('Mensaje enviado.', { class: 'bg-status-ok-bg text-status-ok' });
  });

  it('records the send to history only after a successful send', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    const recordSendSpy = vi.spyOn(history, 'recordSend');
    component.exchange.set('orders');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');

    component.send();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages')).flush(null);

    expect(recordSendSpy).toHaveBeenCalledWith({
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{"id":1}',
    });
  });

  it('does not record history when the send fails', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    const recordSendSpy = vi.spyOn(history, 'recordSend');
    component.exchange.set('missing-exchange');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');

    component.send();
    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'))
      .flush(
        { title: 'Message could not be published', detail: "Could not publish to exchange 'missing-exchange'." },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(recordSendSpy).not.toHaveBeenCalled();
  });

  it('useRecent(entry) populates exchange/routingKey/payload from a recent send', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;

    component.useRecent({
      exchange: 'orders',
      routingKey: 'orders.updated',
      payload: '{"id":2}',
      sentAt: '2026-01-01T00:00:00.000Z',
    });

    expect(component.exchange()).toBe('orders');
    expect(component.routingKey()).toBe('orders.updated');
    expect(component.payload()).toBe('{"id":2}');
  });

  it('saveTemplate() persists the current form under templateName in SendHistoryService', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    component.exchange.set('orders');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');
    component.templateName.set('my-template');

    component.saveTemplate();

    expect(history.templates()).toEqual([
      { name: 'my-template', exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' },
    ]);
  });

  it('useTemplate(t) populates fields from the template and re-touches all fields', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;

    component.useTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'orders.updated', payload: '{"id":2}' });

    expect(component.exchange()).toBe('orders');
    expect(component.routingKey()).toBe('orders.updated');
    expect(component.payload()).toBe('{"id":2}');
    expect(component.touched().has('exchange')).toBe(true);
    expect(component.touched().has('routingKey')).toBe(true);
    expect(component.touched().has('payload')).toBe(true);
  });

  it('when "expect a reply" is checked, send() posts to /api/messages/with-reply instead of /api/messages', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    component.exchange.set('orders');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');
    component.expectReply.set(true);

    component.send();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages/with-reply'));
    expect(req.request.body).toEqual({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    req.flush({ subscriptionId: 'sub-1', correlationId: 'corr-1' });

    expect(toast.success).toHaveBeenCalledWith('Mensaje enviado, esperando respuesta.', {
      class: 'bg-status-ok-bg text-status-ok',
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('a successful with-reply send registers the pending reply and joins the SignalR group', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    const addSpy = vi.spyOn(replySubscriptions, 'add');
    component.exchange.set('orders');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');
    component.expectReply.set(true);

    component.send();

    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages/with-reply'))
      .flush({ subscriptionId: 'sub-1', correlationId: 'corr-1' });

    expect(addSpy).toHaveBeenCalledWith({ subscriptionId: 'sub-1', correlationId: 'corr-1' });
    expect(fakeBusHubService.joinSubscription).toHaveBeenCalledWith('sub-1');
  });

  it('a failed with-reply send shows the broker error and does not register a pending reply', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const replySubscriptions = TestBed.inject(ReplySubscriptionService);
    const addSpy = vi.spyOn(replySubscriptions, 'add');
    component.exchange.set('missing-exchange');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');
    component.expectReply.set(true);

    component.send();

    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages/with-reply'))
      .flush(
        { title: 'Message could not be published', detail: "Could not publish to exchange 'missing-exchange'." },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(toast.error).toHaveBeenCalledWith("Could not publish to exchange 'missing-exchange'.", {
      class: 'bg-status-error-bg text-status-error',
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('deleteTemplate(name) removes the template from SendHistoryService', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    history.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'a', payload: 'p' });

    component.deleteTemplate('my-template');

    expect(history.templates()).toEqual([]);
  });

  it('renders exchange/routingKey/templateName inputs, payload textarea, and expectReply checkbox via hlm primitives', () => {
    const fixture = TestBed.createComponent(SendComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelectorAll('label[data-slot="label"]').length).toBe(4);
    expect(root.querySelectorAll('input[data-slot="input"]').length).toBe(3);
    expect(root.querySelectorAll('textarea[data-slot="textarea"]').length).toBe(1);
    expect(root.querySelector('hlm-checkbox[data-slot="checkbox"]')).not.toBeNull();
  });

  it('renders the Enviar and Guardar plantilla buttons via hlmBtn (default variant, data-slot="button")', () => {
    const fixture = TestBed.createComponent(SendComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const buttons = Array.from(root.querySelectorAll('button[data-slot="button"]'));
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(button.className).toContain('bg-primary');
    }
  });

  it('renders recent-send and template row actions as hlmBtn variant="ghost" size="sm"', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    history.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    history.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const buttons = Array.from(root.querySelectorAll('button[data-slot="button"]'));
    // Enviar + Guardar plantilla (default) + Cargar (recent) + Cargar (template) + Eliminar (template)
    expect(buttons.length).toBe(5);
    const rowActionButtons = buttons.filter((button) => button.textContent?.trim().includes('Cargar') || button.textContent?.trim().includes('Eliminar'));
    expect(rowActionButtons.length).toBe(3);
    for (const button of rowActionButtons) {
      expect(button.className).toContain('h-8');
      expect(button.className).not.toContain('bg-primary');
    }
  });

  it('renders lucideDownload on every "Cargar" row action and lucideTrash2 on "Eliminar"', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    history.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    history.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const buttons = Array.from(root.querySelectorAll('button[data-slot="button"]'));
    const cargarButtons = buttons.filter((button) => button.textContent?.trim().includes('Cargar'));
    expect(cargarButtons.length).toBe(2);
    for (const button of cargarButtons) {
      expect(button.querySelector('ng-icon[name="lucideDownload"]')).not.toBeNull();
    }

    const eliminarButton = buttons.find((button) => button.textContent?.trim().includes('Eliminar'));
    expect(eliminarButton?.querySelector('ng-icon[name="lucideTrash2"]')).not.toBeNull();
  });
});
