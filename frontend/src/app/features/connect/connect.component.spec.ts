import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BUS_HUB_CONNECTION } from '../../core/bus-hub.service';
import { BrokerAccentService } from '../../core/broker-accent.service';
import { FakeHubConnection } from '../../core/testing/fake-hub-connection';
import { ConnectComponent } from './connect.component';

describe('ConnectComponent (container)', () => {
  let httpMock: HttpTestingController;
  let fakeHubConnection: FakeHubConnection;
  let brokerAccent: BrokerAccentService;

  beforeEach(async () => {
    fakeHubConnection = new FakeHubConnection();
    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: BUS_HUB_CONNECTION, useValue: fakeHubConnection },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    brokerAccent = TestBed.inject(BrokerAccentService);
  });

  afterEach(() => httpMock.verify());

  function flushConnect(ok = true) {
    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'));
    if (ok) {
      req.flush(null);
    } else {
      req.flush({ title: 'x', detail: 'nope' }, { status: 503, statusText: 'Service Unavailable' });
    }
  }

  async function settleOverlay(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function dialogBody() {
    return document.querySelector('app-connect-dialog');
  }

  it('auto-opens the connect popup on load while there is no broker connection', async () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    await settleOverlay(fixture);
    expect(fixture.componentInstance.connectDialogOpen()).toBe(true);
    expect(dialogBody()).not.toBeNull();
  });

  it('dismisses the popup and sets the RabbitMQ accent after a successful connect', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();

    fixture.componentInstance.connect();
    flushConnect(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.connected()).toBe(true);
    expect(fixture.componentInstance.connectDialogOpen()).toBe(false);
    expect(brokerAccent.broker()).toBe('rabbitmq');
  });

  it('keeps the popup open on a failed connect', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();

    fixture.componentInstance.connect();
    flushConnect(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.connected()).toBe(false);
    expect(fixture.componentInstance.connectDialogOpen()).toBe(true);
    expect(fixture.componentInstance.errorMessage()).toContain('nope');
  });

  it('re-opens the same popup when the status pill is activated', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    fixture.componentInstance.connect();
    flushConnect(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.connectDialogOpen()).toBe(false);

    const pill = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="broker-status-pill"]',
    );
    expect(pill).not.toBeNull();
    pill!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.connectDialogOpen()).toBe(true);
  });

  it('shows disconnect/switch controls and no credential fields once connected', async () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    fixture.componentInstance.connect();
    flushConnect(true);
    fixture.detectChanges();

    fixture.componentInstance.openConnectDialog();
    fixture.detectChanges();
    await settleOverlay(fixture);

    const body = dialogBody();
    expect(body).not.toBeNull();
    expect(body!.querySelectorAll('input').length).toBe(0);
    expect(body!.textContent).toContain('Desconectar');
    expect(body!.textContent).toContain('Cambiar a Apache Kafka');
  });

  it('changeBroker() drops the connection (DELETE) and keeps the popup open for re-entry', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    fixture.componentInstance.connect();
    flushConnect(true);
    fixture.detectChanges();

    fixture.componentInstance.changeBroker();
    const del = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.url.endsWith('/api/connections'),
    );
    del.flush(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.connected()).toBe(false);
    expect(fixture.componentInstance.connectDialogOpen()).toBe(true);
    expect(brokerAccent.broker()).toBeNull();
  });

  it('disconnect() clears the broker accent back to neutral', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    fixture.componentInstance.connect();
    flushConnect(true);
    fixture.detectChanges();
    expect(brokerAccent.broker()).toBe('rabbitmq');

    fixture.componentInstance.disconnect();
    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/connections'))
      .flush(null);
    fixture.detectChanges();

    expect(brokerAccent.broker()).toBeNull();
  });

  it('renders a reserved broker-selector slot beside the pill that is inert and non-focusable', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();

    const slot = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="broker-selector-slot"]',
    );
    expect(slot).not.toBeNull();
    expect(slot!.getAttribute('aria-hidden')).toBe('true');
    expect(slot!.getAttribute('tabindex')).toBe('-1');

    slot!.click();
    httpMock.expectNone(() => true);
  });

  it('renders the reserved slot as the prototype broker pill: "RabbitMQ ▾", accent dot, inert', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();

    const slot = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="broker-selector-slot"]',
    );
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toContain('RabbitMQ');
    expect(slot!.textContent).toContain('▾');
    expect(slot!.getAttribute('aria-disabled')).toBe('true');
    expect(slot!.className).toContain('rounded-full');
    const dot = slot!.querySelector<HTMLElement>('[data-testid="broker-selector-slot-dot"]');
    expect(dot).not.toBeNull();
    expect(dot!.className).toContain('bg-accent');
  });

  it('never starts the SignalR hub — ownership stays with MessagesComponent', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    expect(fakeHubConnection.started).toBe(false);
  });
});
