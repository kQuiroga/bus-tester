import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService } from '../../core/bus-hub.service';

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
  imports: [FormsModule],
  templateUrl: './messages.component.html',
})
export class MessagesComponent {
  private readonly api = inject(ApiClientService);
  private readonly busHub = inject(BusHubService);

  readonly queueName = signal('');
  readonly subscriptionId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly visibleMessages = computed(() => {
    const activeId = this.subscriptionId();
    return activeId === null ? [] : this.busHub.messages().filter((m) => m.subscriptionId === activeId);
  });

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
