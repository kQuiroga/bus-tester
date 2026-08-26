import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService } from '../../core/bus-hub.service';
import { ReplySubscriptionService } from '../../core/reply-subscription.service';
import { RecentSend, SendHistoryService, SendTemplate } from './send-history.service';

type SendField = 'exchange' | 'routingKey' | 'payload';

/** Response body of `POST /api/messages/with-reply` (design.md: Api Interfaces / Contracts). */
interface SendWithReplyResponse {
  subscriptionId: string;
  correlationId: string;
}

/**
 * Send-message form (exchange, routing key, payload) publishing on the active connection
 * (message-sending spec: "Successful publish" / "Invalid exchange or no connection";
 * ui-presentation spec: "Send Panel Validates Exchange and Payload as Required",
 * "Send Panel Validates Routing Key as Optional-If-Present", "Submit Is Gated on Form Validity").
 */
@Component({
  selector: 'app-send',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './send.component.html',
})
export class SendComponent {
  private readonly api = inject(ApiClientService);
  private readonly busHub = inject(BusHubService);
  private readonly replySubscriptions = inject(ReplySubscriptionService);
  readonly history = inject(SendHistoryService);

  readonly exchange = signal('');
  readonly routingKey = signal('');
  readonly payload = signal('');
  readonly confirmation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly touched = signal<Set<SendField>>(new Set());
  readonly templateName = signal('');
  /** "Expect a reply" toggle (request-reply spec: "Request a Reply via Auto-Created Temp Queue"). */
  readonly expectReply = signal(false);

  readonly exchangeError = computed(() => (this.exchange().trim() === '' ? 'El exchange es obligatorio.' : null));
  readonly payloadError = computed(() => (this.payload().trim() === '' ? 'El payload es obligatorio.' : null));
  readonly routingKeyError = computed(() =>
    this.routingKey() !== '' && this.routingKey().trim() === '' ? 'La clave de enrutamiento no puede estar en blanco.' : null,
  );
  readonly hasErrors = computed(
    () => this.exchangeError() !== null || this.payloadError() !== null || this.routingKeyError() !== null,
  );

  onBlur(field: SendField): void {
    this.touched.update((current) => new Set(current).add(field));
  }

  send(): void {
    if (this.hasErrors()) {
      this.touched.set(new Set<SendField>(['exchange', 'routingKey', 'payload']));
      return;
    }

    this.confirmation.set(null);
    this.errorMessage.set(null);
    const exchange = this.exchange();
    const routingKey = this.routingKey();
    const payload = this.payload();

    if (this.expectReply()) {
      this.sendWithReply(exchange, routingKey, payload);
      return;
    }

    this.api
      .post('/api/messages', { exchange, routingKey, payload })
      .subscribe({
        next: () => {
          this.confirmation.set('Mensaje enviado.');
          this.history.recordSend({ exchange, routingKey, payload });
        },
        error: (err: unknown) => {
          this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo enviar el mensaje.'));
        },
      });
  }

  /** Publishes via the send-with-reply endpoint: auto-creates a temp reply queue server-side,
   *  then registers the pending reply and joins its SignalR group so MessagesComponent's reply
   *  panel can pick it up (design.md Data Flow). */
  private sendWithReply(exchange: string, routingKey: string, payload: string): void {
    this.busHub.start().catch(() => {});
    this.api
      .post<SendWithReplyResponse>('/api/messages/with-reply', { exchange, routingKey, payload })
      .subscribe({
        next: (response) => {
          this.confirmation.set('Mensaje enviado, esperando respuesta.');
          this.replySubscriptions.add({
            subscriptionId: response.subscriptionId,
            correlationId: response.correlationId,
          });
          this.busHub.joinSubscription(response.subscriptionId).catch((err: unknown) => {
            this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo unir al grupo de suscripción.'));
          });
        },
        error: (err: unknown) => {
          this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo enviar el mensaje.'));
        },
      });
  }

  useRecent(entry: RecentSend): void {
    this.exchange.set(entry.exchange);
    this.routingKey.set(entry.routingKey);
    this.payload.set(entry.payload);
  }

  useTemplate(template: SendTemplate): void {
    this.exchange.set(template.exchange);
    this.routingKey.set(template.routingKey);
    this.payload.set(template.payload);
    this.touched.set(new Set<SendField>(['exchange', 'routingKey', 'payload']));
  }

  saveTemplate(): void {
    this.history.saveTemplate({
      name: this.templateName(),
      exchange: this.exchange(),
      routingKey: this.routingKey(),
      payload: this.payload(),
    });
  }

  deleteTemplate(name: string): void {
    this.history.deleteTemplate(name);
  }
}
