import { Injectable, signal } from '@angular/core';

/** The reply target handed from a received message to the reply drawer (design D4). */
export interface ReplyTarget {
  routingKey: string;
  correlationId: string | null;
  /**
   * Source message pinned at the top of the reply drawer (design D4). Optional so the existing
   * contract — and `reply-draft.service.spec.ts` — stay unchanged; only `MessagesComponent.respond`
   * populates it.
   */
  origin?: { queue: string; exchange: string; routingKey: string; payload: string; receivedAt: string };
}

/**
 * In-memory, root-provided bridge between {@link MessagesComponent}'s Responder action and
 * the reply drawer (design D4). Mirrors {@link ReplySubscriptionService}'s signal-based structure.
 * `seq` is bumped on every `request()` call so activating Responder twice for the same target
 * still re-fires the drawer's draft effect.
 */
@Injectable({ providedIn: 'root' })
export class ReplyDraftService {
  private readonly _draft = signal<{ target: ReplyTarget; seq: number } | null>(null);

  readonly draft = this._draft.asReadonly();

  request(target: ReplyTarget): void {
    this._draft.update((current) => ({ target, seq: (current?.seq ?? 0) + 1 }));
  }

  clear(): void {
    this._draft.set(null);
  }
}
