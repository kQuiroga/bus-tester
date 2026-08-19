# Design: Send Panel UX Improvements

## Technical Approach

Extend `SendComponent` (`frontend/src/app/features/send/`) with hand-rolled `signal()`/`computed()` validation and a new colocated `send-history.service.ts` for localStorage-backed recent-sends and templates. No `ReactiveFormsModule`; `FormsModule`+`ngModel` stays exactly as-is. Zero backend changes; `send()` still calls `POST /api/messages` unchanged, gated by a new pre-submit validity check and followed by a post-success history write.

## Architecture Decisions

### Decision: Validation via computed signals + a touched Set, no Reactive Forms

**Choice**: `exchangeError`/`payloadError`/`routingKeyError` are `computed()` signals reading the existing field signals; `touched = signal<Set<string>>(new Set())` tracks interaction. Template shows an error only when `touched().has(field) && fieldError()`.
**Alternatives considered**: `ReactiveFormsModule` + `Validators` (zero precedent repo-wide — `connect`/`messages`/`send` are 100% template-driven); per-field boolean touched signals instead of one `Set`.
**Rationale**: Matches the existing idiom exactly (minimal diff, no new module import); a single `Set` scales to 3 fields without 3 extra signals and lets a blocked submit mark all fields touched in one `set()` call.

### Decision: `routingKey` optional-but-validated-if-present

**Choice**: `routingKeyError = computed(() => routingKey() !== '' && routingKey().trim() === '' ? 'Routing key cannot be blank.' : null)`. Empty string passes; whitespace-only fails.
**Alternatives considered**: Treat routing key as required (rejected — RabbitMQ fanout exchanges legitimately ignore it, would block valid sends).
**Rationale**: Matches proposal's fanout-exchange rationale exactly.

### Decision: `SendHistoryService` is `providedIn: 'root'`

**Choice**: `@Injectable({ providedIn: 'root' })`, matching `ApiClientService`/`BusHubService`.
**Alternatives considered**: Component-scoped provider on `SendComponent` (only current consumer).
**Rationale**: Consistency with existing DI convention; root injection lets specs `TestBed.inject(SendHistoryService)` directly, mirroring `bus-hub.service.spec.ts`; no functional downside since there is exactly one `SendComponent` instance in the app shell.

### Decision: Template save dedupes by name (overwrite), delete is unconfirmed

**Choice**: `saveTemplate()` filters out any existing entry with the same `name` before appending.
**Alternatives considered**: Reject duplicate names with an error; append-only (allow duplicates).
**Rationale**: Simplest UX for a single-user local list — "Save As" with an existing name means "update it"; duplicate names would be confusing to recall from. Out of scope per proposal: no per-entry history deletion.

## Data Flow

**Submit blocked by validation:**
```
User clicks Send ──> send()
  hasErrors() === true
  ──> touched.set(all fields) ──> template re-renders errors ──> POST never fires
```

**Save-as-template then recall:**
```
User fills form ──> saveTemplate() (SendComponent)
  ──> history.saveTemplate({name, exchange, routingKey, payload})
        ──> templates.set([...dedup, entry]) ──> localStorage.setItem('send-panel.templates', json)
...later...
User clicks a template row ──> useTemplate(t)
  ──> exchange.set(t.exchange); routingKey.set(t.routingKey); payload.set(t.payload)
  ──> touched.set(new Set(['exchange','routingKey','payload']))  // errors re-evaluate immediately
```

**Successful send appends history** (only after 2xx, never on failed/blocked attempts):
```
send() ──valid──> api.post(...).subscribe({
  next: () => { confirmation.set(...); history.recordSend({exchange, routingKey, payload}) }
})
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/features/send/send-history.service.ts` | Create | `providedIn:'root'` service; owns `send-panel.recent-sends` (cap 20, FIFO via `slice(0, 20)` after unshift) and `send-panel.templates`; exposes `recentSends`/`templates` signals + `recordSend`/`saveTemplate`/`deleteTemplate`; `JSON.parse` wrapped in try/catch → `[]` |
| `frontend/src/app/features/send/send.component.ts` | Modify | Add `touched`, `templateName` signals; add `exchangeError`/`payloadError`/`routingKeyError`/`hasErrors` computed; `send()` short-circuits on `hasErrors()`; add `onBlur(field)`, `useRecent(r)`, `useTemplate(t)`, `saveTemplate()`, `deleteTemplate(name)`; inject `SendHistoryService` |
| `frontend/src/app/features/send/send.component.html` | Modify | Add `(blur)="onBlur('exchange')"` etc. to inputs; inline `@if (touched().has('exchange') && exchangeError())` error `<p>` per field using `status-error`/`status-error-bg` tokens (same classes as the existing `errorMessage` block); new "Recent sends" and "Templates" sections below the existing confirmation/error blocks, listing `history.recentSends()`/`history.templates()` with recall/delete buttons and a template-name input |
| `frontend/src/app/features/send/send-history.service.spec.ts` | Create | New TDD spec for the service |
| `frontend/src/app/features/send/send.component.spec.ts` | Modify | New cases per proposal (validation blocking, valid submit unaffected, history population, template save/recall) |
| `frontend/src/styles.css` | None | `status-error`/`status-error-bg`, `border`, `card`, `primary` tokens already sufficient for error text and list rows; no new tokens |

## Interfaces / Contracts

```ts
export interface RecentSend { exchange: string; routingKey: string; payload: string; sentAt: string }
export interface SendTemplate { name: string; exchange: string; routingKey: string; payload: string }

export class SendHistoryService {
  readonly recentSends: Signal<RecentSend[]>;
  readonly templates: Signal<SendTemplate[]>;
  recordSend(entry: Omit<RecentSend, 'sentAt'>): void;
  saveTemplate(template: SendTemplate): void;
  deleteTemplate(name: string): void;
}
```
`sentAt` is set by the service via `new Date().toISOString()`, not passed by the caller.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| `send-history.service.spec.ts` | recordSend caps at 20/FIFO order, saveTemplate dedupes by name, deleteTemplate removes, corrupted JSON → `[]`, non-array JSON → `[]` | Reuse the `bus-hub.service.spec.ts` pattern: operate directly on jsdom's real `localStorage` (`localStorage.setItem('send-panel.recent-sends', 'not-json')` etc.) — no spy/mock layer. `afterEach` clears both keys to avoid cross-test bleed. |
| `send.component.spec.ts` | blank exchange/payload blocks submit + shows error only after touched/blocked-submit; whitespace routingKey blocked, empty routingKey passes; successful send calls `recordSend`; template save/recall populates fields and re-touches | `TestBed.inject(SendHistoryService)` (root-provided, real localStorage) alongside existing `HttpTestingController` setup; clear `localStorage` in `beforeEach`/`afterEach` |
| E2E | Not planned this change | Manual smoke per proposal's Success Criteria |

**TDD sequence** (Strict TDD Mode): (1) RED — write `send-history.service.spec.ts` cases against a not-yet-existing service; (2) GREEN — implement `send-history.service.ts` minimally; (3) REFACTOR service; (4) RED — add validation cases to `send.component.spec.ts` (fails: no `exchangeError`/`touched`); (5) GREEN — add validation signals + `send()` guard + template errors; (6) RED — add history/template cases to `send.component.spec.ts`; (7) GREEN — wire `SendHistoryService` into `SendComponent` + template UI; (8) REFACTOR component/template together, keep diff minimal.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary; this is client-side form validation and `localStorage` I/O only.

## Migration / Rollout

No migration required. `localStorage` keys are new and namespaced (`send-panel.recent-sends`, `send-panel.templates`); absent on first load, service falls back to `[]`. Rollback = revert commit(s); no other code reads these keys.

## Open Questions

None — proposal and existing code fully determine the approach.
