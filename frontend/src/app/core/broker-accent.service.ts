import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

/** Brokers the console can theme its accent for. Kafka is a reserved seam (design D10). */
export type BrokerKind = 'rabbitmq' | 'kafka';

/**
 * Publishes the connected broker onto `<html data-broker>` so the CSS accent
 * indirection (`--broker-accent` → `--color-accent`) resolves for the whole
 * document, including CDK overlays that render outside `app-root` (design D2).
 *
 * Root-provided and mirrors {@link ReplyDraftService}'s signal shape. The broker
 * starts as `null` — with nothing connected the accent stays neutral, never a
 * broker color (decision #167). No connection flow sets it yet; slice 2 wires
 * the real connect flow to {@link setBroker}.
 */
@Injectable({ providedIn: 'root' })
export class BrokerAccentService {
  private readonly document = inject(DOCUMENT);
  private readonly _broker = signal<BrokerKind | null>(null);

  /** The broker currently driving the accent color, or `null` when disconnected. */
  readonly broker = this._broker.asReadonly();

  constructor() {
    effect(() => {
      const broker = this._broker();
      const root = this.document.documentElement;
      if (broker === null) {
        delete root.dataset['broker'];
      } else {
        root.dataset['broker'] = broker;
      }
    });
  }

  setBroker(broker: BrokerKind | null): void {
    this._broker.set(broker);
  }
}
