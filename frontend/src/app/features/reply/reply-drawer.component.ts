import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSheet, HlmSheetContent, HlmSheetPortal, HlmSheetTitle } from '@spartan-ng/helm/sheet';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { ApiClientService } from '../../core/api-client.service';
import { ReplyDraftService } from '../../core/reply-draft.service';
import { JsonPrettyPipe } from '../messages/json-pretty.pipe';
import { queueColorIndex, type QueueColor } from '../messages/queue-color';
import { SendHistoryService } from '../send/send-history.service';

/** Toast styling reused from the Send panel (ui-presentation spec: "Send Feedback Delivered via
 *  Transient Toast"). */
const TOAST_OK_CLASS = 'bg-status-ok-bg text-status-ok';
const TOAST_ERROR_CLASS = 'bg-status-error-bg text-status-error';

/**
 * Right-side reply drawer (request-reply spec: "Responder Action Opens a Reply Drawer Anchored to
 * the Message"; design D3/D4/D9). Opens whenever {@link ReplyDraftService} holds a draft. Layout
 * follows the approved prototype (`docs/redesign-prototype/Main.dc.html` reply drawer): a header dot
 * in the source queue's hue, a pinned "Mensaje original" box (routing key + exchange meta + payload)
 * with a left border in the same hue, a read-only Correlation ID, and the editable reply payload.
 * The reply always publishes through the AMQP default exchange (`""`, accepted with no inline
 * error) with the source message's `replyTo` as the routing key. It issues its own `POST /api/messages` and
 * records the send into the shared recent-sends history — the small duplication of the send call is
 * accepted per D9 rather than extracting a shared send service. Closing the drawer clears the draft.
 */
@Component({
  selector: 'app-reply-drawer',
  standalone: true,
  imports: [
    FormsModule,
    HlmButton,
    HlmInput,
    HlmSheet,
    HlmSheetContent,
    HlmSheetPortal,
    HlmSheetTitle,
    HlmTextarea,
    JsonPrettyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reply-drawer.component.html',
})
export class ReplyDrawerComponent {
  private readonly api = inject(ApiClientService);
  private readonly replyDraft = inject(ReplyDraftService);
  private readonly history = inject(SendHistoryService);

  private readonly draft = this.replyDraft.draft;

  /** The drawer is open exactly while a reply draft exists. */
  readonly open = computed(() => this.draft() !== null);

  /** Source message pinned at the top of the drawer (design D4). */
  readonly origin = computed(() => this.draft()?.target.origin ?? null);

  /** Palette slot (1..6) of the source message's queue, so the header dot and the pinned
   *  original-message box share the same hue as that queue's feed pill (prototype reply drawer;
   *  reuses the slice-4 `[data-queue-color='N']` → `--queue-hue` mechanism). */
  readonly queueColor = computed<QueueColor | null>(() => {
    const queue = this.origin()?.queue ?? '';
    return queue === '' ? null : queueColorIndex(queue);
  });

  /** Meta line inside the pinned box — `exchange: {value}`, with the AMQP default-exchange marker
   *  when the source message carried no exchange (matches the feed row wording). */
  readonly originMeta = computed(() => {
    const o = this.origin();
    return o ? `exchange: ${o.exchange || '(intercambio predeterminado)'}` : '';
  });

  /** Read-only reply target routing key (the source message's `replyTo`). */
  readonly routingKey = computed(() => this.draft()?.target.routingKey ?? '');

  /** Read-only correlation id; blank when the source message carried none. */
  readonly correlationId = computed(() => this.draft()?.target.correlationId ?? '');

  /** The reply always publishes through the AMQP default exchange. */
  readonly exchange: string = '';

  readonly payload = signal('');
  readonly payloadTouched = signal(false);

  /** Empty Exchange is the AMQP default exchange and is accepted; whitespace is never valid. */
  readonly exchangeError = computed(() =>
    this.exchange === '' ? null : this.exchange.trim() === '' ? 'El exchange es obligatorio.' : null,
  );
  readonly payloadError = computed(() => (this.payload().trim() === '' ? 'El payload es obligatorio.' : null));
  readonly hasErrors = computed(() => this.exchangeError() !== null || this.payloadError() !== null);

  constructor() {
    // Reset the editable payload whenever a new reply target arrives (keyed off the draft `seq` so a
    // repeat Responder click on the same message still clears a half-written reply).
    effect(() => {
      const current = this.draft();
      if (!current) {
        return;
      }
      untracked(() => {
        this.payload.set('');
        this.payloadTouched.set(false);
      });
    });
  }

  /** Sheet state callback: a closed sheet clears the draft so the drawer and the source row reset. */
  onStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.close();
    }
  }

  close(): void {
    this.replyDraft.clear();
  }

  send(): void {
    if (this.hasErrors()) {
      this.payloadTouched.set(true);
      return;
    }

    const routingKey = this.routingKey();
    const payload = this.payload();
    const body: Record<string, unknown> = { exchange: '', routingKey, payload, headers: {} };
    const correlationId = this.correlationId().trim();
    if (correlationId !== '') {
      body['correlationId'] = correlationId;
    }

    this.api.post('/api/messages', body).subscribe({
      next: () => {
        toast.success('Respuesta enviada.', { class: TOAST_OK_CLASS });
        this.history.recordSend({ exchange: '', routingKey, payload, headers: {} });
        this.close();
      },
      error: (err: unknown) => {
        toast.error(ApiClientService.errorDetail(err, 'No se pudo enviar la respuesta.'), { class: TOAST_ERROR_CLASS });
      },
    });
  }
}
