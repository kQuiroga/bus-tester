import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService, ReceivedMessage } from '../../core/bus-hub.service';
import { JsonPrettyPipe } from './json-pretty.pipe';

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
  imports: [FormsModule, JsonPrettyPipe],
  templateUrl: './messages.component.html',
})
export class MessagesComponent {
  private readonly api = inject(ApiClientService);
  private readonly busHub = inject(BusHubService);

  readonly queueName = signal('');
  readonly subscriptions = signal<Subscription[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly paused = signal(false);

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

  togglePause(): void {
    this.paused.update((p) => !p);
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
    // Fire-and-forget: idempotent on the real service, harmless no-op against the fake used in
    // tests. Establishes the SignalR connection lazily on first subscribe rather than at app
    // boot, so component-creation tests never attempt a real network call.
    this.busHub.start().catch(() => {});
    const queueName = this.queueName();
    this.api.post<SubscriptionResponse>('/api/subscriptions', { queueName }).subscribe({
      next: (response) => {
        this.subscriptions.update((current) => [...current, { id: response.id, queueName }]);
        // Unlike start(), a rejected join here leaves this chip rendered as subscribed while
        // silently receiving nothing — surface it instead of swallowing (message-consumption
        // spec: "Subscribe and Unsubscribe Failures Are Handled Without Unhandled Rejections").
        this.busHub.joinSubscription(response.id).catch((err: unknown) => {
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
}
