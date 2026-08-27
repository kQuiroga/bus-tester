import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService, HubConnectionState } from '../../core/bus-hub.service';

/** Color-only status tokens — shape/padding/typography now come from `hlmBadge` itself. */
const STATUS_OK_CLASSES = 'bg-status-ok-bg text-status-ok';
const STATUS_WARN_CLASSES = 'bg-status-warn-bg text-status-warn';
const STATUS_ERROR_CLASSES = 'bg-status-error-bg text-status-error';

/** Label per hub `connectionState`, `null` while `idle` (connection-status design: "Hub status
 *  hidden while connectionState() is 'idle'"). */
const HUB_STATUS_LABELS: Record<HubConnectionState, string | null> = {
  idle: null,
  connecting: 'Hub: Conectando…',
  connected: 'Hub: Conectado',
  reconnecting: 'Hub: Reconectando…',
  disconnected: 'Hub: Desconectado',
};

const HUB_STATUS_CLASSES: Record<HubConnectionState, string> = {
  idle: '',
  connecting: STATUS_WARN_CLASSES,
  connected: STATUS_OK_CLASSES,
  reconnecting: STATUS_WARN_CLASSES,
  disconnected: STATUS_ERROR_CLASSES,
};

/**
 * Connection form (host/port/credentials) driving the session-only broker connection
 * (bus-connection spec: "Successful connection" / "Broker unreachable"). Also surfaces the
 * SignalR hub's live connection state read-only — never starts/stops the hub itself, which stays
 * owned by `MessagesComponent` (connection-status spec: "Hub Connection Ownership Stays With
 * MessagesComponent").
 */
@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [FormsModule, HlmButton, HlmInput, HlmLabel, HlmBadge],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './connect.component.html',
})
export class ConnectComponent {
  private readonly api = inject(ApiClientService);
  private readonly busHub = inject(BusHubService);

  readonly host = signal('localhost');
  readonly port = signal(5672);
  readonly username = signal('guest');
  readonly password = signal('guest');
  readonly connected = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** True for the duration of an in-flight connect POST or disconnect DELETE. Which action is
   *  pending is derived from `connected()`, not stored separately — see design.md decision
   *  "Single boolean pending signal covers both connect and disconnect". */
  readonly pending = signal(false);

  readonly hubConnectionState = this.busHub.connectionState;
  readonly hubStatusLabel = computed<string | null>(() => HUB_STATUS_LABELS[this.hubConnectionState()]);
  readonly hubStatusClasses = computed(() => HUB_STATUS_CLASSES[this.hubConnectionState()]);

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
      next: () => {
        this.connected.set(false);
        this.pending.set(false);
      },
      error: () => {
        this.connected.set(false);
        this.pending.set(false);
      },
    });
  }
}
