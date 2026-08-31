import { TestBed } from '@angular/core/testing';
import type { HubConnectionState } from '../../core/bus-hub.service';
import { StatusPillComponent } from './status-pill.component';

type PillInputs = {
  connected: boolean;
  pending: boolean;
  errorMessage: string | null;
  hubState: HubConnectionState;
  endpoint: string;
};

describe('StatusPillComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatusPillComponent] }).compileComponents();
  });

  function render(inputs: Partial<PillInputs> = {}) {
    const fixture = TestBed.createComponent(StatusPillComponent);
    fixture.componentRef.setInput('connected', inputs.connected ?? false);
    fixture.componentRef.setInput('pending', inputs.pending ?? false);
    fixture.componentRef.setInput('errorMessage', inputs.errorMessage ?? null);
    fixture.componentRef.setInput('hubState', inputs.hubState ?? 'idle');
    fixture.componentRef.setInput('endpoint', inputs.endpoint ?? 'localhost:5672');
    fixture.detectChanges();
    return fixture;
  }

  function pill(fixture: ReturnType<typeof render>) {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="broker-status-pill"]',
    );
  }

  function dot(fixture: ReturnType<typeof render>) {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="broker-status-pill-dot"]',
    );
  }

  it('always renders a clickable pill button, even while disconnected and idle', () => {
    const fixture = render();
    const el = pill(fixture);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe('BUTTON');
  });

  it('emits activate when the pill is clicked', () => {
    const fixture = render();
    let count = 0;
    fixture.componentInstance.activate.subscribe(() => (count += 1));
    pill(fixture)!.click();
    expect(count).toBe(1);
  });

  it('shows a connected label with the broker endpoint once connected', () => {
    const fixture = render({ connected: true, endpoint: 'localhost:5672' });
    expect(pill(fixture)!.textContent).toContain('Conectado · localhost:5672');
  });

  it('shows a no-connection label while disconnected', () => {
    const fixture = render({ connected: false });
    expect(pill(fixture)!.textContent).toContain('Sin conexión');
  });

  it('renders the prototype pill chrome: rounded-full, border, card surface', () => {
    const cls = pill(render())!.className;
    expect(cls).toContain('rounded-full');
    expect(cls).toContain('border');
    expect(cls).toContain('bg-card');
  });

  it('renders a status dot tinted green when connected and red when disconnected', () => {
    expect(dot(render({ connected: true, hubState: 'connected' }))!.className).toContain(
      'bg-status-ok',
    );
    expect(dot(render({ connected: false }))!.className).toContain('bg-status-error');
  });

  it('renders the hub reconnecting state inline inside the pill, not as a separate banner', () => {
    const fixture = render({ connected: true, hubState: 'reconnecting' });
    const el = pill(fixture)!;
    expect(el.textContent).toContain('Reconectando');
    const inline = el.querySelector('[data-testid="hub-state-inline"]');
    expect(inline).not.toBeNull();
  });

  it('uses the warn token classes while a connect/disconnect request is pending', () => {
    const fixture = render({ pending: true });
    expect(pill(fixture)!.className).toContain('text-status-warn');
  });

  it('uses the ok token classes while connected and the hub is healthy', () => {
    const fixture = render({ connected: true, hubState: 'connected' });
    expect(pill(fixture)!.className).toContain('text-status-ok');
  });
});
