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

  it('emits connectSubmit when the credentials form is submitted', () => {
    const fixture = render({ connected: false });
    let submitted = 0;
    fixture.componentInstance.connectSubmit.subscribe(() => (submitted += 1));
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(
      new Event('submit'),
    );
    expect(submitted).toBe(1);
  });

  it('shows Desconectar and Cambiar broker with NO credential fields while connected', () => {
    const fixture = render({ connected: true });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('input').length).toBe(0);
    const labels = buttons(fixture).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('Desconectar'))).toBe(true);
    expect(labels.some((l) => l.includes('Cambiar broker'))).toBe(true);
  });

  it('never presents credential inputs while connected, even after a previous error', () => {
    const fixture = render({ connected: true, errorMessage: 'boom' });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input').length).toBe(0);
  });

  it('emits disconnect and changeBroker from the connected-state controls', () => {
    const fixture = render({ connected: true });
    let disc = 0;
    let chg = 0;
    fixture.componentInstance.disconnect.subscribe(() => (disc += 1));
    fixture.componentInstance.changeBroker.subscribe(() => (chg += 1));
    buttons(fixture).find((b) => b.textContent?.includes('Desconectar'))!.click();
    buttons(fixture).find((b) => b.textContent?.includes('Cambiar broker'))!.click();
    expect(disc).toBe(1);
    expect(chg).toBe(1);
  });

  it('shows the pending badge while a request is in flight', () => {
    const fixture = render({ connected: false, pending: true });
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="connect-dialog-status"]',
    );
    expect(badge?.textContent).toContain('Conectando');
  });
});
