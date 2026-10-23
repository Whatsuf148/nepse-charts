import { useEffect, useMemo, useState } from 'react';
import type { Stock } from '../types';
import { getCandlesCached } from '../data/provider';
import { rsi, sma, last } from '../lib/indicators';

interface Row {
  stock: Stock;
  close: number;
  changePct: number;
  rsi: number;
  vsSma50: number;
  volRatio: number;
}

export default function Screener({ stocks, onOpen }: { stocks: Stock[]; onOpen: (s: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [maxRsi, setMaxRsi] = useState(100);
  const [minRsi, setMinRsi] = useState(0);
  const [aboveSma, setAboveSma] = useState(false);
  const [minVol, setMinVol] = useState(0);
  const [sort, setSort] = useState<keyof Row | 'symbol'>('changePct');
  const [desc, setDesc] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all(
      stocks.map(async (stock): Promise<Row | null> => {
        const c = await getCandlesCached(stock.symbol);
        if (c.length < 60) return null;
        const l = c[c.length - 1];
        const prev = c[c.length - 2];
        const avgVol = c.slice(-21, -1).reduce((a, x) => a + x.volume, 0) / 20;
        return {
          stock,
          close: l.close,
          changePct: ((l.close - prev.close) / prev.close) * 100,
          rsi: last(rsi(c))?.value ?? 50,
          vsSma50: ((l.close - (last(sma(c, 50))?.value ?? l.close)) / l.close) * 100,
          volRatio: l.volume / avgVol,
        };
      }),
    ).then((r) => alive && setRows(r.filter((x): x is Row => x !== null)));
    return () => {
      alive = false;
    };
  }, [stocks]);

  const view = useMemo(() => {
    const f = rows.filter(
      (r) => r.rsi <= maxRsi && r.rsi >= minRsi && (!aboveSma || r.vsSma50 > 0) && r.volRatio >= minVol,
    );
    const key = (r: Row) => (sort === 'symbol' ? r.stock.symbol : (r[sort] as number));
    f.sort((a, b) => (key(a) > key(b) ? 1 : -1) * (desc ? -1 : 1));
    return f;
  }, [rows, maxRsi, minRsi, aboveSma, minVol, sort, desc]);

  const th = (k: keyof Row | 'symbol', label: string) => (
    <th
      onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(true)))}
      className="sortable"
    >
      {label}
      {sort === k ? (desc ? ' ▼' : ' ▲') : ''}
    </th>
  );

  return (
    <section>
      <h2>Screener</h2>
      <div className="filters">
        <label>
          RSI min <input type="number" value={minRsi} onChange={(e) => setMinRsi(+e.target.value)} />
        </label>
        <label>
          RSI max <input type="number" value={maxRsi} onChange={(e) => setMaxRsi(+e.target.value)} />
        </label>
        <label>
          Volume ≥ <input type="number" step="0.1" value={minVol} onChange={(e) => setMinVol(+e.target.value)} />× avg
        </label>
        <label>
          <input type="checkbox" checked={aboveSma} onChange={(e) => setAboveSma(e.target.checked)} /> Above SMA50
        </label>
        <button onClick={() => (setMinRsi(0), setMaxRsi(30))}>Oversold</button>
        <button onClick={() => (setMinRsi(70), setMaxRsi(100))}>Overbought</button>
        <button onClick={() => (setMinRsi(0), setMaxRsi(100), setMinVol(0), setAboveSma(false))}>Reset</button>
      </div>
      <table>
        <thead>
          <tr>
            {th('symbol', 'Symbol')}
            <th>Sector</th>
            {th('close', 'Close')}
            {th('changePct', 'Chg %')}
            {th('rsi', 'RSI')}
            {th('vsSma50', 'vs SMA50 %')}
            {th('volRatio', 'Vol × avg')}
          </tr>
        </thead>
        <tbody>
          {view.map((r) => (
            <tr key={r.stock.symbol} onClick={() => onOpen(r.stock.symbol)} className="click">
              <td>
                <b>{r.stock.symbol}</b>
              </td>
              <td>{r.stock.sector}</td>
              <td>{r.close.toFixed(1)}</td>
              <td className={r.changePct >= 0 ? 'up' : 'down'}>{r.changePct.toFixed(2)}</td>
              <td>{r.rsi.toFixed(1)}</td>
              <td className={r.vsSma50 >= 0 ? 'up' : 'down'}>{r.vsSma50.toFixed(2)}</td>
              <td>{r.volRatio.toFixed(2)}</td>
            </tr>
          ))}
          {view.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                No stocks match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
