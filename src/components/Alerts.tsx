import { useEffect, useState } from 'react';
import type { Alert, Stock } from '../types';
import { getCandlesCached } from '../data/provider';
import { useLocal } from '../lib/useLocal';

export default function Alerts({ stocks }: { stocks: Stock[] }) {
  const [alerts, setAlerts] = useLocal<Alert[]>('alerts', []);
  const [symbol, setSymbol] = useState(stocks[0]?.symbol ?? '');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState(0);

  // Re-check alerts against the latest close whenever the list changes.
  useEffect(() => {
    let alive = true;
    (async () => {
      let changed = false;
      const next: Alert[] = [];
      for (const a of alerts) {
        const ltp = (await getCandlesCached(a.symbol)).at(-1)?.close;
        const hit = ltp !== undefined && (a.direction === 'above' ? ltp >= a.price : ltp <= a.price);
        if (hit && !a.triggered) changed = true;
        next.push(hit ? { ...a, triggered: true } : a);
      }
      if (alive && changed) setAlerts(next);
    })();
    return () => {
      alive = false;
    };
  }, [alerts, setAlerts]);

  return (
    <section>
      <h2>Price alerts</h2>
      <div className="filters">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {stocks.map((s) => (
            <option key={s.symbol}>{s.symbol}</option>
          ))}
        </select>
        <select value={direction} onChange={(e) => setDirection(e.target.value as 'above' | 'below')}>
          <option value="above">rises above</option>
          <option value="below">falls below</option>
        </select>
        <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} />
        <button
          onClick={() =>
            price > 0 &&
            setAlerts([...alerts, { id: crypto.randomUUID(), symbol, direction, price, triggered: false }])
          }
        >
          Add alert
        </button>
      </div>
      <ul className="alerts">
        {alerts.map((a) => (
          <li key={a.id} className={a.triggered ? 'hit' : ''}>
            {a.triggered ? '🔔 ' : ''}
            <b>{a.symbol}</b> {a.direction === 'above' ? 'rises above' : 'falls below'} {a.price}
            <button onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))}>✕</button>
          </li>
        ))}
        {alerts.length === 0 && <li className="muted">No alerts set.</li>}
      </ul>
      <p className="muted">
        Alerts are evaluated in this browser against the loaded data. For push/email alerts you will need a backend.
      </p>
    </section>
  );
}
