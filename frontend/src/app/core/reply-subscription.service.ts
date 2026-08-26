import { Injectable, signal } from '@angular/core';

/** A pending send-with-reply subscription, tracked by its subscription and correlation ids. */
export interface ReplySubscription {
  subscriptionId: string;
  correlationId: string;
}

/**
 * In-memory, root-provided state for pending send-with-reply subscriptions (mirrors
 * {@link SendHistoryService}'s signal-based structure). Kept fully separate from
 * `SubscriptionCoordinator`'s chip-based subscription list — no `kind` discriminator
 * (design: "No kind discriminator; separate ReplySubscriptionService").
 */
@Injectable({ providedIn: 'root' })
export class ReplySubscriptionService {
  private readonly _pending = signal<ReplySubscription[]>([]);

  readonly pending = this._pending.asReadonly();

  add(subscription: ReplySubscription): void {
    this._pending.update((current) => [...current, subscription]);
  }

  remove(subscriptionId: string): void {
    this._pending.update((current) => current.filter((s) => s.subscriptionId !== subscriptionId));
  }
}
