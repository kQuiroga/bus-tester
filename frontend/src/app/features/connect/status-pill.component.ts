import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCircleX, lucideLoaderCircle } from '@ng-icons/lucide';
import { HlmBadge } from '@spartan-ng/helm/badge';
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

const TONE = {
  warn: 'bg-status-warn-bg text-status-warn',
  ok: 'bg-status-ok-bg text-status-ok',
  error: 'bg-status-error-bg text-status-error',
  neutral: 'bg-muted text-muted-foreground',
} as const;

/**
 * Always-visible, always-clickable connection status pill (connection-status spec:
 * "Connection UI Is a Load-Time Popup That Collapses to a Status Pill"). Purely
 * presentational — it emits {@link activate} and the container owns the popup.
 */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [HlmBadge, NgIcon],
  providers: [provideIcons({ lucideCircleCheck, lucideCircleX, lucideLoaderCircle })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './status-pill.component.html',
})
export class StatusPillComponent {
  readonly connected = input(false);
  readonly pending = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly hubState = input<HubConnectionState>('idle');

  readonly activate = output<void>();

  readonly brokerLabel = computed(() => {
    if (this.pending()) {
      return this.connected() ? 'Desconectando…' : 'Conectando…';
    }
    return this.connected() ? 'Conectado' : 'Sin conexión';
  });

  readonly hubInlineLabel = computed(() => HUB_INLINE_LABELS[this.hubState()]);

  readonly toneClass = computed(() => {
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
}
