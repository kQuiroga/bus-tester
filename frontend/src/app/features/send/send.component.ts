import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
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

/** Toast styling: reuse the existing "ok"/"error" status color tokens (ui-presentation spec:
 *  "Send Feedback Delivered via Transient Toast"). */
const TOAST_OK_CLASS = 'bg-status-ok-bg text-status-ok';
const TOAST_ERROR_CLASS = 'bg-status-error-bg text-status-error';

/**
 * Send-message form (exchange, routing key, payload) publishing on the active connection
 * (message-sending spec: "Successful publish" / "Invalid exchange or no connection";
 * ui-presentation spec: "Send Panel Validates Exchange and Payload as Required",
 * "Send Panel Validates Routing Key as Optional-If-Present", "Submit Is Gated on Form Validity",
 * "Send Feedback Delivered via Transient Toast").
 */
@Component({
  selector: 'app-send',
  standalone: true,
  imports: [FormsModule, HlmButton, HlmCheckbox, HlmInput, HlmLabel, HlmTextarea],
  changeDetection: ChangeDetectionStrategy.Eager,
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
          toast.success('Mensaje enviado.', { class: TOAST_OK_CLASS });
          this.history.recordSend({ exchange, routingKey, payload });
        },
        error: (err: unknown) => {
          toast.error(ApiClientService.errorDetail(err, 'No se pudo enviar el mensaje.'), { class: TOAST_ERROR_CLASS });
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
          toast.success('Mensaje enviado, esperando respuesta.', { class: TOAST_OK_CLASS });
          this.replySubscriptions.add({
            subscriptionId: response.subscriptionId,
            correlationId: response.correlationId,
          });
          this.busHub.joinSubscription(response.subscriptionId).catch((err: unknown) => {
            toast.error(ApiClientService.errorDetail(err, 'No se pudo unir al grupo de suscripción.'), { class: TOAST_ERROR_CLASS });
          });
        },
        error: (err: unknown) => {
          toast.error(ApiClientService.errorDetail(err, 'No se pudo enviar el mensaje.'), { class: TOAST_ERROR_CLASS });
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
