import { Component, computed, effect, inject, linkedSignal, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService, ReceivedMessage } from '../../core/bus-hub.service';
import { ReplySubscriptionService } from '../../core/reply-subscription.service';
import { ReplyDraftService } from '../../core/reply-draft.service';
import { ReplyDrawerComponent } from '../reply/reply-drawer.component';
import { JsonPrettyPipe } from './json-pretty.pipe';
import { queueColorIndex, QueueColor } from './queue-color';

/** One row of the reply panel: a pending send-with-reply subscription plus every message
 *  delivered on it so far, matched by `correlationId` (request-reply spec: "Reply Panel
 *  Filters Messages by CorrelationId"; "Multiple Replies Are Delivered Unguarded"). */
interface ReplyPanelEntry {
  subscriptionId: string;
  correlationId: string;
  replies: ReceivedMessage[];
}

/** Displayed rows plus which `seq`s are genuinely new since the last unpaused render, per
 *  ui-presentation: "New-Message Highlight Animation". */
interface DisplayState {
  rows: ReceivedMessage[];
  newSeqs: ReadonlySet<number>;
}

interface SubscriptionResponse {
  id: string;
}

/** An active subscribe-form entry, rendered as its own chip (ui-presentation spec: "Subscription
 *  Chip Row Renders Active Subscriptions With Live Counters"). */
interface Subscription {
  id: string;
  queueName: string;
}

/**
 * Subscribe-to-queue form + live incoming-message feed, pushed over SignalR
 * (message-consumption spec: "Live delivery" / "Invalid queue").
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule, JsonPrettyPipe, HlmButton, HlmInput, NgIcon, ReplyDrawerComponent],
  providers: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './messages.component.html',
})
export class MessagesComponent {
  private readonly api = inject(ApiClientService);
  private readonly busHub = inject(BusHubService);
  private readonly replySubscriptions = inject(ReplySubscriptionService);
  private readonly replyDraft = inject(ReplyDraftService);

  readonly queueName = signal('');
  readonly subscriptions = signal<Subscription[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly paused = signal(false);

  /** `seq` of the feed row whose reply drawer is currently open, so that row can render an accent
   *  ring + `[data-replying="true"]` (design D4 — "anchored to the message"). Cleared by the effect
   *  below as soon as the drawer clears the shared reply draft. */
  readonly replyingSeq = signal<number | null>(null);

  constructor() {
    effect(() => {
      if (this.replyDraft.draft() === null) {
        this.replyingSeq.set(null);
      }
    });
  }

  /** Blocks re-subscribing to a queue that already has an active chip (message-consumption
   *  spec: "Duplicate queueName is blocked"). */
  readonly isDuplicateQueue = computed(() =>
    this.subscriptions().some((s) => s.queueName === this.queueName()),
  );

  /** Per-chip live message count, derived from the same shared `busHub.messages()` signal —
   *  no separate BusHubService read API needed. */
  readonly chipCounts = computed(() => {
    const msgs = this.busHub.messages();
    return this.subscriptions().map((s) => ({
      id: s.id,
      queueName: s.queueName,
      count: msgs.filter((m) => m.subscriptionId === s.id).length,
    }));
  });

  readonly visibleMessages = computed(() => {
    const activeIds = new Set(this.subscriptions().map((s) => s.id));
    return this.busHub.messages().filter((m) => activeIds.has(m.subscriptionId));
  });

  /** `subscriptionId` → queue name, so a feed row can label itself with the queue it
   *  arrived on (the row DTO carries only `subscriptionId`). */
  private readonly queueNameById = computed(() => {
    const byId = new Map<string, string>();
    for (const s of this.subscriptions()) {
      byId.set(s.id, s.queueName);
    }
    return byId;
  });

  /** Queue name a feed row belongs to; empty only if its subscription was just torn down. */
  queueNameOf(message: ReceivedMessage): string {
    return this.queueNameById().get(message.subscriptionId) ?? '';
  }

  /** Palette slot (1..6) for a queue's tinted pill and dot (ui-presentation: "Queues Are
   *  Identified by a Tinted Pill and Dot"; design D5). Deterministic per name. */
  queueColor(queueName: string): QueueColor {
    return queueColorIndex(queueName);
  }

  /** Pill fill, pill text and solid-dot fill. The hue itself arrives through `--queue-hue`,
   *  set by the `[data-queue-color='N']` rule in styles.css — never a dynamic Tailwind class.
   *  Prototype `.qpill`: a dark chip (hue mixed toward ground) with the hue as the text colour
   *  and a solid-hue dot (`docs/redesign-prototype/Main.dc.html` — `qc()` / `mix(hue, ground, .82)`). */
  readonly queuePillTint = 'color-mix(in oklab, var(--queue-hue) 14%, var(--color-ground))';
  readonly queuePillText = 'var(--queue-hue)';
  readonly queueDotFill = 'var(--queue-hue)';

  /** Meta line under a feed row's header — `exchange: {value}`, with the AMQP default-exchange
   *  marker when the message carries no exchange (prototype `meta()`; C4 send-panel wording). */
  metaExchange(message: ReceivedMessage): string {
    return message.exchange || '(intercambio predeterminado)';
  }

  /** The `.empty` placeholder the feed shows instead of rows, mirroring the prototype's three
   *  states; `null` once there is at least one visible message. */
  readonly emptyFeedMessage = computed<string | null>(() => {
    if (this.subscriptions().length === 0) {
      return 'Suscribite a una cola para ver mensajes en vivo.';
    }
    if (this.displayedMessages().length === 0) {
      return 'Esperando mensajes…';
    }
    if (this.filteredMessages().length === 0) {
      return 'Ningún mensaje coincide con la búsqueda.';
    }
    return null;
  });

  /** Freezes rows while paused, resyncs instantly on resume, and diffs which `seq`s are new
   *  since the last unpaused render — see design.md decision #2. */
  private readonly displayState = linkedSignal<{ paused: boolean; rows: ReceivedMessage[] }, DisplayState>({
    source: () => ({ paused: this.paused(), rows: this.visibleMessages() }),
    computation: (current, previous) => {
      if (current.paused) {
        return previous?.value ?? { rows: current.rows, newSeqs: new Set() };
      }
      if (previous?.source.paused) {
        // Resume: instant catch-up, no highlight on the caught-up batch.
        return { rows: current.rows, newSeqs: new Set() };
      }
      const seen = new Set((previous?.value.rows ?? []).map((m) => m.seq));
      const newSeqs = new Set(current.rows.filter((m) => !seen.has(m.seq)).map((m) => m.seq));
      return { rows: current.rows, newSeqs };
    },
  });

  readonly displayedMessages = computed(() => this.displayState().rows);

  readonly filteredMessages = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const rows = this.displayedMessages();
    if (!term) {
      return rows;
    }
    return rows.filter(
      (m) =>
        m.payload.toLowerCase().includes(term) ||
        m.routingKey.toLowerCase().includes(term) ||
        m.exchange.toLowerCase().includes(term),
    );
  });

  /** Separate reply panel, kept out of `SubscriptionCoordinator`'s chip list — no `kind`
   *  discriminator (design.md decision: "No kind discriminator; separate ReplySubscriptionService").
   *  Matches on both `subscriptionId` and `correlationId` — `correlationId` alone would let a
   *  message with the same correlationId delivered on an unrelated active subscription (e.g. the
   *  sender's own request, echoed back because they're also subscribed to the queue they
   *  published to) be mistaken for a genuine reply. */
  readonly replyPanel = computed<ReplyPanelEntry[]>(() => {
    const msgs = this.busHub.messages();
    return this.replySubscriptions.pending().map((p) => ({
      subscriptionId: p.subscriptionId,
      correlationId: p.correlationId,
      replies: msgs.filter((m) => m.subscriptionId === p.subscriptionId && m.correlationId === p.correlationId),
    }));
  });

  togglePause(): void {
    this.paused.update((p) => !p);
  }

  /** Opens the reply drawer for this message via {@link ReplyDraftService} (request-reply spec:
   *  "Responder Action Opens a Reply Drawer Anchored to the Message"). Pins the source message as
   *  the drawer's `origin` and marks this row as the active reply. Works regardless of subscription
   *  state. Only reachable from a row whose `replyTo` is non-null (template `@if`). */
  respond(message: ReceivedMessage): void {
    if (!message.replyTo) {
      return;
    }
    this.replyDraft.request({
      routingKey: message.replyTo,
      correlationId: message.correlationId ?? null,
      origin: {
        exchange: message.exchange,
        routingKey: message.routingKey,
        payload: message.payload,
        // ReceivedMessage carries no receipt timestamp; stamp when the drawer is opened.
        receivedAt: new Date().toISOString(),
      },
    });
    this.replyingSeq.set(message.seq);
  }

  /** True while this row's reply drawer is open (design D4 — "anchored to the message"). */
  isReplying(message: ReceivedMessage): boolean {
    return this.replyingSeq() === message.seq;
  }

  isNewRow(message: ReceivedMessage): boolean {
    return this.displayState().newSeqs.has(message.seq);
  }

  subscribeToQueue(): void {
    // Defense-in-depth alongside the template's [disabled] binding: subscribeToQueue() can be
    // called directly (as tests do), so the guard must also live here (message-consumption
    // spec: "Duplicate queueName is blocked").
    if (this.isDuplicateQueue()) {
      return;
    }

    this.errorMessage.set(null);
    // Idempotent on the real service, so kicking it off here (in parallel with the POST below)
    // is safe even if a join elsewhere already triggered it. Establishes the SignalR connection
    // lazily on first subscribe rather than at app boot, so component-creation tests never
    // attempt a real network call. The join is sequenced behind this same promise (not fired
    // immediately) so it never races an in-flight connection start (regression: joining before
    // start() resolved intermittently failed with "No se pudo unir al grupo de suscripción").
    const hubReady = this.busHub.start();
    const queueName = this.queueName();
    this.api.post<SubscriptionResponse>('/api/subscriptions', { queueName }).subscribe({
      next: (response) => {
        this.subscriptions.update((current) => [...current, { id: response.id, queueName }]);
        // Unlike start(), a rejected join here leaves this chip rendered as subscribed while
        // silently receiving nothing — surface it instead of swallowing (message-consumption
        // spec: "Subscribe and Unsubscribe Failures Are Handled Without Unhandled Rejections").
        hubReady
          .then(() => this.busHub.joinSubscription(response.id))
          .catch((err: unknown) => {
            this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo unir al grupo de suscripción.'));
          });
      },
      error: (err: unknown) => {
        this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo suscribir a la cola.'));
      },
    });
  }

  unsubscribe(subscriptionId: string): void {
    this.api.delete(`/api/subscriptions/${subscriptionId}`).subscribe({
      next: () => this.finishUnsubscribe(subscriptionId),
      error: () => this.finishUnsubscribe(subscriptionId),
    });
  }

  private finishUnsubscribe(subscriptionId: string): void {
    this.busHub.leaveSubscription(subscriptionId).catch((err: unknown) => {
      this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo salir del grupo de suscripción.'));
    });
    this.busHub.clearSubscription(subscriptionId);
    this.subscriptions.update((current) => current.filter((s) => s.id !== subscriptionId));
  }

  /** Tears down a reply-panel entry. Reuses the existing `DELETE /api/subscriptions/{id}`
   *  endpoint verbatim (design.md: "reused verbatim for tearing down reply subscriptions —
   *  no new unsubscribe endpoint"). */
  unsubscribeReply(subscriptionId: string): void {
    this.api.delete(`/api/subscriptions/${subscriptionId}`).subscribe({
      next: () => this.finishUnsubscribeReply(subscriptionId),
      error: () => this.finishUnsubscribeReply(subscriptionId),
    });
  }

  private finishUnsubscribeReply(subscriptionId: string): void {
    this.busHub.leaveSubscription(subscriptionId).catch((err: unknown) => {
      this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo salir del grupo de suscripción.'));
    });
    this.busHub.clearSubscription(subscriptionId);
    this.replySubscriptions.remove(subscriptionId);
  }
}
