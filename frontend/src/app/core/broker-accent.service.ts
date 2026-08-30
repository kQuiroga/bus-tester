import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

/** Brokers the console can theme its accent for. Kafka is a reserved seam (design D10). */
export type BrokerKind = 'rabbitmq' | 'kafka';

/**
 * Publishes the connected broker onto `<html data-broker>` so the CSS accent
 * indirection (`--broker-accent` → `--color-accent`) resolves for the whole
 * document, including CDK overlays that render outside `app-root` (design D2).
 *
 * Root-provided and mirrors {@link ReplyDraftService}'s signal shape. Nothing
 * sets `'kafka'` yet — the Kafka track (#143) only has to call {@link setBroker}.
 */
@Injectable({ providedIn: 'root' })
export class BrokerAccentService {
  private readonly document = inject(DOCUMENT);
  private readonly _broker = signal<BrokerKind>('rabbitmq');

  /** The broker currently driving the accent color. */
  readonly broker = this._broker.asReadonly();

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['broker'] = this._broker();
    });
  }

  setBroker(broker: BrokerKind): void {
    this._broker.set(broker);
  }
}
