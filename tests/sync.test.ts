import { describe, expect, it } from 'vitest';
import { mergeDocs, type Doc } from '../src/sync/merge';
import { SyncEngine, type LocalStore, type Remote } from '../src/sync/engine';
import { acceptValue } from '../src/sync/schema';

const doc = (data: Record<string, unknown>, updated: Record<string, number>): Doc => ({ data, updated });
const KEYS = ['watchlist', 'pane'];

describe('mergeDocs', () => {
  it('takes the cloud value when local has nothing', () => {
    const r = mergeDocs(doc({}, {}), doc({ watchlist: ['A'] }, { watchlist: 5 }), KEYS);
    expect(r.applyLocal).toEqual(['watchlist']);
    expect(r.remoteChanged).toBe(false);
  });
  it('pushes a local value the cloud lacks, stamping legacy values with now', () => {
    const r = mergeDocs(doc({ pane: 'rsi' }, {}), doc({}, {}), KEYS, () => true, 99);
    expect(r.applyLocal).toEqual([]);
    expect(r.remoteChanged).toBe(true);
    expect(r.merged.updated.pane).toBe(99);
  });
  it('newer side wins per key, independently', () => {
    const local = doc({ watchlist: ['L'], pane: 'none' }, { watchlist: 10, pane: 1 });
    const remote = doc({ watchlist: ['R'], pane: 'macd' }, { watchlist: 5, pane: 7 });
    const r = mergeDocs(local, remote, KEYS);
    expect(r.merged.data).toEqual({ watchlist: ['L'], pane: 'macd' });
    expect(r.applyLocal).toEqual(['pane']);
    expect(r.remoteChanged).toBe(true);
  });
  it('does nothing when both sides already agree', () => {
    const d = doc({ pane: 'rsi' }, { pane: 3 });
    const r = mergeDocs(d, d, KEYS);
    expect(r.applyLocal).toEqual([]);
    expect(r.remoteChanged).toBe(false);
  });
  it('ignores invalid cloud values and keeps unknown cloud keys', () => {
    const r = mergeDocs(
      doc({ pane: 'rsi' }, { pane: 1 }),
      doc({ pane: 'garbage', other: 1 }, { pane: 9, other: 2 }),
      KEYS,
      acceptValue,
    );
    expect(r.merged.data.pane).toBe('rsi');
    expect(r.merged.data.other).toBe(1);
    expect(r.remoteChanged).toBe(true);
  });
});

describe('acceptValue', () => {
  it('validates shapes', () => {
    expect(acceptValue('watchlist', ['NABIL'])).toBe(true);
    expect(acceptValue('watchlist', 'NABIL')).toBe(false);
    expect(acceptValue('portfolio', [{ id: '1', symbol: 'A', qty: 1, buyPrice: 2 }])).toBe(true);
    expect(acceptValue('portfolio', [{ id: '1', symbol: 'A', qty: '1', buyPrice: 2 }])).toBe(false);
    expect(acceptValue('drawings', { NABIL: [{ id: '1', kind: 'hline', price: 5 }] })).toBe(true);
    expect(acceptValue('drawings', { NABIL: [{ id: '1', kind: 'nope' }] })).toBe(false);
    expect(acceptValue('unknown', 1)).toBe(false);
  });
});

// ---- two devices against a fake cloud with optimistic versioning ----
class FakeCloud {
  row: { doc: Doc; version: number } | null = null;
  failNextPush = 0;
  remote(): Remote {
    return {
      pull: async () => (this.row ? { doc: structuredClone(this.row.doc), version: this.row.version } : null),
      push: async (d, version) => {
        if (this.failNextPush > 0) {
          this.failNextPush--;
          return false;
        }
        if ((this.row?.version ?? null) !== version) return false;
        this.row = { doc: structuredClone(d), version: (version ?? 0) + 1 };
        return true;
      },
    };
  }
}

class Device implements LocalStore {
  data: Record<string, unknown> = {};
  updated: Record<string, number> = {};
  engine: SyncEngine;
  constructor(cloud: FakeCloud) {
    this.engine = new SyncEngine(this, cloud.remote(), KEYS, acceptValue, 0, 1_000_000);
  }
  snapshot(): Doc {
    return { data: structuredClone(this.data), updated: { ...this.updated } };
  }
  apply(k: string, v: unknown, ts: number) {
    this.data[k] = v;
    this.updated[k] = ts;
  }
  edit(k: string, v: unknown, ts: number) {
    this.data[k] = v;
    this.updated[k] = ts;
  }
}

describe('SyncEngine', () => {
  it('propagates edits between two devices', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    const b = new Device(cloud);
    a.edit('watchlist', ['NABIL', 'NTC'], 100);
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.data.watchlist).toEqual(['NABIL', 'NTC']);

    b.edit('pane', 'macd', 200);
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.data.pane).toBe('macd');
    expect(a.engine.status.state).toBe('synced');
  });

  it('keeps the newer edit when devices change the same key', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    const b = new Device(cloud);
    a.edit('pane', 'rsi', 100);
    await a.engine.syncNow();
    await b.engine.syncNow();
    b.edit('pane', 'none', 300);
    a.edit('pane', 'macd', 200);
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.data.pane).toBe('none');
    expect(cloud.row?.doc.data.pane).toBe('none');
  });

  it('retries after a lost write race and does not drop either edit', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    a.edit('watchlist', ['A'], 100);
    cloud.failNextPush = 2; // simulate two lost races
    await a.engine.syncNow();
    expect(a.engine.status.state).toBe('synced');
    expect(cloud.row?.doc.data.watchlist).toEqual(['A']);
  });

  it('reports an error (and keeps local data) when the cloud is unreachable', async () => {
    const a = new Device(new FakeCloud());
    a.edit('pane', 'rsi', 1);
    const broken = new SyncEngine(a, { pull: async () => Promise.reject(new Error('offline')), push: async () => true }, KEYS, acceptValue, 0, 1_000_000);
    await broken.syncNow();
    expect(broken.status.state).toBe('error');
    expect(broken.status.error).toBe('offline');
    expect(a.data.pane).toBe('rsi');
    broken.dispose();
  });

  it('gives up after repeated conflicts', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    a.edit('pane', 'rsi', 1);
    cloud.failNextPush = 99;
    await a.engine.syncNow();
    expect(a.engine.status.state).toBe('error');
    a.engine.dispose();
  });
});
