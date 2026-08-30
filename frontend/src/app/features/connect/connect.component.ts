import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { HlmDialog, HlmDialogContent, HlmDialogPortal } from '@spartan-ng/helm/dialog';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService } from '../../core/bus-hub.service';
import { BrokerAccentService } from '../../core/broker-accent.service';
import { ConnectDialogComponent } from './connect-dialog.component';
import { StatusPillComponent } from './status-pill.component';

/**
 * Connection container: owns the session-only broker connection (bus-connection spec) and
 * drives the load-time popup / status-pill affordance (connection-status spec: "Connection UI
 * Is a Load-Time Popup That Collapses to a Status Pill"). The popup is one `connectDialogOpen`
 * signal — it auto-opens on load while disconnected and the always-visible pill re-opens it.
 *
 * Reads the SignalR hub's connection state read-only for the pill; never starts/stops the hub,
 * which stays owned by `MessagesComponent` (connection-status spec: "Hub Connection Ownership
 * Stays With MessagesComponent").
 */
@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [HlmDialog, HlmDialogContent, HlmDialogPortal, ConnectDialogComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './connect.component.html',
})
export class ConnectComponent {
  private readonly api = inject(ApiClientService);
  private readonly busHub = inject(BusHubService);
  private readonly brokerAccent = inject(BrokerAccentService);

  readonly host = signal('localhost');
  readonly port = signal(5672);
  readonly username = signal('guest');
  readonly password = signal('guest');
  readonly connected = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** True for the duration of an in-flight connect POST or disconnect DELETE. Which action is
   *  pending is derived from `connected()`, not stored separately. */
  readonly pending = signal(false);

  /** The single hidden-but-clickable popup signal (design D3). Starts open because the app
   *  loads with no broker connection. */
  readonly connectDialogOpen = signal(true);

  readonly hubConnectionState = this.busHub.connectionState;

  connect(): void {
    this.errorMessage.set(null);
    this.pending.set(true);
    this.api
      .post('/api/connections', {
        host: this.host(),
        port: this.port(),
        username: this.username(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          this.connected.set(true);
          this.pending.set(false);
          this.brokerAccent.setBroker('rabbitmq');
          this.connectDialogOpen.set(false);
        },
        error: (err: unknown) => {
          this.connected.set(false);
          this.errorMessage.set(ApiClientService.errorDetail(err, 'No se pudo conectar con el broker.'));
          this.pending.set(false);
        },
      });
  }

  disconnect(): void {
    this.pending.set(true);
    this.api.delete('/api/connections').subscribe({
      next: () => this.settleDisconnect(),
      error: () => this.settleDisconnect(),
    });
  }

  private settleDisconnect(): void {
    this.connected.set(false);
    this.pending.set(false);
    this.brokerAccent.setBroker(null);
  }

  /** Pill activation: opens the same popup regardless of connection state (connection-status
   *  spec — connected shows disconnect/switch, disconnected shows the connect form). */
  openConnectDialog(): void {
    this.connectDialogOpen.set(true);
  }

  /** "Cambiar broker" (design D10): drop the current connection and keep the popup open so its
   *  body switches back to the credentials form. Reuses `disconnect()` → `connect()`, no Kafka
   *  wiring. */
  changeBroker(): void {
    this.connectDialogOpen.set(true);
    this.disconnect();
  }

  onDialogStateChange(state: BrnDialogState): void {
    this.connectDialogOpen.set(state === 'open');
  }
}
