import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmInputGroup, HlmInputGroupAddon, HlmInputGroupButton, HlmInputGroupInput } from '@spartan-ng/helm/input-group';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { ApiClientService } from '../../core/api-client.service';
import { BusHubService } from '../../core/bus-hub.service';
import { ReplySubscriptionService } from '../../core/reply-subscription.service';
import { RecentSend, SendHistoryService, SendTemplate } from './send-history.service';

type SendField = 'exchange' | 'routingKey' | 'payload';

/** A free-form Adicionales header row (send-custom-headers spec: "Adicionales Free-Form Rows"). */
interface HeaderRow {
  key: string;
  value: string;
}

/**
 * Fixed Comunes field -> NServiceBus header name mapping (send-custom-headers spec: "Comunes
 * Named Fields Map to NServiceBus Header Names"). Also used in reverse to split a resolved
 * headers map back into Comunes fields when recalling a recent send or loading a template.
 */
const COMUNES_HEADER_KEYS = {
  tipoMensaje: 'NServiceBus.EnclosedMessageTypes',
  contentType: 'NServiceBus.ContentType',
  intencion: 'NServiceBus.MessageIntent',
  messageId: 'NServiceBus.MessageId',
  correlationId: 'NServiceBus.CorrelationId',
} as const;

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
 * ui-presentation spec: "Send Panel Validates Exchange and Payload as Required" — Exchange is
 * unconditionally required here; reply composition lives in the reply drawer (design D7/D9),
 * "Send Panel Validates Routing Key as Optional-If-Present", "Submit Is Gated on Form Validity",
 * "Send Feedback Delivered via Transient Toast").
 */
@Component({
  selector: 'app-send',
  standalone: true,
  imports: [
    FormsModule,
    HlmButton,
    HlmCheckbox,
    HlmInput,
    HlmInputGroup,
    HlmInputGroupAddon,
    HlmInputGroupButton,
    HlmInputGroupInput,
    HlmLabel,
    HlmTextarea,
    NgIcon,
  ],
  providers: [provideIcons({ lucideDownload, lucideTrash2 })],
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

  /** Custom-headers opt-in toggle (send-custom-headers spec: "Custom Headers Section Is Opt-In
   *  and Hidden by Default"). */
  readonly headersEnabled = signal(false);
  readonly headerTipoMensaje = signal('');
  readonly headerContentType = signal('');
  readonly headerIntencion = signal('');
  readonly headerMessageId = signal('');
  readonly headerCorrelationId = signal('');
  readonly additionalHeaders = signal<HeaderRow[]>([]);

  /** Merges Adicionales rows and Comunes fields into the final headers map (send-custom-headers
   *  spec: "Comunes Values Win on Key Collision With Adicionales"). Returns `{}` when the
   *  headers section is disabled, regardless of any stale field values. */
  readonly resolvedHeaders = computed<Record<string, string>>(() => {
    if (!this.headersEnabled()) {
      return {};
    }

    const headers: Record<string, string> = {};
    for (const row of this.additionalHeaders()) {
      if (row.key.trim() !== '' && row.value.trim() !== '') {
        headers[row.key] = row.value;
      }
    }

    const comunes: Array<[string, string]> = [
      [COMUNES_HEADER_KEYS.tipoMensaje, this.headerTipoMensaje()],
      [COMUNES_HEADER_KEYS.contentType, this.headerContentType()],
      [COMUNES_HEADER_KEYS.intencion, this.headerIntencion()],
      [COMUNES_HEADER_KEYS.messageId, this.headerMessageId()],
      [COMUNES_HEADER_KEYS.correlationId, this.headerCorrelationId()],
    ];
    for (const [key, value] of comunes) {
      if (value.trim() !== '') {
        headers[key] = value;
      }
    }

    return headers;
  });

  readonly exchangeError = computed(() =>
    this.exchange().trim() === '' ? 'El exchange es obligatorio.' : null,
  );
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

  addHeaderRow(): void {
    this.additionalHeaders.update((rows) => [...rows, { key: '', value: '' }]);
  }

  removeHeaderRow(index: number): void {
    this.additionalHeaders.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateHeaderRowKey(index: number, key: string): void {
    this.additionalHeaders.update((rows) => rows.map((row, i) => (i === index ? { ...row, key } : row)));
  }

  updateHeaderRowValue(index: number, value: string): void {
    this.additionalHeaders.update((rows) => rows.map((row, i) => (i === index ? { ...row, value } : row)));
  }

  /** Comunes "Generar" action for Correlation ID (send-custom-headers spec: "Generar Fills
   *  Correlation ID with a GUID"). */
  generateCorrelationId(): void {
    this.headerCorrelationId.set(crypto.randomUUID());
  }

  send(): void {
    if (this.hasErrors()) {
      this.touched.set(new Set<SendField>(['exchange', 'routingKey', 'payload']));
      return;
    }

    const exchange = this.exchange();
    const routingKey = this.routingKey();
    const payload = this.payload();
    const headers = this.resolvedHeaders();

    if (this.expectReply()) {
      this.sendWithReply(exchange, routingKey, payload, headers);
      return;
    }

    const body: Record<string, unknown> = { exchange, routingKey, payload, headers };

    this.api
      .post('/api/messages', body)
      .subscribe({
        next: () => {
          toast.success('Mensaje enviado.', { class: TOAST_OK_CLASS });
          this.history.recordSend({ exchange, routingKey, payload, headers });
        },
        error: (err: unknown) => {
          toast.error(ApiClientService.errorDetail(err, 'No se pudo enviar el mensaje.'), { class: TOAST_ERROR_CLASS });
        },
      });
  }

  /** Publishes via the send-with-reply endpoint: auto-creates a temp reply queue server-side,
   *  then registers the pending reply and joins its SignalR group so MessagesComponent's reply
   *  panel can pick it up (design.md Data Flow). */
  private sendWithReply(exchange: string, routingKey: string, payload: string, headers: Record<string, string>): void {
    // Idempotent on the real service, so kicking it off here (in parallel with the POST below)
    // is safe even if a join elsewhere already triggered it. The join is sequenced behind this
    // same promise (not fired immediately) so it never races an in-flight connection start
    // (regression: joining before start() resolved intermittently failed with "No se pudo unir
    // al grupo de suscripción").
    const hubReady = this.busHub.start();
    this.api
      .post<SendWithReplyResponse>('/api/messages/with-reply', { exchange, routingKey, payload, headers })
      .subscribe({
        next: (response) => {
          toast.success('Mensaje enviado, esperando respuesta.', { class: TOAST_OK_CLASS });
          this.replySubscriptions.add({
            subscriptionId: response.subscriptionId,
            correlationId: response.correlationId,
          });
          hubReady
            .then(() => this.busHub.joinSubscription(response.subscriptionId))
            .catch((err: unknown) => {
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
    this.restoreHeaders(entry.headers);
  }

  useTemplate(template: SendTemplate): void {
    this.exchange.set(template.exchange);
    this.routingKey.set(template.routingKey);
    this.payload.set(template.payload);
    this.touched.set(new Set<SendField>(['exchange', 'routingKey', 'payload']));
    this.restoreHeaders(template.headers);
  }

  saveTemplate(): void {
    this.history.saveTemplate({
      name: this.templateName(),
      exchange: this.exchange(),
      routingKey: this.routingKey(),
      payload: this.payload(),
      headers: this.resolvedHeaders(),
    });
  }

  deleteTemplate(name: string): void {
    this.history.deleteTemplate(name);
  }

  /** "Vaciar" action: delegates to the service, which clears memory and the persisted key
   *  (ui-presentation spec: "Vaciar clears the list and its persisted key"). */
  clearRecent(): void {
    this.history.clearRecentSends();
  }

  /** Splits a recalled `RecentSend`/`SendTemplate`'s `headers` back into the 5 fixed Comunes
   *  signals by exact key match; leftover keys become Adicionales rows. `headersEnabled` toggles
   *  on iff headers is non-empty (send-custom-headers spec: "Resolved Headers Persist Through
   *  Recent Sends and Templates"). Entries with no `headers` field restore to an empty, disabled
   *  state without error. */
  private restoreHeaders(headers: Record<string, string> | undefined): void {
    this.headerTipoMensaje.set('');
    this.headerContentType.set('');
    this.headerIntencion.set('');
    this.headerMessageId.set('');
    this.headerCorrelationId.set('');

    const entries = headers ? Object.entries(headers) : [];
    const leftoverRows: HeaderRow[] = [];
    for (const [key, value] of entries) {
      switch (key) {
        case COMUNES_HEADER_KEYS.tipoMensaje:
          this.headerTipoMensaje.set(value);
          break;
        case COMUNES_HEADER_KEYS.contentType:
          this.headerContentType.set(value);
          break;
        case COMUNES_HEADER_KEYS.intencion:
          this.headerIntencion.set(value);
          break;
        case COMUNES_HEADER_KEYS.messageId:
          this.headerMessageId.set(value);
          break;
        case COMUNES_HEADER_KEYS.correlationId:
          this.headerCorrelationId.set(value);
          break;
        default:
          leftoverRows.push({ key, value });
      }
    }

    this.additionalHeaders.set(leftoverRows);
    this.headersEnabled.set(entries.length > 0);
  }
}
