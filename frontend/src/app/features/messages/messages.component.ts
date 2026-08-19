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
  readonly subscriptionId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly paused = signal(false);

  readonly visibleMessages = computed(() => {
    const activeId = this.subscriptionId();
    return activeId === null ? [] : this.busHub.messages().filter((m) => m.subscriptionId === activeId);
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
    this.errorMessage.set(null);
    // Fire-and-forget: idempotent on the real service, harmless no-op against the fake used in
    // tests. Establishes the SignalR connection lazily on first subscribe rather than at app
    // boot, so component-creation tests never attempt a real network call.
    this.busHub.start().catch(() => {});
    this.api.post<SubscriptionResponse>('/api/subscriptions', { queueName: this.queueName() }).subscribe({
      next: (response) => {
        this.subscriptionId.set(response.id);
        this.busHub.joinSubscription(response.id);
      },
      error: (err: unknown) => {
        this.errorMessage.set(ApiClientService.errorDetail(err, 'Could not subscribe to the queue.'));
      },
    });
  }

  unsubscribe(): void {
    const activeId = this.subscriptionId();
    if (activeId === null) {
      return;
    }

    this.api.delete(`/api/subscriptions/${activeId}`).subscribe({
      next: () => this.finishUnsubscribe(activeId),
      error: () => this.finishUnsubscribe(activeId),
    });
  }

  private finishUnsubscribe(subscriptionId: string): void {
    this.busHub.leaveSubscription(subscriptionId);
    this.busHub.clear();
    this.subscriptionId.set(null);
  }
}
