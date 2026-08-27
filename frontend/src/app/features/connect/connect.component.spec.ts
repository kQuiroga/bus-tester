import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BUS_HUB_CONNECTION } from '../../core/bus-hub.service';
import { FakeHubConnection } from '../../core/testing/fake-hub-connection';
import { ConnectComponent } from './connect.component';

describe('ConnectComponent', () => {
  let httpMock: HttpTestingController;
  let fakeHubConnection: FakeHubConnection;

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
  });

  afterEach(() => httpMock.verify());

  it('submits host/port/credentials as POST /api/connections and marks the connection active on success', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('localhost');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'));
    expect(req.request.body).toEqual({ host: 'localhost', port: 5672, username: 'guest', password: 'guest' });
    req.flush(null);

    expect(component.connected()).toBe(true);
    expect(component.errorMessage()).toBeNull();
  });

  it('shows the broker error and keeps the connection inactive when the broker is unreachable', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('unreachable-host');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'));
    req.flush(
      { title: 'Broker connection failed', detail: 'Could not connect to RabbitMQ at unreachable-host:5672.' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(component.connected()).toBe(false);
    expect(component.errorMessage()).toContain('Could not connect to RabbitMQ');
  });

  it('disconnect() calls DELETE /api/connections and clears the active state', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.connected.set(true);

    component.disconnect();

    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/connections'));
    req.flush(null);

    expect(component.connected()).toBe(false);
  });

  it('disables the Connect button while the connect POST is pending, re-enables once the request settles', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const connectButton = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(connectButton.disabled).toBe(false);

    component.connect();
    fixture.detectChanges();
    expect(connectButton.disabled).toBe(true);

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'));
    req.flush(
      { title: 'Broker connection failed', detail: 'Could not connect to RabbitMQ at unreachable-host:5672.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();

    expect(connectButton.disabled).toBe(false);
  });

  it('disables the Disconnect button while the disconnect DELETE is pending', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.connected.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const disconnectButton = compiled.querySelector('button[type="button"]') as HTMLButtonElement;
    expect(disconnectButton.disabled).toBe(false);

    component.disconnect();
    fixture.detectChanges();
    expect(disconnectButton.disabled).toBe(true);

    const req = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/connections'));
    req.flush(null);
    fixture.detectChanges();

    expect(component.pending()).toBe(false);
  });

  it('clears pending on both success and error settlement for connect and disconnect', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;

    component.connect();
    expect(component.pending()).toBe(true);
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections')).flush(null);
    expect(component.pending()).toBe(false);

    component.connect();
    expect(component.pending()).toBe(true);
    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'))
      .flush({ title: 'err', detail: 'nope' }, { status: 503, statusText: 'Service Unavailable' });
    expect(component.pending()).toBe(false);

    component.connected.set(true);
    component.disconnect();
    expect(component.pending()).toBe(true);
    httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/connections')).flush(null);
    expect(component.pending()).toBe(false);

    component.connected.set(true);
    component.disconnect();
    expect(component.pending()).toBe(true);
    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/connections'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(component.pending()).toBe(false);
  });

  it('hides hub status while BusHubService.connectionState is idle', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="hub-status"]')).toBeNull();
  });

  it('renders hub status once connectionState leaves idle, independent of the broker connected() state', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.connected.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="hub-status"]')).toBeNull();

    fakeHubConnection.triggerClose();
    fixture.detectChanges();

    const hubStatus = compiled.querySelector('[data-testid="hub-status"]');
    expect(hubStatus?.textContent).toContain('Desconectado');
    // Broker (connected()) is still true — hub status reflects hub state, not broker state.
    expect(component.connected()).toBe(true);
  });

  it('renders hub reconnecting status inline next to the broker status, not as a separate banner', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('localhost');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');
    component.connect();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections')).flush(null);
    fixture.detectChanges();

    fakeHubConnection.triggerReconnecting();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brokerStatus = compiled.querySelector('[data-testid="broker-status"]');
    const hubStatus = compiled.querySelector('[data-testid="hub-status"]');
    expect(hubStatus?.textContent).toContain('Reconectando');
    expect(brokerStatus).not.toBeNull();
    expect(hubStatus?.parentElement).toBe(brokerStatus?.parentElement);
  });

  it('renders the broker "Connected" copy as a last-known snapshot, never implying live continuity (connection-status spec: "Broker state never implies live continuity")', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('localhost');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections')).flush(null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brokerStatus = compiled.querySelector('[data-testid="broker-status"]');
    expect(brokerStatus?.textContent).toContain('último conocido');
  });

  it('renders the broker pending status with the warn token class (ui-presentation spec: "Pending/reconnecting status uses the warn token")', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('localhost');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brokerStatus = compiled.querySelector('[data-testid="broker-status"]');
    expect(brokerStatus?.getAttribute('data-slot')).toBe('badge');
    expect(brokerStatus?.className).toContain('text-status-warn');
    expect(brokerStatus?.className).toContain('bg-status-warn-bg');

    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections')).flush(null);
    fixture.detectChanges();
  });

  it('renders the hub reconnecting status with the warn token class (ui-presentation spec: "Pending/reconnecting status uses the warn token")', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();

    fakeHubConnection.triggerReconnecting();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const hubStatus = compiled.querySelector('[data-testid="hub-status"]');
    expect(hubStatus?.getAttribute('data-slot')).toBe('badge');
    expect(hubStatus?.className).toContain('text-status-warn');
    expect(hubStatus?.className).toContain('bg-status-warn-bg');
  });

  it('renders the four connection fields via hlmLabel + hlmInput and both actions via hlmBtn', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('label[data-slot="label"]').length).toBe(4);
    expect(compiled.querySelectorAll('input[data-slot="input"]').length).toBe(4);
    expect(compiled.querySelector('button[type="submit"][data-slot="button"]')).not.toBeNull();
    expect(compiled.querySelector('button[type="button"][data-slot="button"]')).not.toBeNull();
  });

  it('renders Desconectar with the secondary (non-destructive) hlmBtn variant, not destructive', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const disconnectButton = compiled.querySelector('button[type="button"]') as HTMLButtonElement;

    expect(disconnectButton.className).toContain('bg-secondary');
    expect(disconnectButton.className).not.toContain('bg-destructive');
  });

  it('renders the broker error message via hlmBadge, preserving the data-testid and error status tokens', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('unreachable-host');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();
    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'));
    req.flush(
      { title: 'Broker connection failed', detail: 'Could not connect to RabbitMQ at unreachable-host:5672.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brokerError = compiled.querySelector('[data-testid="broker-error"]');
    expect(brokerError?.getAttribute('data-slot')).toBe('badge');
    expect(brokerError?.className).toContain('bg-status-error-bg');
    expect(brokerError?.className).toContain('text-status-error');
  });

  it('renders a status icon inside the broker-status badge, swapping from pending to ok', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('localhost');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const brokerStatusPending = compiled.querySelector('[data-testid="broker-status"]');
    expect(brokerStatusPending?.querySelector('ng-icon[name="lucideLoaderCircle"]')).not.toBeNull();

    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections')).flush(null);
    fixture.detectChanges();
    const brokerStatusOk = compiled.querySelector('[data-testid="broker-status"]');
    expect(brokerStatusOk?.querySelector('ng-icon[name="lucideCircleCheck"]')).not.toBeNull();
  });

  it('renders the lucideCircleX icon inside the broker-error badge', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    component.host.set('unreachable-host');
    component.port.set(5672);
    component.username.set('guest');
    component.password.set('guest');

    component.connect();
    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/connections'))
      .flush({ title: 'Broker connection failed', detail: 'Could not connect.' }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brokerError = compiled.querySelector('[data-testid="broker-error"]');
    expect(brokerError?.querySelector('ng-icon[name="lucideCircleX"]')).not.toBeNull();
  });

  it('renders the hub-status icon reflecting reconnecting (pending) vs disconnected (error) state', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    fakeHubConnection.triggerReconnecting();
    fixture.detectChanges();
    let hubStatus = compiled.querySelector('[data-testid="hub-status"]');
    expect(hubStatus?.querySelector('ng-icon[name="lucideLoaderCircle"]')).not.toBeNull();

    fakeHubConnection.triggerClose();
    fixture.detectChanges();
    hubStatus = compiled.querySelector('[data-testid="hub-status"]');
    expect(hubStatus?.querySelector('ng-icon[name="lucideCircleX"]')).not.toBeNull();
  });

  it('never calls BusHubService.start() — hub connection ownership stays with MessagesComponent (connection-status spec: "ConnectComponent never starts the hub")', () => {
    // Characterization/approval test: ConnectComponent injects BusHubService only to read
    // connectionState(), never to start/stop the underlying connection. Renders standalone (no
    // MessagesComponent in the tree) and proves the shared FakeHubConnection was never started.
    const fixture = TestBed.createComponent(ConnectComponent);

    fixture.detectChanges();

    expect(fakeHubConnection.started).toBe(false);
  });
});
