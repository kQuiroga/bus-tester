# Design: Live Message Feed Behavior (Highlight, Filter, Pause/Resume, JSON Pretty-Print)

## Technical Approach

`BusHubService` stamps a monotonic `seq` on every message at the single point messages enter the system (the `MessageReceived` handler), giving each row a stable identity independent of array position, filtering, or pausing. `MessagesComponent` layers three derived states on top of the existing `visibleMessages` computed: a pause-aware `displayState` (`linkedSignal`) that freezes rows while paused and resyncs instantly on resume while also computing which `seq`s are genuinely new (for the highlight class), a `filteredMessages` computed that applies `searchTerm` on top of the displayed rows, and template bindings for the pause toggle, search input, highlight class, and JSON pretty-print. `JsonPrettyPipe` is a new pure pipe co-located under `features/messages/`.

## Architecture Decisions

| # | Decision | Alternatives considered | Rationale |
|---|----------|--------------------------|-----------|
| 1 | Monotonic `seq` assigned once in `BusHubService`'s `MessageReceived` handler via a private `nextSeq` counter, stamped before prepend | Array index/length as pseudo-id (rejected: unstable, index 0 always shifts on prepend); timestamp (rejected: no reliable monotonic browser resolution, backend DTO has no timestamp field); assign in component (rejected: multiple signals could double-stamp) | `seq` must be a stable per-message identity decoupled from list position so pause/filter/search can reorder or hide rows without corrupting "new" detection; one choke point guarantees exactly-once numbering |
| 2 | One `displayState` `linkedSignal<{paused,rows}, {rows,newSeqs}>` bundles freeze-on-pause, resync-on-resume, and new-row diffing, branching on `current.paused` and `previous?.source.paused` | Plain `signal` + `effect()` to snapshot-and-diff manually (rejected: writing signals from effects adds scheduling complexity and splits freeze-state/diff-state into two signals that can desync); `computed()` only (rejected: not writable/resettable, can't access "value before this recompute") | `linkedSignal`'s `(source, previous)` shape is exactly "recompute reactively but conditionally keep the old value" — freeze and diff are the same primitive, so one signal avoids desync |
| 3 | `JsonPrettyPipe` lives in `frontend/src/app/features/messages/json-pretty.pipe.ts`, pure, no `shared/` layer | New `frontend/src/app/shared/pipes/` folder now (rejected per locked decision #3: single consumer today, no `shared/` exists yet in this codebase) | YAGNI — a new architectural layer for one consumer adds indirection with no current reuse payoff; a later extraction is a 1-file move |
| 4 | Search filters raw `payload` string (not pretty-printed JSON), plus `routingKey`/`exchange`, case-insensitive substring | Match against `JsonPrettyPipe` output (rejected per locked decision #2: forces a parse/stringify per keystroke per row purely for search, coupling the pure pipe's contract to search) | Raw substring match is simpler, has no parse-failure edge case, matches the proposal's default |
| 5 | `MessagesComponent` stays one smart component; template gains markup only, no container/presentational split | Extract a presentational `MessageRowComponent` for the `<li>` row (rejected for this change) | `connect`/`send`/`messages` are all monolithic smart components today (no presentational sub-components exist anywhere yet); splitting only `messages` now is asymmetric with no second consumer driving reuse, and locked decision #3 already declines a new structural layer this change. Revisit when message-row presentation needs reuse elsewhere |

## Interfaces / Contracts

```ts
// bus-hub.service.ts
export interface ReceivedMessage {
  subscriptionId: string;
  exchange: string;
  routingKey: string;
  payload: string;
  seq: number; // monotonic, assigned at receipt — NOT from the wire DTO
}
type IncomingMessage = Omit<ReceivedMessage, 'seq'>;

private nextSeq = 0;
constructor() {
  this.connection.on('MessageReceived', (message: IncomingMessage) => {
    const received: ReceivedMessage = { ...message, seq: this.nextSeq++ };
    this._messages.update((current) => [received, ...current]);
  });
}
```

```ts
// messages.component.ts
readonly searchTerm = signal('');
readonly paused = signal(false);

private readonly displayState = linkedSignal<
  { paused: boolean; rows: ReceivedMessage[] },
  { rows: ReceivedMessage[]; newSeqs: ReadonlySet<number> }
>({
  source: () => ({ paused: this.paused(), rows: this.visibleMessages() }),
  computation: (current, previous) => {
    if (current.paused) return previous?.value ?? { rows: current.rows, newSeqs: new Set() };
    if (previous?.source.paused) return { rows: current.rows, newSeqs: new Set() }; // resume: instant catch-up, no highlight
    const seen = new Set((previous?.value.rows ?? []).map((m) => m.seq));
    return { rows: current.rows, newSeqs: new Set(current.rows.filter((m) => !seen.has(m.seq)).map((m) => m.seq)) };
  },
});

readonly displayedMessages = computed(() => this.displayState().rows);
readonly filteredMessages = computed(() => {
  const term = this.searchTerm().trim().toLowerCase();
  const rows = this.displayedMessages();
  if (!term) return rows;
  return rows.filter((m) => m.payload.toLowerCase().includes(term) || m.routingKey.toLowerCase().includes(term) || m.exchange.toLowerCase().includes(term));
});

togglePause(): void { this.paused.update((p) => !p); }
isNewRow(message: ReceivedMessage): boolean { return this.displayState().newSeqs.has(message.seq); }
```

```ts
// json-pretty.pipe.ts
@Pipe({ name: 'jsonPretty', standalone: true, pure: true })
export class JsonPrettyPipe implements PipeTransform {
  transform(value: string): string {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
}
```

Template additions: search `<input [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)">`; `<button (click)="togglePause()">{{ paused() ? 'Resume' : 'Pause' }}</button>`; `@for (message of filteredMessages(); track message.seq)` with `[class.animate-message-enter]="isNewRow(message)"`; payload rendered as `<pre>{{ message.payload | jsonPretty }}</pre>` (interpolation, auto-escaped, no `innerHTML`).

## Sequence Diagrams

**A. Message arrives while unpaused (animates)**
```
Backend        BusHubService              MessagesComponent                DOM
  │ MessageReceived │                            │                          │
  ├─────────────────>│ seq=nextSeq++              │                          │
  │                  │ _messages.update(prepend)  │                          │
  │                  │────────────────────────────>│ visibleMessages() new   │
  │                  │                            │ displayState: paused=false,
  │                  │                            │  prev.source.paused=false│
  │                  │                            │  → diff seqs → newSeqs={seq}
  │                  │                            │ filteredMessages() incl. │
  │                  │                            │─────────────────────────>│ isNewRow=true
  │                  │                            │                          │ → animate-message-enter
```

**B. Message arrives while paused, then resume (no animation, instant catch-up)**
```
Backend        BusHubService              MessagesComponent                DOM
  │                  │  user clicks Pause         │                          │
  │                  │                            │ paused.set(true)          │
  │                  │                            │ displayState: current.paused=true
  │                  │                            │  → returns previous.value │
  │ MessageReceived x N (while paused)             │                          │
  ├─────────────────>│ seq=nextSeq++ each          │                          │
  │                  │ _messages.update(prepend)  │                          │
  │                  │────────────────────────────>│ visibleMessages() grows, │
  │                  │                            │ displayState still frozen│
  │                  │                            │─────────────────────────>│ DOM unchanged
  │                  │  user clicks Resume         │                          │
  │                  │                            │ paused.set(false)         │
  │                  │                            │ displayState: current.paused=false,
  │                  │                            │  prev.source.paused=true  │
  │                  │                            │  → rows=current.rows, newSeqs=∅
  │                  │                            │─────────────────────────>│ all N rows appear
  │                  │                            │                          │ instantly, no highlight
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/core/bus-hub.service.ts` | Modify | Add `seq` to `ReceivedMessage`; assign via `nextSeq++` in `MessageReceived` handler |
| `frontend/src/app/core/bus-hub.service.spec.ts` | Modify | Seq-assignment tests; extend fixtures with `seq` |
| `frontend/src/app/features/messages/messages.component.ts` | Modify | `searchTerm`, `paused` signals; `displayState` linkedSignal; `displayedMessages`/`filteredMessages` computed; `togglePause()`, `isNewRow()` |
| `frontend/src/app/features/messages/messages.component.html` | Modify | Search input, pause/resume button, highlight class, `<pre>` + `jsonPretty`, track by `message.seq` |
| `frontend/src/app/features/messages/messages.component.spec.ts` | Modify | Fixtures gain `seq`; new pause/resume/highlight/search cases |
| `frontend/src/app/features/messages/json-pretty.pipe.ts` | Create | Pure `JsonPrettyPipe` |
| `frontend/src/app/features/messages/json-pretty.pipe.spec.ts` | Create | Pipe test cases |
| `frontend/src/styles.css` | No change expected | Reuses existing `--animate-message-enter`; touch only if visually insufficient (additive-only) |

## Testing Strategy (Strict TDD — RED first, Vitest)

| ID | Unit | Test case |
|----|------|-----------|
| T1 | bus-hub.service | First received message gets `seq` starting at the initial counter value |
| T2 | bus-hub.service | `seq` increments per message regardless of prepend order |
| T3 | bus-hub.service | A fresh service instance restarts its own `seq` counter (no shared/global state) |
| T4 | bus-hub.service | Existing fixtures/assertions updated to include `seq` (mechanical) |
| T5 | messages.component | `togglePause()` freezes `displayedMessages()`/`filteredMessages()`; a message pushed after pausing doesn't appear until resume |
| T6 | messages.component | Resuming jumps `displayedMessages()` straight to the full current list (all pending rows at once) |
| T7 | messages.component | `isNewRow()` is `true` for a message arriving while unpaused |
| T8 | messages.component | `isNewRow()` is `false` for every row revealed by a resume (batch arrived during pause) |
| T9 | messages.component | `isNewRow()` doesn't re-flag a row already shown on a later unrelated live update |
| T10 | messages.component | `searchTerm` filters by case-insensitive substring on raw `payload`, `routingKey`, `exchange` |
| T11 | messages.component | Empty/whitespace `searchTerm` shows all displayed messages |
| T12 | messages.component | Search filtering doesn't affect `isNewRow()` classification |
| T13 | messages.component | Existing 4 specs (subscribe/error/visibleMessages/unsubscribe) stay green with `seq`-bearing fixtures |
| T14 | JsonPrettyPipe | Valid JSON returns `JSON.stringify(JSON.parse(input), null, 2)` |
| T15 | JsonPrettyPipe | Invalid/non-JSON input returns the original string unchanged, no throw |
| T16 | JsonPrettyPipe | Empty string input returns unchanged (falls into the fallback path) |

T5–T12 assert against component signals/methods directly (no DOM queries), consistent with the existing `messages.component.spec.ts` convention (TestBed + `HttpTestingController`, no `debugElement` queries).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Frontend Angular signals/templates and one pure pipe only.

## Migration / Rollout

No data migration. No new npm dependencies (`linkedSignal` already available in Angular 20.3). Single PR; risk is mechanical `seq`-fixture churn across two spec files, within the 400-line review budget.

**Rollback**: `git checkout -- frontend/src/app/core/bus-hub.service.ts frontend/src/app/core/bus-hub.service.spec.ts frontend/src/app/features/messages/` plus delete `json-pretty.pipe.ts`/`.spec.ts`. No backend/SignalR file is touched.

## TDD Applicability (Strict TDD Mode)

RED-GREEN-REFACTOR required for every item in T1–T16 above — all are new component/service/pipe logic, not markup-only. Template wiring (search input, pause button, highlight class, `<pre>|jsonPretty`) is verified indirectly through the signal/method-level tests, matching this codebase's existing no-DOM-query spec convention.

## Open Questions

None blocking — all five items from the proposal's question round are locked decisions incorporated above.
