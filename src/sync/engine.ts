import { mergeDocs, type Doc } from './merge';

export interface Remote {
  /** Current cloud copy and its version, or null if the user has none yet. */
  pull(): Promise<{ doc: Doc; version: number } | null>;
  /** Write only if the cloud copy is still at `version` (null = no row yet). False means someone else wrote first. */
  push(doc: Doc, version: number | null): Promise<boolean>;
}

export interface LocalStore {
  snapshot(): Doc;
  apply(key: string, value: unknown, ts: number): void;
}

export interface Status {
  state: 'idle' | 'syncing' | 'synced' | 'error';
  at?: number;
  error?: string;
}

export class SyncEngine {
  status: Status = { state: 'idle' };
  private listeners = new Set<(s: Status) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  private local: LocalStore;
  private remote: Remote;
  private keys: readonly string[];
  private accept: (key: string, value: unknown) => boolean;
  private debounceMs: number;
  private retryMs: number;

  constructor(
    local: LocalStore,
    remote: Remote,
    keys: readonly string[],
    accept: (key: string, value: unknown) => boolean,
    debounceMs = 1500,
    retryMs = 30_000,
  ) {
    this.local = local;
    this.remote = remote;
    this.keys = keys;
    this.accept = accept;
    this.debounceMs = debounceMs;
    this.retryMs = retryMs;
  }

  onStatus(cb: (s: Status) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setStatus(s: Status) {
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }

  /** Call after a local change; syncs once the user pauses. */
  schedule() {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), this.debounceMs);
  }

  /** Pull, merge, apply, push. Concurrent calls collapse into one follow-up run. */
  syncNow(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.cycle();
      } while (this.again && !this.disposed);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async cycle() {
    this.setStatus({ state: 'syncing', at: this.status.at });
    try {
      let done = false;
      for (let attempt = 0; attempt < 4 && !done; attempt++) {
        const remote = await this.remote.pull();
        const { merged, applyLocal, remoteChanged } = mergeDocs(
          this.local.snapshot(),
          remote?.doc ?? { data: {}, updated: {} },
          this.keys,
          this.accept,
        );
        for (const k of applyLocal) this.local.apply(k, merged.data[k], merged.updated[k] ?? 0);
        done = !remoteChanged || (await this.remote.push(merged, remote?.version ?? null));
      }
      if (!done) throw new Error('Could not sync: too many concurrent edits');
      clearTimeout(this.retryTimer);
      this.setStatus({ state: 'synced', at: Date.now() });
    } catch (e) {
      this.setStatus({ state: 'error', at: this.status.at, error: e instanceof Error ? e.message : String(e) });
      if (!this.disposed) {
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => void this.syncNow(), this.retryMs);
      }
    }
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    this.listeners.clear();
  }
}
