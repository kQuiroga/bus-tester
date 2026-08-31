import { vi } from 'vitest';

vi.mock('@spartan-ng/brain/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { toast } from '@spartan-ng/brain/sonner';
import { ReplyDraftService, ReplyTarget } from '../../core/reply-draft.service';
import { queueColorIndex } from '../messages/queue-color';
import { SendHistoryService } from '../send/send-history.service';
import { ReplyDrawerComponent } from './reply-drawer.component';

const RECENT_SENDS_KEY = 'send-panel.recent-sends';

const ORIGIN: NonNullable<ReplyTarget['origin']> = {
  queue: 'orders.created',
  exchange: 'orders',
  routingKey: 'orders.created',
  payload: '{"id":7}',
  receivedAt: '2026-08-31T10:00:00.000Z',
};

describe('ReplyDrawerComponent', () => {
  let httpMock: HttpTestingController;
  let replyDraft: ReplyDraftService;

  beforeEach(async () => {
    localStorage.removeItem(RECENT_SENDS_KEY);
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ReplyDrawerComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    replyDraft = TestBed.inject(ReplyDraftService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(RECENT_SENDS_KEY);
    for (const node of Array.from(document.querySelectorAll('[data-testid="reply-drawer"]'))) {
      node.closest('.cdk-overlay-container, body')?.querySelector('[data-testid="reply-drawer"]')?.remove();
    }
  });

  async function settleOverlay(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function drawerBody(): HTMLElement | null {
    return document.querySelector('[data-testid="reply-drawer"]');
  }

  function request(target: ReplyTarget): void {
    replyDraft.request(target);
  }

  it('is closed with no drawer body while there is no reply draft', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(drawerBody()).toBeNull();
  });

  it('opens with the original message pinned at the top when a reply is requested', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-1', correlationId: 'corr-1', origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    expect(fixture.componentInstance.open()).toBe(true);
    const body = drawerBody();
    expect(body).not.toBeNull();
    const pinned = body!.querySelector('[data-testid="reply-origin"]');
    expect(pinned).not.toBeNull();
    expect(pinned!.textContent).toContain('orders.created');
    expect(pinned!.textContent).toContain('"id": 7');
  });

  it('pre-fills the routing key read-only, keeps Exchange empty, and leaves the payload blank', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-2', correlationId: 'corr-2', origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    const component = fixture.componentInstance;
    expect(component.routingKey()).toBe('amq.gen-reply-2');
    expect(component.correlationId()).toBe('corr-2');
    expect(component.exchange).toBe('');
    expect(component.payload()).toBe('');

    // The prototype drawer shows the routing key inside the pinned "Mensaje original" box,
    // not as its own editable field.
    const pinned = drawerBody()!.querySelector('[data-testid="reply-origin"]');
    expect(pinned!.textContent).toContain('orders.created');
  });

  it('renders a readonly, mono Correlation ID input pre-filled from the source message', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-2b', correlationId: 'corr-2b', origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    const corrInput = drawerBody()!.querySelector<HTMLInputElement>('[data-testid="reply-correlation-id"]');
    expect(corrInput).not.toBeNull();
    expect(corrInput!.readOnly).toBe(true);
    expect(corrInput!.value).toBe('corr-2b');
  });

  it('renders the readonly Correlation ID input even when the source message had none', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-3', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    expect(fixture.componentInstance.correlationId()).toBe('');
    const corrInput = drawerBody()!.querySelector<HTMLInputElement>('[data-testid="reply-correlation-id"]');
    expect(corrInput).not.toBeNull();
    expect(corrInput!.readOnly).toBe(true);
    expect(corrInput!.value).toBe('');
  });

  it('applies the shared .field-label treatment to the three drawer labels', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-lbl', correlationId: 'corr-lbl', origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    const labels = Array.from(drawerBody()!.querySelectorAll('.field-label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(expect.arrayContaining(['Mensaje original', 'Correlation ID', 'Payload de respuesta']));
  });

  it('tints the pinned original-message box with a left border in the source queue hue', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-hue', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    const body = drawerBody()!;
    const content = body.matches('[data-testid="reply-drawer"]') ? body : body.closest('[data-testid="reply-drawer"]')!;
    expect(content.getAttribute('data-queue-color')).toBe(String(queueColorIndex(ORIGIN.queue)));

    const originBox = body.querySelector<HTMLElement>('[data-testid="reply-origin"]')!;
    expect(originBox.style.borderLeftColor).toContain('--queue-hue');
  });

  it('shows the caption reminding that the Send panel keeps its draft', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-cap', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    expect(drawerBody()!.textContent).toContain('El panel de Enviar queda intacto con tu borrador.');
  });

  it('labels the submit control "Enviar respuesta"', async () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-send-lbl', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    await settleOverlay(fixture);

    const send = drawerBody()!.querySelector('[data-testid="reply-send"]');
    expect(send!.textContent?.trim()).toBe('Enviar respuesta');
  });

  it('accepts its own empty Exchange as the AMQP default exchange (no inline error)', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-4', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();

    expect(fixture.componentInstance.exchange).toBe('');
    expect(fixture.componentInstance.exchangeError()).toBeNull();
  });

  it('blocks send while the payload is blank', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    fixture.detectChanges();
    request({ routingKey: 'amq.gen-reply-5', correlationId: 'corr-5', origin: ORIGIN });
    fixture.detectChanges();

    fixture.componentInstance.send();

    httpMock.expectNone((r) => r.url.endsWith('/api/messages'));
    expect(fixture.componentInstance.payloadError()).toBe('El payload es obligatorio.');
  });

  it('sends its own POST /api/messages with an empty exchange plus the correlationId, and records the send', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    const component = fixture.componentInstance;
    const history = TestBed.inject(SendHistoryService);
    const recordSpy = vi.spyOn(history, 'recordSend');
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-6', correlationId: 'corr-6', origin: ORIGIN });
    fixture.detectChanges();
    component.payload.set('{"ok":true}');

    component.send();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
    expect(req.request.body).toEqual({
      exchange: '',
      routingKey: 'amq.gen-reply-6',
      payload: '{"ok":true}',
      headers: {},
      correlationId: 'corr-6',
    });
    req.flush(null);

    expect(recordSpy).toHaveBeenCalledWith({ exchange: '', routingKey: 'amq.gen-reply-6', payload: '{"ok":true}', headers: {} });
    expect(toast.success).toHaveBeenCalled();
  });

  it('omits the correlationId key entirely when the source message had none', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-7', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    component.payload.set('{"ok":true}');

    component.send();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages'));
    expect('correlationId' in (req.request.body as Record<string, unknown>)).toBe(false);
    req.flush(null);
  });

  it('clears the reply draft after a successful send', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    request({ routingKey: 'amq.gen-reply-8', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    component.payload.set('done');

    component.send();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/messages')).flush(null);

    expect(replyDraft.draft()).toBeNull();
    expect(component.open()).toBe(false);
  });

  it('close() clears the reply draft via ReplyDraftService', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    const component = fixture.componentInstance;
    const clearSpy = vi.spyOn(replyDraft, 'clear');
    fixture.detectChanges();
    request({ routingKey: 'amq.gen-reply-9', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();

    component.close();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(replyDraft.draft()).toBeNull();
  });

  it('reacts to the sheet reporting a closed state by clearing the draft', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    request({ routingKey: 'amq.gen-reply-10', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();

    component.onStateChange('closed');

    expect(replyDraft.draft()).toBeNull();
  });

  it('resets a stale payload when a new reply target arrives', () => {
    const fixture = TestBed.createComponent(ReplyDrawerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    request({ routingKey: 'amq.gen-reply-11', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();
    component.payload.set('half-written');

    request({ routingKey: 'amq.gen-reply-12', correlationId: null, origin: ORIGIN });
    fixture.detectChanges();

    expect(component.payload()).toBe('');
  });
});
