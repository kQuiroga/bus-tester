import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api-client.service';

/**
 * Connection form (host/port/credentials) driving the session-only broker connection
 * (bus-connection spec: "Successful connection" / "Broker unreachable").
 */
@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './connect.component.html',
})
export class ConnectComponent {
  private readonly api = inject(ApiClientService);

  readonly host = signal('localhost');
  readonly port = signal(5672);
  readonly username = signal('guest');
  readonly password = signal('guest');
  readonly connected = signal(false);
  readonly errorMessage = signal<string | null>(null);

  connect(): void {
    this.errorMessage.set(null);
    this.api
      .post('/api/connections', {
        host: this.host(),
        port: this.port(),
        username: this.username(),
        password: this.password(),
      })
      .subscribe({
        next: () => this.connected.set(true),
        error: (err: unknown) => {
          this.connected.set(false);
          this.errorMessage.set(ApiClientService.errorDetail(err, 'Could not connect to the broker.'));
        },
      });
  }

  disconnect(): void {
    this.api.delete('/api/connections').subscribe({
      next: () => this.connected.set(false),
      error: () => this.connected.set(false),
    });
  }
}
