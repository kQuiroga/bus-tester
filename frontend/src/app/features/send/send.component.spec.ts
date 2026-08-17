import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SendComponent } from './send.component';

describe('SendComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

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

    expect(component.confirmation()).toBe('Message sent.');
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
});
