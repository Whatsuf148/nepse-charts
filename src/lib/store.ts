import type { Doc } from '../sync/merge';

/** Keys that follow the signed-in user across devices. Everything else stays local. */
export const SYNCED_KEYS = ['watchlist', 'portfolio', 'alerts', 'drawings', 'overlays', 'pane', 'compare'] as const;
export const isSynced = (k: string) => (SYNCED_KEYS as readonly string[]).includes(k);

const META = 'sync:updated';
const OWNER = 'sync:owner';

export interface Change {
  key: string;
}

const cache = new Map<string, unknown>();
const explicit = new Set<string>(); // keys that hold a real value (vs. a default)
const listeners = new Set<() => void>();
const changeListeners = new Set<(c: Change) => void>();

function read(k: string): unknown {
  try {
    const raw = localStorage.getItem(k);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable: the in-memory cache still works for this session */
  }
}
function remove(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

let meta: Record<string, number> = (read(META) as Record<string, number> | undefined) ?? {};
const notify = () => listeners.forEach((l) => l());

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Subscribe to changes made by the user on this device (not ones applied from the cloud). */
export function onUserChange(cb: (c: Change) => void) {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

export function get<T>(key: string, initial: T): T {
  if (!cache.has(key)) {
    const v = read(key);
    if (v !== undefined) explicit.add(key);
    cache.set(key, v === undefined ? initial : v);
  }
  return cache.get(key) as T;
}

export function set(key: string, value: unknown) {
  cache.set(key, value);
  explicit.add(key);
  write(key, value);
  if (isSynced(key)) {
    meta = { ...meta, [key]: Date.now() };
    write(META, meta);
  }
  notify();
  changeListeners.forEach((l) => l({ key }));
}

/** Apply a value that came from the cloud, keeping its timestamp. */
export function applyRemote(key: string, value: unknown, ts: number) {
  cache.set(key, value);
  explicit.add(key);
  write(key, value);
  meta = { ...meta, [key]: ts };
  write(META, meta);
  notify();
}

export function snapshot(): Doc {
  const data: Record<string, unknown> = {};
  const updated: Record<string, number> = {};
  for (const k of SYNCED_KEYS) {
    // Look without caching a placeholder default for keys the user never set.
    if (!explicit.has(k)) {
      const stored = read(k);
      if (stored === undefined) continue;
      cache.set(k, stored);
      explicit.add(k);
    }
    data[k] = cache.get(k);
    if (meta[k]) updated[k] = meta[k];
  }
  return { data, updated };
}

/** Forget all synced data on this device (the cloud copy is untouched). */
export function clearSynced() {
  for (const k of SYNCED_KEYS) {
    cache.delete(k);
    explicit.delete(k);
    remove(k);
  }
  meta = {};
  remove(META);
  notify();
}

export const getOwner = () => (read(OWNER) as string | undefined) ?? null;
export function setOwner(id: string | null) {
  if (id) write(OWNER, id);
  else remove(OWNER);
}
