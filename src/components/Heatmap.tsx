import { useEffect, useMemo, useState } from 'react';
import type { Stock } from '../types';
import { getCandlesCached } from '../data/provider';

interface Tile {
  stock: Stock;
  changePct: number;
  turnover: number;
}

const colour = (p: number) => {
  const a = Math.min(Math.abs(p) / 3, 1);
  return p >= 0 ? `rgba(38,166,154,${0.2 + a * 0.7})` : `rgba(239,83,80,${0.2 + a * 0.7})`;
};

export default function Heatmap({ stocks, onOpen }: { stocks: Stock[]; onOpen: (s: string) => void }) {
  const [tiles, setTiles] = useState<Tile[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all(
      stocks.map(async (stock): Promise<Tile | null> => {
        const c = await getCandlesCached(stock.symbol);
        const l = c.at(-1);
        const p = c.at(-2);
        if (!l || !p) return null;
        return { stock, changePct: ((l.close - p.close) / p.close) * 100, turnover: l.close * l.volume };
      }),
    ).then((r) => alive && setTiles(r.filter((x): x is Tile => x !== null)));
    return () => {
      alive = false;
    };
  }, [stocks]);

  const groups = useMemo(() => {
    const m = new Map<string, Tile[]>();
    tiles.forEach((t) => m.set(t.stock.sector, [...(m.get(t.stock.sector) ?? []), t]));
    return [...m.entries()].map(([sector, ts]) => ({
      sector,
      ts: ts.sort((a, b) => b.turnover - a.turnover),
      avg: ts.reduce((a, t) => a + t.changePct, 0) / ts.length,
      total: ts.reduce((a, t) => a + t.turnover, 0),
    }));
  }, [tiles]);

  return (
    <section>
      <h2>Sector heatmap</h2>
      <p className="muted">Tile size = last-day turnover, colour = day change.</p>
      {groups.map((g) => (
        <div key={g.sector} className="hm-group">
          <div className="hm-title">
            {g.sector} <span className={g.avg >= 0 ? 'up' : 'down'}>{g.avg.toFixed(2)}%</span>
          </div>
          <div className="hm-tiles">
            {g.ts.map((t) => (
              <div
                key={t.stock.symbol}
                className="hm-tile"
                style={{ background: colour(t.changePct), flexGrow: Math.max(1, Math.round((t.turnover / g.total) * 100)) }}
                onClick={() => onOpen(t.stock.symbol)}
                title={t.stock.name}
              >
                <b>{t.stock.symbol}</b>
                <span>{t.changePct.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
