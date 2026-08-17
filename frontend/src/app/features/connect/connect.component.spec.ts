import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConnectComponent } from './connect.component';

describe('ConnectComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
});
