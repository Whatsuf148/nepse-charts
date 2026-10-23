import { beforeEach, describe, expect, it } from 'vitest';

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const store = await import('../src/lib/store');

beforeEach(() => store.clearSynced());

describe('store', () => {
  it('only snapshots synced keys that were actually set', () => {
    expect(store.get('watchlist', ['x'])).toEqual(['x']);
    expect(store.snapshot().data).toEqual({}); // defaults are not user data
    store.set('watchlist', ['NABIL']);
    store.set('symbol', 'NTC'); // local-only key
    const s = store.snapshot();
    expect(s.data).toEqual({ watchlist: ['NABIL'] });
    expect(s.updated.watchlist).toBeGreaterThan(0);
    expect(mem.get('symbol')).toBe('"NTC"');
  });

  it('applyRemote keeps the cloud timestamp and does not fire user-change listeners', () => {
    let fired = 0;
    const off = store.onUserChange(() => fired++);
    store.applyRemote('pane', 'macd', 1234);
    expect(store.snapshot().updated.pane).toBe(1234);
    expect(fired).toBe(0);
    store.set('pane', 'rsi');
    expect(fired).toBe(1);
    off();
  });

  it('clearSynced wipes synced data but not local-only keys', () => {
    store.set('portfolio', [{ id: '1', symbol: 'A', qty: 1, buyPrice: 1 }]);
    store.set('symbol', 'NTC');
    store.clearSynced();
    expect(store.snapshot().data).toEqual({});
    expect(store.get('portfolio', [])).toEqual([]);
    expect(mem.has('portfolio')).toBe(false);
    expect(mem.has('symbol')).toBe(true);
  });

  it('tracks the account that owns the local data', () => {
    expect(store.getOwner()).toBeNull();
    store.setOwner('u1');
    expect(store.getOwner()).toBe('u1');
    store.setOwner(null);
    expect(store.getOwner()).toBeNull();
  });
});
