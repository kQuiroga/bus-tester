import { Injectable, signal } from '@angular/core';

const RECENT_SENDS_KEY = 'send-panel.recent-sends';
const TEMPLATES_KEY = 'send-panel.templates';
const RECENT_SENDS_CAP = 5;

/** A previously-sent message, newest-first in {@link SendHistoryService.recentSends}.
 *  `headers` is optional so pre-existing persisted entries without it restore cleanly
 *  (send-custom-headers spec: "Entries Without Headers Remain Unaffected"). */
export interface RecentSend {
  exchange: string;
  routingKey: string;
  payload: string;
  sentAt: string;
  headers?: Record<string, string>;
}

/** A named, reusable send-form snapshot. `headers` is optional for the same reason as
 *  {@link RecentSend.headers}. */
export interface SendTemplate {
  name: string;
  exchange: string;
  routingKey: string;
  payload: string;
  headers?: Record<string, string>;
}

/** Parses a `localStorage` JSON entry, falling back to `[]` for missing, malformed, or non-array data. */
function readArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Reads the persisted recent-sends list and enforces {@link RECENT_SENDS_CAP} on first load.
 * When a list from a prior version holds more than 5 entries, it is truncated to the 5 most
 * recent (the list is newest-first) AND the persisted key is rewritten with just those 5,
 * discarding the older entries — no preserve-and-hide (ui-presentation spec: "Upgrade migration
 * truncates a longer persisted list"; decisions #152.3, design D6). A list already within the
 * cap is returned untouched and the key is left as-is.
 */
function loadCappedRecentSends(): RecentSend[] {
  const stored = readArray<RecentSend>(RECENT_SENDS_KEY);
  if (stored.length <= RECENT_SENDS_CAP) {
    return stored;
  }
  const capped = stored.slice(0, RECENT_SENDS_CAP);
  localStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(capped));
  return capped;
}

/**
 * `localStorage`-backed recent-sends and templates for the send panel
 * (ui-presentation spec: "Recent Sends Are Recorded, Capped, and Recallable",
 * "Named Templates Can Be Saved, Loaded, and Deleted", "History and Templates
 * Persist via Feature-Scoped localStorage", "Corrupted Persisted Data Fails
 * Gracefully to Empty State").
 */
@Injectable({ providedIn: 'root' })
export class SendHistoryService {
  private readonly _recentSends = signal<RecentSend[]>(loadCappedRecentSends());
  private readonly _templates = signal<SendTemplate[]>(readArray<SendTemplate>(TEMPLATES_KEY));

  readonly recentSends = this._recentSends.asReadonly();
  readonly templates = this._templates.asReadonly();

  recordSend(entry: Omit<RecentSend, 'sentAt'>): void {
    const withTimestamp: RecentSend = { ...entry, sentAt: new Date().toISOString() };
    const next = [withTimestamp, ...this._recentSends()].slice(0, RECENT_SENDS_CAP);
    this._recentSends.set(next);
    localStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(next));
  }

  /**
   * Clears every in-memory recent send AND deletes the persisted `localStorage` key so the list
   * stays empty after a reload (ui-presentation spec: "Vaciar clears the list and its persisted
   * key"; decision #152.2). Templates are untouched.
   */
  clearRecentSends(): void {
    this._recentSends.set([]);
    localStorage.removeItem(RECENT_SENDS_KEY);
  }

  saveTemplate(template: SendTemplate): void {
    const next = [...this._templates().filter((t) => t.name !== template.name), template];
    this._templates.set(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  }

  deleteTemplate(name: string): void {
    const next = this._templates().filter((t) => t.name !== name);
    this._templates.set(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  }
}
