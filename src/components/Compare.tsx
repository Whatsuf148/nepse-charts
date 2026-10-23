import { useEffect, useRef, useState } from 'react';
import { createChart, type Time } from 'lightweight-charts';
import type { Stock } from '../types';
import { getCandlesCached } from '../data/provider';
import { useLocal } from '../lib/useLocal';

const COLORS = ['#4da3ff', '#f5c542', '#26a69a', '#c77dff', '#ff8a65'];
const RANGES = { '3M': 63, '6M': 126, '1Y': 252, All: 100000 } as const;

export default function Compare({ stocks }: { stocks: Stock[] }) {
  const [picked, setPicked] = useLocal<string[]>('compare', ['NABIL', 'NICA']);
  const [range, setRange] = useState<keyof typeof RANGES>('6M');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || picked.length === 0) return;
    let alive = true;
    const chart = createChart(ref.current, {
      layout: { background: { color: '#0f1419' }, textColor: '#9aa4b2' },
      grid: { vertLines: { color: '#1b232d' }, horzLines: { color: '#1b232d' } },
      rightPriceScale: { borderColor: '#243040' },
      timeScale: { borderColor: '#243040' },
      autoSize: true,
    });
    Promise.all(picked.map((s) => getCandlesCached(s))).then((all) => {
      if (!alive) return;
      all.forEach((c, i) => {
        const slice = c.slice(-RANGES[range]);
        if (slice.length === 0) return;
        const base = slice[0].close;
        const s = chart.addLineSeries({ color: COLORS[i % COLORS.length], lineWidth: 2, title: picked[i] });
        s.setData(slice.map((x) => ({ time: x.time as Time, value: (x.close / base) * 100 })));
      });
      chart.timeScale().fitContent();
    });
    return () => {
      alive = false;
      chart.remove();
    };
  }, [picked, range]);

  return (
    <section>
      <h2>Compare (rebased to 100)</h2>
      <div className="filters">
        {picked.map((s, i) => (
          <span key={s} className="chip" style={{ borderColor: COLORS[i % COLORS.length] }}>
            {s} <button onClick={() => setPicked(picked.filter((x) => x !== s))}>✕</button>
          </span>
        ))}
        {picked.length < 5 && (
          <select value="" onChange={(e) => e.target.value && setPicked([...picked, e.target.value])}>
            <option value="">+ Add symbol</option>
            {stocks.filter((s) => !picked.includes(s.symbol)).map((s) => (
              <option key={s.symbol}>{s.symbol}</option>
            ))}
          </select>
        )}
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
          <button key={r} className={r === range ? 'active' : ''} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>
      <div ref={ref} className="chart-main" />
    </section>
  );
}
