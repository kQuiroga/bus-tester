import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { SendComponent } from './send.component';
import { SendHistoryService } from './send-history.service';

const RECENT_SENDS_KEY = 'send-panel.recent-sends';
const TEMPLATES_KEY = 'send-panel.templates';

describe('SendComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(RECENT_SENDS_KEY);
    localStorage.removeItem(TEMPLATES_KEY);
    await TestBed.configureTestingModule({
      imports: [SendComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

    expect(component.confirmation()).toBe('Mensaje enviado.');
    expect(component.errorMessage()).toBeNull();
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

    expect(component.errorMessage()).toContain("Could not publish to exchange 'missing-exchange'");
    expect(component.confirmation()).toBeNull();
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

    expect(component.confirmation()).toBe('Mensaje enviado.');
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

  it('deleteTemplate(name) removes the template from SendHistoryService', () => {
    const fixture = TestBed.createComponent(SendComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    history.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'a', payload: 'p' });

    component.deleteTemplate('my-template');

    expect(history.templates()).toEqual([]);
  });
});
