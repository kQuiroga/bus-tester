import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { HubConnectionState } from '../../core/bus-hub.service';

/** Inline hub-state copy shown next to the broker label. `null` hides the segment
 *  (connection-status spec: hub state stays visually distinguishable from broker state). */
const HUB_INLINE_LABELS: Record<HubConnectionState, string | null> = {
  idle: null,
  connecting: 'Conectando hub…',
  connected: null,
  reconnecting: 'Reconectando…',
  disconnected: 'Hub caído',
};

/** Prototype `.pill` status tone → text color + dot fill token pair. The prototype
 *  status dot is green (`--color-status-ok`) when connected and red
 *  (`--color-status-error`) otherwise; pending / hub churn borrow the warn amber. */
const TONE = {
  warn: { text: 'text-status-warn', dot: 'bg-status-warn' },
  ok: { text: 'text-status-ok', dot: 'bg-status-ok' },
  error: { text: 'text-status-error', dot: 'bg-status-error' },
  neutral: { text: 'text-muted-foreground', dot: 'bg-status-error' },
} as const;

/**
 * Always-visible, always-clickable connection status pill (connection-status spec:
 * "Connection UI Is a Load-Time Popup That Collapses to a Status Pill"). Purely
 * presentational — it emits {@link activate} and the container owns the popup.
 *
 * Chrome matches the approved prototype `.pill` (docs/redesign-prototype/Main.dc.html):
 * a rounded-full panel-surface chip with a 7px status dot and 12px label.
 */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './status-pill.component.html',
})
export class StatusPillComponent {
  readonly connected = input(false);
  readonly pending = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly hubState = input<HubConnectionState>('idle');
  /** `host:port` of the active broker session, shown next to "Conectado" in the pill. */
  readonly endpoint = input('localhost:5672');

  readonly activate = output<void>();

  readonly brokerLabel = computed(() => {
    if (this.pending()) {
      return this.connected() ? 'Desconectando…' : 'Conectando…';
    }
    return this.connected() ? `Conectado · ${this.endpoint()}` : 'Sin conexión';
  });

  readonly hubInlineLabel = computed(() => HUB_INLINE_LABELS[this.hubState()]);

  private readonly tone = computed(() => {
    if (this.pending() || this.hubState() === 'reconnecting' || this.hubState() === 'connecting') {
      return TONE.warn;
    }
    if (this.errorMessage() || this.hubState() === 'disconnected') {
      return TONE.error;
    }
    if (this.connected()) {
      return TONE.ok;
    }
    return TONE.neutral;
  });

  readonly toneClass = computed(() => this.tone().text);
  readonly dotClass = computed(() => this.tone().dot);
}
