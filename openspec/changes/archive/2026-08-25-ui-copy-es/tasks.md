# Tasks: Translate Frontend UI Copy to Spanish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100-150 (additions+deletions across 9 modified files; literal string swaps only) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not applicable — single PR covers full scope) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Translate all frontend UI copy (index.html, connect/send/messages components + specs) to Spanish per design's copy tables | PR 1 | `cd frontend && npx ng test -- --run` (full suite; per-file: `npx ng test -- connect.component.spec.ts` / `send.component.spec.ts` / `messages.component.spec.ts`) | `cd frontend && npm start`, visual check at ~320px and ~1280px viewport widths | Plain `git revert` of the single commit/PR — no schema, backend, or data touched |

## Phase 1: index.html (global copy)

- [x] 1.1 Update `frontend/src/index.html`: `<html lang="en">` → `lang="es"`, `<title>Frontend</title>` → `<title>BusTester · Panel de pruebas de mensajería</title>` (Design: Copy Translation Tables — index.html)

## Phase 2: Connect component (RED → GREEN)

- [x] 2.1 RED — In `frontend/src/app/features/connect/connect.component.spec.ts`, update 3 assertions to the new Spanish strings: `.toContain('Disconnected')` → `.toContain('Desconectado')`; `.toContain('Reconnecting')` → `.toContain('Reconectando')`; `.toLowerCase().toContain('last known')` → `.toContain('último conocido')`. Leave the 2 `Could not connect to RabbitMQ` assertions untouched. Run the spec and confirm it fails against the still-English implementation.
- [x] 2.2 GREEN — In `frontend/src/app/features/connect/connect.component.ts`, update `HUB_STATUS_LABELS` (`connecting`/`connected`/`reconnecting`/`disconnected`) and the broker error fallback (`Could not connect to the broker.` → `No se pudo conectar con el broker.`) per Design's connect.component.ts table.
- [x] 2.3 GREEN — In `frontend/src/app/features/connect/connect.component.html`, translate h2, labels (Host→"Host del broker", Port→Puerto, Username→Usuario, Password→Contraseña), submit button (Connect→Conectar), Disconnect→Desconectar, pending ternary (Connecting…/Disconnecting… → Conectando…/Desconectando…), status text (Connected (last known) → Conectado (último conocido)) per Design's connect.component.html table.
- [x] 2.4 Verify `connect.component.spec.ts` now passes (green) after 2.2/2.3; confirm the 2 backend-sourced `Could not connect to RabbitMQ` assertions still pass unchanged.

## Phase 3: Send component (RED → GREEN)

- [x] 3.1 RED — In `frontend/src/app/features/send/send.component.spec.ts`, update 6 assertions: confirmation ×2 → `'Mensaje enviado.'`; exchange-required ×2 → `'El exchange es obligatorio.'`; payload-required → `'El payload es obligatorio.'`; routing-key-blank → `'La clave de enrutamiento no puede estar en blanco.'`. Leave the `Could not publish to exchange 'missing-exchange'` assertion untouched. Run the spec and confirm it fails against the still-English implementation.
- [x] 3.2 GREEN — In `frontend/src/app/features/send/send.component.ts`, update `exchangeError`, `payloadError`, `routingKeyError`, the confirmation message, and the error fallback (`Could not send the message.` → `No se pudo enviar el mensaje.`) per Design's send.component.ts table.
- [x] 3.3 GREEN — In `frontend/src/app/features/send/send.component.html`, translate h2 (Enviar mensaje), Routing key label, Send button, "Recent sends" h3, empty state, `(no routing key)` fallback, `Use` button → `Cargar`, "Templates" h3, placeholder, `Save as template` → `Guardar plantilla`, empty state, `Load` button → `Cargar`, `Delete` button → `Eliminar`. Leave `Exchange`/`Payload` labels unchanged (loanwords) per Design's send.component.html table.
- [x] 3.4 Verify `send.component.spec.ts` now passes (green) after 3.2/3.3; confirm the backend-sourced `Could not publish to exchange 'missing-exchange'` assertion still passes unchanged.

## Phase 4: Messages component (no spec changes)

- [x] 4.1 In `frontend/src/app/features/messages/messages.component.ts`, translate the 3 error fallbacks (`Could not join the subscription group.`, `Could not subscribe to the queue.`, `Could not leave the subscription group.`) per Design's messages.component.ts table.
- [x] 4.2 In `frontend/src/app/features/messages/messages.component.html`, translate h2 (Mensajes en vivo), Queue label (Cola), Subscribe button (Suscribirse), aria-label interpolation (`'Cancelar suscripción a ' + chip.queueName`), placeholder (Buscar mensajes), and the Resume/Pause ternary (Reanudar/Pausar) per Design's messages.component.html table.
- [x] 4.3 Run `messages.component.spec.ts` unchanged and confirm it still passes, including the untouched backend-sourced `Could not subscribe to queue 'missing-queue'` assertion (confirms no accidental edit per Design's Architecture Decisions table).

## Phase 5: Full regression and manual layout check

- [x] 5.1 Run the full frontend suite (`cd frontend && npx ng test -- --run`) and confirm all specs pass, including every backend-sourced assertion left untouched (`Could not connect to RabbitMQ`, `Could not publish to exchange...`, `Could not subscribe to queue...`).
- [x] 5.2 Manual/visual check in dev server (`npm start`) at ~320px and ~1280px viewport widths: confirm the "Conectado (último conocido)" status pill wraps cleanly in its flex-wrap row without clipping, and the "Guardar plantilla" button stays legible beside the flex-1 template-name input at the narrow `minmax(260px,320px)` column width, per Design's Layout Risk Flags. **Substituted with structural check** (no browser tool available): confirmed zero `overflow-hidden`/`text-overflow`/fixed-width classes on any translated label/button/status element across the 3 templates; only `truncate` usages are on pre-existing dynamic user-entered data spans, unrelated to translated static copy. Live visual check at ~320px/~1280px still recommended before merge.
