# Design: Translate Frontend UI Copy to Spanish

## Technical Approach

Direct, in-place literal-string replacement across `index.html`, `app.html`, and the three
feature components (Connect, Send, Messages) — templates and component/service TypeScript.
No new abstraction: no translation-constants file, no i18n pipe, no `@angular/localize`. The
`HUB_STATUS_LABELS` map keeps its exact shape (`Record<HubConnectionState, string | null>`);
only the string values change. Backend `detail` messages (`BusExceptionHandler.cs`,
`RabbitMqAdapter.cs`) stay English — out of scope, documented limitation. This design's core
deliverable is the exact before/after copy per file below, so `sdd-tasks`/`sdd-apply` implement
literal edits, not "translate this" placeholders.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Abstraction | Hardcode Spanish strings in place | Extract to `i18n.constants.ts`; `@angular/localize` | Proposal explicitly scopes out i18n infra; single-language app, no switcher planned |
| "Use" vs "Load" | Harmonize to **"Cargar"** for both recent-sends and templates buttons | "Usar" for both; keep distinct | "Cargar" precisely names the action (populate form from stored data) and is the established Spanish SFW-UI term ("cargar plantilla"); "Usar" is vaguer |
| AMQP/technical loanwords | Keep **Host, Exchange, Payload, broker, Hub** untranslated | Translate to Anfitrión/Intercambio/Carga útil/intermediario/Concentrador | These are established loanwords in Spanish messaging/AMQP tooling; translating them reads as unnatural and less recognizable to the target technical audience |
| "Hub:" prefix | Keep untranslated, translate only the status word after it | Translate to "Concentrador:"; drop prefix entirely | Prefix is a short technical label consistent with keeping "Hub" as a loanword; dropping it would remove the intentional Hub-vs-Broker distinction (connection-status spec) |
| Validation tone | Two normalized patterns: "El/La X es obligatorio/a." for required fields, "X no puede estar en blanco." for optional-but-not-blank | Force one pattern for all three | Underlying validation rules genuinely differ (required vs optional-but-not-blank); normalize *tone*, not the rule being expressed |
| messages.component.spec.ts | No assertion changes needed | Update per proposal's checklist assumption | Re-read of the file shows no assertion targets the frontend fallback strings — the two rejection tests assert fixture-provided `detail` text ('group join rejected'/'group leave rejected'), which `errorDetail()` prefers over the hardcoded fallback. Proposal's checklist item is corrected here. |

## Copy Translation Tables

### `frontend/src/index.html`
| Location | Before | After |
|---|---|---|
| `<html lang="en">` | `en` | `es` |
| `<title>` | `Frontend` | `BusTester · Panel de pruebas de mensajería` |

### `frontend/src/app/app.html` / `app.ts`
No change — `{{ title }}` renders `App.title = 'BusTester'`, a brand name, not translated.

### `connect.component.html`
| Location | Before | After |
|---|---|---|
| h2 | `Connection` | `Conexión` |
| label | `Host` | `Host del broker` |
| label | `Port` | `Puerto` |
| label | `Username` | `Usuario` |
| label | `Password` | `Contraseña` |
| submit button | `Connect` | `Conectar` |
| button | `Disconnect` | `Desconectar` |
| pending ternary | `Disconnecting…` / `Connecting…` | `Desconectando…` / `Conectando…` |
| status | `Connected (last known)` | `Conectado (último conocido)` |

### `connect.component.ts`
| Location | Before | After |
|---|---|---|
| `HUB_STATUS_LABELS.connecting` | `Hub: Connecting…` | `Hub: Conectando…` |
| `HUB_STATUS_LABELS.connected` | `Hub: Connected` | `Hub: Conectado` |
| `HUB_STATUS_LABELS.reconnecting` | `Hub: Reconnecting…` | `Hub: Reconectando…` |
| `HUB_STATUS_LABELS.disconnected` | `Hub: Disconnected` | `Hub: Desconectado` |
| error fallback | `Could not connect to the broker.` | `No se pudo conectar con el broker.` |

### `connect.component.spec.ts` — assertion updates
| Line context | Old assertion string | New assertion string |
|---|---|---|
| hub status "Disconnected" | `.toContain('Disconnected')` | `.toContain('Desconectado')` |
| hub status "Reconnecting" | `.toContain('Reconnecting')` | `.toContain('Reconectando')` |
| broker "last known" | `.toLowerCase().toContain('last known')` | `.toContain('último conocido')` (already lowercase; drop `.toLowerCase()` or keep it, both pass) |
| **Untouched (backend-sourced)** | `.toContain('Could not connect to RabbitMQ')` (×2) | no change |

### `send.component.html`
| Location | Before | After |
|---|---|---|
| h2 | `Send message` | `Enviar mensaje` |
| label | `Exchange` | `Exchange` (unchanged — loanword) |
| label | `Routing key` | `Clave de enrutamiento` |
| label | `Payload` | `Payload` (unchanged — loanword) |
| submit button | `Send` | `Enviar` |
| h3 | `Recent sends` | `Envíos recientes` |
| empty state | `No sends yet.` | `Aún no hay envíos.` |
| row fallback | `(no routing key)` | `(sin clave de enrutamiento)` |
| row button | `Use` | `Cargar` |
| h3 | `Templates` | `Plantillas` |
| placeholder | `Template name` | `Nombre de la plantilla` |
| button | `Save as template` | `Guardar plantilla` *(shortened, see Layout Risk)* |
| empty state | `No saved templates.` | `No hay plantillas guardadas.` |
| row button | `Load` | `Cargar` |
| row button | `Delete` | `Eliminar` |

### `send.component.ts`
| Location | Before | After |
|---|---|---|
| `exchangeError` | `Exchange is required.` | `El exchange es obligatorio.` |
| `payloadError` | `Payload is required.` | `El payload es obligatorio.` |
| `routingKeyError` | `Routing key cannot be blank.` | `La clave de enrutamiento no puede estar en blanco.` |
| confirmation | `Message sent.` | `Mensaje enviado.` |
| error fallback | `Could not send the message.` | `No se pudo enviar el mensaje.` |

### `send.component.spec.ts` — assertion updates
| Line context | Old assertion string | New assertion string |
|---|---|---|
| confirmation (×2 tests) | `.toBe('Message sent.')` | `.toBe('Mensaje enviado.')` |
| exchange required (×2 tests) | `.toBe('Exchange is required.')` | `.toBe('El exchange es obligatorio.')` |
| payload required | `.toBe('Payload is required.')` | `.toBe('El payload es obligatorio.')` |
| routing key blank | `.toBe('Routing key cannot be blank.')` | `.toBe('La clave de enrutamiento no puede estar en blanco.')` |
| **Untouched (backend-sourced)** | `.toContain("Could not publish to exchange 'missing-exchange'")` | no change |

### `messages.component.html`
| Location | Before | After |
|---|---|---|
| h2 | `Live messages` | `Mensajes en vivo` |
| label | `Queue` | `Cola` |
| submit button | `Subscribe` | `Suscribirse` |
| aria-label (interpolated) | `'Unsubscribe from ' + chip.queueName` | `'Cancelar suscripción a ' + chip.queueName` |
| placeholder | `Search messages` | `Buscar mensajes` |
| ternary | `Resume` / `Pause` | `Reanudar` / `Pausar` |

Aria-label grammar note: Spanish preposition `a` needs no elision/contraction before any queue
name (unlike `de + el → del`), so `'Cancelar suscripción a ' + chip.queueName` is grammatically
correct for every possible interpolated value — no edge case to special-case.

### `messages.component.ts`
| Location | Before | After |
|---|---|---|
| error fallback | `Could not join the subscription group.` | `No se pudo unir al grupo de suscripción.` |
| error fallback | `Could not subscribe to the queue.` | `No se pudo suscribir a la cola.` |
| error fallback | `Could not leave the subscription group.` | `No se pudo salir del grupo de suscripción.` |

### `messages.component.spec.ts`
No assertion changes required (see Architecture Decisions table). Backend-sourced assertion
`.toContain("Could not subscribe to queue 'missing-queue'")` stays untouched.

## Layout Risk Flags

| String | English len | Spanish len | Context | Risk | Mitigation |
|---|---|---|---|---|---|
| `Connected (last known)` → `Conectado (último conocido)` | 23 | 28 | Status pill in a `flex-wrap` row alongside other pills | Medium — chips wrap, not truncated, but visually denser | Already using the concise form (`último conocido`, not `el último estado conocido`); acceptable as-is |
| `Save as template` → `Guardar plantilla` | 17 | 18 | `shrink-0` button beside a `flex-1` input in a `flex gap-2` row at min ~264px column width | Low-Medium | Dropped "como" (`Guardar como plantilla` would be 23 chars) to keep it tight |
| `Host` → `Host del broker` | 4 | 16 | Label on its own line above the input (block layout, not inline-constrained) | Low | No mitigation needed — block layout absorbs the length |
| Validation messages, error fallbacks | — | +20-40% longer | Rendered as standalone `<p>` blocks below fields or in full-width banners | Low | Block-level elements wrap freely; no fixed-width truncation anywhere in these templates |

No `overflow: hidden`/`text-overflow: ellipsis`/fixed pixel widths exist on any label, button, or
status element in the three templates — all are flex/block containers that wrap or grow, so the
only genuine risk is visual density, not clipped/broken text.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (component) | Updated `.spec.ts` assertions render/return the new Spanish strings | Literal string swap in existing `toBe`/`toContain` calls (table above) — **not new tests**. This is Standard Mode: no new logic, no new branches, no new component behavior is introduced by a copy change, so there is nothing to drive with a new red test. Per project's Strict TDD Mode convention, the applicable discipline here is: change the assertion first (it goes red against the still-English implementation), then change the template/component string (assertion goes green) — satisfying red→green per edit without inventing new test cases. |
| Manual/visual | Layout risk items above render without clipping at the `lg:grid-cols-[minmax(260px,320px)_...]` narrow column width and on mobile single-column stack | Visual check in dev server at ~320px and ~1280px viewport widths after the edits |
| Regression | Backend-sourced-text assertions (`Could not connect to RabbitMQ`, `Could not publish to exchange...`, `Could not subscribe to queue...`) still pass unchanged | No edits to these lines; full `vitest` run confirms no accidental touch |

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/index.html` | Modify | `lang="es"`, new `<title>` |
| `frontend/src/app/features/connect/connect.component.html` | Modify | Labels, buttons, status text → Spanish |
| `frontend/src/app/features/connect/connect.component.ts` | Modify | `HUB_STATUS_LABELS` values, error fallback |
| `frontend/src/app/features/connect/connect.component.spec.ts` | Modify | 3 assertion strings updated |
| `frontend/src/app/features/send/send.component.html` | Modify | Labels, buttons, empty states → Spanish; `Use`/`Load` → `Cargar` |
| `frontend/src/app/features/send/send.component.ts` | Modify | Validation messages, confirmation, error fallback |
| `frontend/src/app/features/send/send.component.spec.ts` | Modify | 5 assertion strings updated (2 confirmation, 2 exchange-required, 1 each payload/routing-key) |
| `frontend/src/app/features/messages/messages.component.html` | Modify | Labels, buttons, aria-label, placeholder → Spanish |
| `frontend/src/app/features/messages/messages.component.ts` | Modify | 3 error fallbacks → Spanish |
| `frontend/src/app/features/messages/messages.component.spec.ts` | No change | Confirmed no assertion targets frontend-copy strings |
| `frontend/src/app/app.html`, `app.ts` | No change | Only string is the `title` brand binding, untranslated |

## Interfaces / Contracts

No new types or contracts. `HUB_STATUS_LABELS: Record<HubConnectionState, string | null>` keeps
its exact type signature — only literal values change.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary. Pure literal-string edits in existing templates/components.

## Migration / Rollout

No migration required. Frontend-only, no backend/schema/data changes. Single commit (or small
commit set) touching only the listed files; rollback is a plain revert.

## Open Questions

None — all proposal decisions (verb harmonization, aria-label grammar, title, spec scope) are
resolved above.
