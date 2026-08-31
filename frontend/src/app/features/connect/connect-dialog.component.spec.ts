import { TestBed } from '@angular/core/testing';
import { ConnectDialogComponent } from './connect-dialog.component';

type DialogInputs = {
  connected: boolean;
  pending: boolean;
  errorMessage: string | null;
};

describe('ConnectDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConnectDialogComponent] }).compileComponents();
  });

  function render(inputs: Partial<DialogInputs> = {}) {
    const fixture = TestBed.createComponent(ConnectDialogComponent);
    fixture.componentRef.setInput('connected', inputs.connected ?? false);
    fixture.componentRef.setInput('pending', inputs.pending ?? false);
    fixture.componentRef.setInput('errorMessage', inputs.errorMessage ?? null);
    fixture.detectChanges();
    return fixture;
  }

  function buttons(fixture: ReturnType<typeof render>) {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  }

  it('renders the four credential fields and a Conectar submit while disconnected', () => {
    const fixture = render({ connected: false });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('input[data-slot="input"]').length).toBe(4);
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Conectar');
  });

  it('titles the dialog "Conectar a RabbitMQ" while disconnected and "Conexión · RabbitMQ" once connected', () => {
    expect(
      (render({ connected: false }).nativeElement as HTMLElement).querySelector('h2')?.textContent,
    ).toContain('Conectar a RabbitMQ');
    expect(
      (render({ connected: true }).nativeElement as HTMLElement).querySelector('h2')?.textContent,
    ).toContain('Conexión · RabbitMQ');
  });

  it('shows the prototype disconnected hint about the broker-following accent', () => {
    const text = (render({ connected: false }).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No estás conectado. El acento sigue al broker');
    expect(text).toContain('ámbar para RabbitMQ, azul para Kafka');
  });

  it('applies the shared .field-label treatment to all four credential labels', () => {
    const labels = [
      ...(render({ connected: false }).nativeElement as HTMLElement).querySelectorAll('label'),
    ];
    expect(labels.length).toBe(4);
    expect(labels.every((l) => l.classList.contains('field-label'))).toBe(true);
  });

  it('renders a full-width "Cambiar a Apache Kafka" affordance that is inert until the Kafka track lands', () => {
    const btn = [
      ...(render({ connected: false }).nativeElement as HTMLElement).querySelectorAll('button'),
    ].find((b) => b.textContent?.includes('Cambiar a Apache Kafka'));
    expect(btn).toBeTruthy();
    expect(btn!.disabled).toBe(true);
  });

  it('emits connectSubmit when the credentials form is submitted', () => {
    const fixture = render({ connected: false });
    let submitted = 0;
    fixture.componentInstance.connectSubmit.subscribe(() => (submitted += 1));
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(
      new Event('submit'),
    );
    expect(submitted).toBe(1);
  });

  it('shows Desconectar and the Kafka switch affordance with NO credential fields while connected', () => {
    const fixture = render({ connected: true });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('input').length).toBe(0);
    const labels = buttons(fixture).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('Desconectar'))).toBe(true);
    expect(labels.some((l) => l.includes('Cambiar a Apache Kafka'))).toBe(true);
  });

  it('never presents credential inputs while connected, even after a previous error', () => {
    const fixture = render({ connected: true, errorMessage: 'boom' });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input').length).toBe(0);
  });

  it('emits disconnect from the connected-state control', () => {
    const fixture = render({ connected: true });
    let disc = 0;
    fixture.componentInstance.disconnect.subscribe(() => (disc += 1));
    buttons(fixture).find((b) => b.textContent?.includes('Desconectar'))!.click();
    expect(disc).toBe(1);
  });

  it('keeps the Kafka switch affordance disabled while connected too', () => {
    const fixture = render({ connected: true });
    const btn = buttons(fixture).find((b) => b.textContent?.includes('Cambiar a Apache Kafka'));
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the pending badge while a request is in flight', () => {
    const fixture = render({ connected: false, pending: true });
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="connect-dialog-status"]',
    );
    expect(badge?.textContent).toContain('Conectando');
  });
});
