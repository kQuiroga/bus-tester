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
import { ReplyDraftService } from '../../core/reply-draft.service';
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
    expect(req.request.body).toEqual({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}', headers: {} });
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
      headers: {},
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

  it('clearRecent() delegates to SendHistoryService.clearRecentSends()', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    const clearSpy = vi.spyOn(history, 'clearRecentSends');

    component.clearRecent();

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('the "Vaciar" control is shown only when recent sends exist and clears them via the service', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    const clearSpy = vi.spyOn(history, 'clearRecentSends');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('[data-testid="recent-sends-clear"]')).toBeNull();

    history.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    fixture.detectChanges();

    const clearButton = root.querySelector('[data-testid="recent-sends-clear"]') as HTMLButtonElement | null;
    expect(clearButton).not.toBeNull();
    expect(clearButton?.textContent?.trim()).toContain('Vaciar');

    clearButton?.click();
    expect(clearSpy).toHaveBeenCalledTimes(1);
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
      { name: 'my-template', exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}', headers: {} },
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
    expect(req.request.body).toEqual({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}', headers: {} });
    req.flush({ subscriptionId: 'sub-1', correlationId: 'corr-1' });

    expect(toast.success).toHaveBeenCalledWith('Mensaje enviado, esperando respuesta.', {
      class: 'bg-status-ok-bg text-status-ok',
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('a successful with-reply send registers the pending reply and joins the SignalR group', async () => {
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

    await Promise.resolve();
    await Promise.resolve();
    expect(fakeBusHubService.joinSubscription).toHaveBeenCalledWith('sub-1');
  });

  it('a successful with-reply send waits for busHub.start() to resolve before joining the SignalR group, ' +
    'instead of racing it (regression: start()/joinSubscription race)', async () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    let resolveStart!: () => void;
    fakeBusHubService.start.mockReturnValue(new Promise<void>((resolve) => { resolveStart = resolve; }));
    component.exchange.set('orders');
    component.routingKey.set('orders.created');
    component.payload.set('{"id":1}');
    component.expectReply.set(true);

    component.send();

    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages/with-reply'))
      .flush({ subscriptionId: 'sub-1', correlationId: 'corr-1' });

    await Promise.resolve();
    await Promise.resolve();
    expect(fakeBusHubService.joinSubscription).not.toHaveBeenCalled();

    resolveStart();
    await Promise.resolve();
    await Promise.resolve();
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

    expect(root.querySelectorAll('label[data-slot="label"]').length).toBe(5);
    expect(root.querySelectorAll('input[data-slot="input"]').length).toBe(3);
    expect(root.querySelectorAll('textarea[data-slot="textarea"]').length).toBe(1);
    expect(root.querySelector('hlm-checkbox[data-slot="checkbox"]')).not.toBeNull();
  });

  it('renders "Enviar" as a full-width accent button and "Guardar" as a compact accent button', () => {
    const fixture = TestBed.createComponent(SendComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const buttons = Array.from(root.querySelectorAll('button[data-slot="button"]'));
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(button.className).toContain('bg-primary');
    }

    const enviar = buttons.find((b) => b.textContent?.trim() === 'Enviar') as HTMLElement;
    expect(enviar.getAttribute('type')).toBe('submit');
    expect(enviar.className).toContain('w-full');
    expect(enviar.className).toContain('h-[38px]');
    expect(enviar.className).toContain('rounded-[9px]');

    const guardar = buttons.find((b) => b.textContent?.trim() === 'Guardar') as HTMLElement;
    expect(guardar).not.toBeUndefined();
    expect(guardar.className).toContain('h-[34px]');
    expect(guardar.className).toContain('rounded-[8px]');
  });

  it('renders the recent "Vaciar" as a plain text button (no hlmBtn, no icon) and row "Cargar" as a ghost button', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    history.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const clear = root.querySelector('[data-testid="recent-sends-clear"]') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    expect(clear.getAttribute('data-slot')).toBeNull();
    expect(clear.querySelector('ng-icon')).toBeNull();
    expect(clear.textContent?.trim()).toBe('Vaciar');
    expect(clear.className).toContain('text-[11px]');
    expect(clear.className).toContain('bg-transparent');

    const row = root.querySelector('[data-testid="recent-send-row"]') as HTMLElement;
    const cargar = row.querySelector('button[data-slot="button"]') as HTMLButtonElement;
    expect(cargar.textContent?.trim()).toBe('Cargar');
    expect(cargar.querySelector('ng-icon')).toBeNull();
    expect(cargar.className).not.toContain('bg-primary');
  });

  it('recent-send and template rows render text-only actions with no lucide icons', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    history.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    history.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const recentRow = root.querySelector('[data-testid="recent-send-row"]') as HTMLElement;
    expect(recentRow.querySelectorAll('ng-icon').length).toBe(0);
    expect(recentRow.textContent).toContain('Cargar');

    const templateRow = root.querySelector('[data-testid="template-row"]') as HTMLElement;
    expect(templateRow.querySelectorAll('ng-icon').length).toBe(0);
    expect(templateRow.textContent).toContain('Cargar');
    expect(templateRow.textContent).toContain('Eliminar');
  });

  it('recent-sends header carries the count inline in a .field-label and rows render a one-line mono summary', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    history.recordSend({ exchange: 'ordenes.event', routingKey: 'orden.creada', payload: '{}' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const header = root.querySelector('[data-testid="recent-sends"] .field-label') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.textContent?.replace(/\s+/g, ' ').trim()).toBe('Envíos recientes · 1');

    const summary = root.querySelector('[data-testid="recent-send-row"] span.font-mono') as HTMLElement;
    expect(summary.textContent?.trim()).toBe('ordenes.event / orden.creada');

    expect(root.textContent).toContain('últimos 5 · el resto se descarta de localStorage');
  });

  it('a recent send with an empty exchange shows the default-exchange marker in the summary', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const history = TestBed.inject(SendHistoryService);
    history.recordSend({ exchange: '', routingKey: 'orden.creada', payload: '{}' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const summary = root.querySelector('[data-testid="recent-send-row"] span.font-mono') as HTMLElement;
    expect(summary.textContent?.trim()).toBe('(intercambio predeterminado) / orden.creada');
  });

  it('the recent-sends and templates section headers use the .field-label treatment', () => {
    const fixture = TestBed.createComponent(SendComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const headers = Array.from(root.querySelectorAll('h3.field-label')).map((h) => h.textContent?.trim() ?? '');
    expect(headers).toContain('Plantillas');
    expect(headers.some((t) => t.startsWith('Envíos recientes'))).toBe(true);
  });

  it('send-panel text inputs and the payload textarea adopt the prototype .in utilities', () => {
    const fixture = TestBed.createComponent(SendComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const inputs = Array.from(root.querySelectorAll('input[data-slot="input"]')) as HTMLElement[];
    for (const input of inputs) {
      expect(input.className).toContain('rounded-[8px]');
      expect(input.className).toContain('bg-muted');
    }
    const textarea = root.querySelector('textarea[data-slot="textarea"]') as HTMLElement;
    expect(textarea.className).toContain('rounded-[8px]');
    expect(textarea.className).toContain('bg-muted');
  });

  describe('custom headers', () => {
    it('hides Comunes and Adicionales sections until "Agregar headers personalizados" is checked', () => {
      const fixture = TestBed.createComponent(SendComponent);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;

      expect(root.querySelector('[data-testid="headers-comunes-section"]')).toBeNull();
      expect(root.querySelector('[data-testid="headers-adicionales-section"]')).toBeNull();

      fixture.componentInstance.headersEnabled.set(true);
      fixture.detectChanges();

      expect(root.querySelector('[data-testid="headers-comunes-section"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="headers-adicionales-section"]')).not.toBeNull();
    });

    it('resolvedHeaders() is empty when headersEnabled is false, even if fields hold values', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.headerContentType.set('application/json');

      expect(component.resolvedHeaders()).toEqual({});
    });

    it('resolvedHeaders() maps filled Comunes fields to their NServiceBus header names', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.headersEnabled.set(true);
      component.headerTipoMensaje.set('Orders.OrderCreated, Orders');
      component.headerContentType.set('application/json');
      component.headerIntencion.set('Send');
      component.headerMessageId.set('msg-1');
      component.headerCorrelationId.set('corr-1');

      expect(component.resolvedHeaders()).toEqual({
        'NServiceBus.EnclosedMessageTypes': 'Orders.OrderCreated, Orders',
        'NServiceBus.ContentType': 'application/json',
        'NServiceBus.MessageIntent': 'Send',
        'NServiceBus.MessageId': 'msg-1',
        'NServiceBus.CorrelationId': 'corr-1',
      });
    });

    it('resolvedHeaders() omits an empty Comunes field entirely', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.headersEnabled.set(true);
      component.headerContentType.set('application/json');

      const headers = component.resolvedHeaders();

      expect(headers).toEqual({ 'NServiceBus.ContentType': 'application/json' });
      expect('NServiceBus.MessageId' in headers).toBe(false);
    });

    it('resolvedHeaders() includes a complete Adicionales row', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.headersEnabled.set(true);
      component.additionalHeaders.set([{ key: 'X-Custom', value: 'abc' }]);

      expect(component.resolvedHeaders()).toEqual({ 'X-Custom': 'abc' });
    });

    it('resolvedHeaders() silently ignores an Adicionales row missing a key or value', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.headersEnabled.set(true);
      component.additionalHeaders.set([
        { key: '', value: 'abc' },
        { key: 'X-Custom', value: '' },
        { key: 'X-Complete', value: 'ok' },
      ]);

      expect(component.resolvedHeaders()).toEqual({ 'X-Complete': 'ok' });
    });

    it('resolvedHeaders() resolves a Comunes/Adicionales key collision with the Comunes value', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.headersEnabled.set(true);
      component.headerContentType.set('application/json');
      component.additionalHeaders.set([{ key: 'NServiceBus.ContentType', value: 'text/plain' }]);

      expect(component.resolvedHeaders()).toEqual({ 'NServiceBus.ContentType': 'application/json' });
    });

    it('addHeaderRow()/removeHeaderRow() add and remove Adicionales rows', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      component.addHeaderRow();
      component.addHeaderRow();
      expect(component.additionalHeaders().length).toBe(2);

      component.removeHeaderRow(0);
      expect(component.additionalHeaders().length).toBe(1);
    });

    it('generateCorrelationId() fills headerCorrelationId with a generated GUID', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      expect(component.headerCorrelationId()).toBe('');

      component.generateCorrelationId();

      expect(component.headerCorrelationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('sends resolvedHeaders() as the "headers" field of the POST /api/messages body', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      component.exchange.set('orders');
      component.routingKey.set('orders.created');
      component.payload.set('{"id":1}');
      component.headersEnabled.set(true);
      component.headerContentType.set('application/json');

      component.send();

      const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
      expect(req.request.body).toEqual({
        exchange: 'orders',
        routingKey: 'orders.created',
        payload: '{"id":1}',
        headers: { 'NServiceBus.ContentType': 'application/json' },
      });
      req.flush(null);
    });

    it('useRecent(entry) restores headers: Comunes fields by exact key, leftovers as Adicionales rows, and enables the section', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      component.useRecent({
        exchange: 'orders',
        routingKey: 'orders.updated',
        payload: '{"id":2}',
        sentAt: '2026-01-01T00:00:00.000Z',
        headers: { 'NServiceBus.ContentType': 'application/json', 'X-Custom': 'abc' },
      });

      expect(component.headersEnabled()).toBe(true);
      expect(component.headerContentType()).toBe('application/json');
      expect(component.additionalHeaders()).toEqual([{ key: 'X-Custom', value: 'abc' }]);
    });

    it('useTemplate(t) restores headers the same way as useRecent', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      component.useTemplate({
        name: 'my-template',
        exchange: 'orders',
        routingKey: 'orders.updated',
        payload: '{"id":2}',
        headers: { 'NServiceBus.CorrelationId': 'corr-1' },
      });

      expect(component.headersEnabled()).toBe(true);
      expect(component.headerCorrelationId()).toBe('corr-1');
      expect(component.additionalHeaders()).toEqual([]);
    });

    it('useRecent(entry) with no headers field leaves the headers section disabled and empty, no error', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      expect(() =>
        component.useRecent({
          exchange: 'orders',
          routingKey: 'orders.updated',
          payload: '{"id":2}',
          sentAt: '2026-01-01T00:00:00.000Z',
        }),
      ).not.toThrow();

      expect(component.headersEnabled()).toBe(false);
      expect(component.additionalHeaders()).toEqual([]);
    });
  });

  describe('reply mode (Responder pre-fill)', () => {
    function applyDraft(
      fixture: ReturnType<typeof TestBed.createComponent<SendComponent>>,
      target: { routingKey: string; correlationId: string | null },
    ): void {
      TestBed.inject(ReplyDraftService).request(target);
      fixture.detectChanges();
    }

    it('applies a new reply draft: replyMode on, empty exchange, routing key + correlation id set, empty payload', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      applyDraft(fixture, { routingKey: 'reply.queue.abc', correlationId: 'corr-42' });

      expect(component.replyMode()).toBe(true);
      expect(component.exchange()).toBe('');
      expect(component.routingKey()).toBe('reply.queue.abc');
      expect(component.correlationId()).toBe('corr-42');
      expect(component.payload()).toBe('');
    });

    it('a message without a correlationId pre-fills the routing key and leaves correlation id blank', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      applyDraft(fixture, { routingKey: 'reply.queue.xyz', correlationId: null });

      expect(component.replyMode()).toBe(true);
      expect(component.routingKey()).toBe('reply.queue.xyz');
      expect(component.correlationId()).toBe('');
    });

    it('in reply mode an exactly-empty exchange is not an error, but whitespace still is', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      applyDraft(fixture, { routingKey: 'reply.q', correlationId: null });

      expect(component.exchange()).toBe('');
      expect(component.exchangeError()).toBeNull();

      component.exchange.set('   ');
      expect(component.exchangeError()).toBe('El exchange es obligatorio.');
    });

    it('outside reply mode an exactly-empty exchange is still an error', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      expect(component.replyMode()).toBe(false);
      component.exchange.set('');
      expect(component.exchangeError()).toBe('El exchange es obligatorio.');
    });

    it('manually editing the exchange leaves reply mode', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      applyDraft(fixture, { routingKey: 'reply.q', correlationId: null });
      expect(component.replyMode()).toBe(true);

      component.onExchangeInput('orders');

      expect(component.replyMode()).toBe(false);
      expect(component.exchange()).toBe('orders');
    });

    it('manually editing the routing key leaves reply mode and restores the empty-exchange error', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      applyDraft(fixture, { routingKey: 'reply.q', correlationId: null });
      expect(component.replyMode()).toBe(true);

      component.onRoutingKeyInput('orders.reply');

      expect(component.replyMode()).toBe(false);
      expect(component.routingKey()).toBe('orders.reply');
      expect(component.exchangeError()).toBe('El exchange es obligatorio.');
    });

    it('in reply mode, send() posts exchange:"" plus the correlationId in the body', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      applyDraft(fixture, { routingKey: 'reply.q', correlationId: 'corr-99' });
      component.payload.set('{"ok":true}');

      component.send();

      const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
      expect(req.request.body).toEqual({
        exchange: '',
        routingKey: 'reply.q',
        payload: '{"ok":true}',
        headers: {},
        correlationId: 'corr-99',
      });
      req.flush(null);
      expect(toast.success).toHaveBeenCalledWith('Mensaje enviado.', { class: 'bg-status-ok-bg text-status-ok' });
    });

    it('in reply mode with no correlationId, the correlationId key is omitted from the body', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      applyDraft(fixture, { routingKey: 'reply.q', correlationId: null });
      component.payload.set('{"ok":true}');

      component.send();

      const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
      expect(req.request.body).toEqual({ exchange: '', routingKey: 'reply.q', payload: '{"ok":true}', headers: {} });
      expect('correlationId' in (req.request.body as Record<string, unknown>)).toBe(false);
      req.flush(null);
    });

    it('renders a read-only default-exchange chip and a Correlation ID field only in reply mode', async () => {
      const fixture = TestBed.createComponent(SendComponent);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;

      expect(root.querySelector('[data-testid="reply-exchange-chip"]')).toBeNull();
      expect(root.querySelector('input[name="correlationId"]')).toBeNull();
      expect(root.querySelector('input[name="exchange"]')).not.toBeNull();

      TestBed.inject(ReplyDraftService).request({ routingKey: 'reply.q', correlationId: 'corr-1' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const chip = root.querySelector('[data-testid="reply-exchange-chip"]');
      expect(chip?.textContent).toContain('(intercambio predeterminado)');
      expect(root.querySelector('input[name="exchange"]')).toBeNull();
      const corrInput = root.querySelector('input[name="correlationId"]') as HTMLInputElement | null;
      expect(corrInput).not.toBeNull();
      expect(corrInput?.value).toBe('corr-1');
    });
  });

  describe('dirty-check and overwrite confirmation', () => {
    it('a pristine form is not dirty; typing into the payload makes it dirty', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      expect(component.isDirty()).toBe(false);

      component.payload.set('typed');
      expect(component.isDirty()).toBe(true);
    });

    it('useRecent, useTemplate and a successful send each re-baseline the dirty snapshot', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      component.useRecent({ exchange: 'orders', routingKey: 'o.c', payload: 'p', sentAt: '2026-01-01T00:00:00.000Z' });
      expect(component.isDirty()).toBe(false);

      component.useTemplate({ name: 't', exchange: 'orders', routingKey: 'o.c', payload: 'p2' });
      expect(component.isDirty()).toBe(false);

      component.payload.set('changed');
      expect(component.isDirty()).toBe(true);
      component.send();
      httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages')).flush(null);
      expect(component.isDirty()).toBe(false);
    });

    it('the reply pre-fill re-baselines the snapshot so the form is not dirty right after it', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;

      TestBed.inject(ReplyDraftService).request({ routingKey: 'reply.q', correlationId: 'c1' });
      fixture.detectChanges();

      expect(component.isDirty()).toBe(false);
    });

    it('a dirty panel prompts before a second reply pre-fill; declining leaves the form untouched', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      const replyDraft = TestBed.inject(ReplyDraftService);
      const confirmSpy = vi.spyOn(component, 'confirmOverwrite').mockReturnValue(false);

      replyDraft.request({ routingKey: 'reply.one', correlationId: 'c1' });
      fixture.detectChanges();
      expect(component.routingKey()).toBe('reply.one');

      component.payload.set('half-written reply');
      replyDraft.request({ routingKey: 'reply.two', correlationId: 'c2' });
      fixture.detectChanges();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(component.routingKey()).toBe('reply.one');
      expect(component.correlationId()).toBe('c1');
      expect(component.payload()).toBe('half-written reply');
      expect(component.replyMode()).toBe(true);
    });

    it('confirming the overwrite applies the new reply target', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      const replyDraft = TestBed.inject(ReplyDraftService);
      vi.spyOn(component, 'confirmOverwrite').mockReturnValue(true);

      replyDraft.request({ routingKey: 'reply.one', correlationId: 'c1' });
      fixture.detectChanges();
      component.payload.set('half-written reply');

      replyDraft.request({ routingKey: 'reply.two', correlationId: 'c2' });
      fixture.detectChanges();

      expect(component.routingKey()).toBe('reply.two');
      expect(component.correlationId()).toBe('c2');
      expect(component.payload()).toBe('');
    });

    it('a clean panel applies the reply pre-fill with no confirmation prompt', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      const replyDraft = TestBed.inject(ReplyDraftService);
      const confirmSpy = vi.spyOn(component, 'confirmOverwrite');

      replyDraft.request({ routingKey: 'reply.one', correlationId: 'c1' });
      fixture.detectChanges();
      replyDraft.request({ routingKey: 'reply.two', correlationId: 'c2' });
      fixture.detectChanges();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(component.routingKey()).toBe('reply.two');
    });

    it('confirmOverwrite() delegates to window.confirm', () => {
      const fixture = TestBed.createComponent(SendComponent);
      const component = fixture.componentInstance;
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      expect(component.confirmOverwrite()).toBe(true);
      expect(confirmSpy).toHaveBeenCalled();

      confirmSpy.mockReturnValue(false);
      expect(component.confirmOverwrite()).toBe(false);
    });
  });
});
