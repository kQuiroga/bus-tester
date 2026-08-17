import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api-client.service';

/**
 * Send-message form (exchange, routing key, payload) publishing on the active connection
 * (message-sending spec: "Successful publish" / "Invalid exchange or no connection").
 */
@Component({
  selector: 'app-send',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './send.component.html',
})
export class SendComponent {
  private readonly api = inject(ApiClientService);

  readonly exchange = signal('');
  readonly routingKey = signal('');
  readonly payload = signal('');
  readonly confirmation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  send(): void {
    this.confirmation.set(null);
    this.errorMessage.set(null);
    this.api
      .post('/api/messages', {
        exchange: this.exchange(),
        routingKey: this.routingKey(),
        payload: this.payload(),
      })
      .subscribe({
        next: () => this.confirmation.set('Message sent.'),
        error: (err: unknown) => {
          this.errorMessage.set(ApiClientService.errorDetail(err, 'Could not send the message.'));
        },
      });
  }
}
