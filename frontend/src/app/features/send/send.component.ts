import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api-client.service';
import { RecentSend, SendHistoryService, SendTemplate } from './send-history.service';

type SendField = 'exchange' | 'routingKey' | 'payload';

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
  readonly history = inject(SendHistoryService);

  readonly exchange = signal('');
  readonly routingKey = signal('');
  readonly payload = signal('');
  readonly confirmation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly touched = signal<Set<SendField>>(new Set());
  readonly templateName = signal('');

  readonly exchangeError = computed(() => (this.exchange().trim() === '' ? 'Exchange is required.' : null));
  readonly payloadError = computed(() => (this.payload().trim() === '' ? 'Payload is required.' : null));
  readonly routingKeyError = computed(() =>
    this.routingKey() !== '' && this.routingKey().trim() === '' ? 'Routing key cannot be blank.' : null,
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
    this.api
      .post('/api/messages', { exchange, routingKey, payload })
      .subscribe({
        next: () => {
          this.confirmation.set('Message sent.');
          this.history.recordSend({ exchange, routingKey, payload });
        },
        error: (err: unknown) => {
          this.errorMessage.set(ApiClientService.errorDetail(err, 'Could not send the message.'));
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
