/**
 * Vitest setup file (wired via `angular.json` → test → `setupFiles`).
 *
 * Node 20+ ships an experimental Web Storage API that is disabled unless the process is started
 * with `--localstorage-file`, and on Node 24+ the mere presence of the global shadows the
 * jsdom-provided `localStorage`/`sessionStorage` with an unusable stub. Either way, specs that
 * touch storage (`SendHistoryService`, `BusHubService`, …) throw or see `undefined`.
 *
 * This installs a minimal in-memory `Storage` implementation, but only when a working one is not
 * already present, so real browser runs (`ng test --browsers=…`) are untouched.
 */

class InMemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function isUsable(candidate: Storage | undefined): boolean {
  if (!candidate) {
    return false;
  }

  try {
    const probe = '__storage_probe__';
    candidate.setItem(probe, probe);
    candidate.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!isUsable((globalThis as Record<string, unknown>)[name] as Storage | undefined)) {
    Object.defineProperty(globalThis, name, {
      value: new InMemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
