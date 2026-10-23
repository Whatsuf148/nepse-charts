import { useEffect, useState } from 'react';
import type { Holding, Stock } from '../types';
import { getCandlesCached } from '../data/provider';
import { useLocal } from '../lib/useLocal';
import { downloadCsv } from '../lib/csv';

export default function Portfolio({ stocks, onOpen }: { stocks: Stock[]; onOpen: (s: string) => void }) {
  const [holdings, setHoldings] = useLocal<Holding[]>('portfolio', []);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [symbol, setSymbol] = useState(stocks[0]?.symbol ?? '');
  const [qty, setQty] = useState(10);
  const [buy, setBuy] = useState(0);

  useEffect(() => {
    const syms = [...new Set(holdings.map((h) => h.symbol))];
    Promise.all(syms.map(async (s) => [s, (await getCandlesCached(s)).at(-1)?.close ?? 0] as const)).then((e) =>
      setPrices(Object.fromEntries(e)),
    );
  }, [holdings]);

  const add = () => {
    if (!symbol || qty <= 0 || buy <= 0) return;
    setHoldings([...holdings, { id: crypto.randomUUID(), symbol, qty, buyPrice: buy }]);
  };

  const cost = holdings.reduce((a, h) => a + h.qty * h.buyPrice, 0);
  const value = holdings.reduce((a, h) => a + h.qty * (prices[h.symbol] ?? h.buyPrice), 0);
  const pl = value - cost;

  return (
    <section>
      <h2>Portfolio</h2>
      <div className="filters">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {stocks.map((s) => (
            <option key={s.symbol}>{s.symbol}</option>
          ))}
        </select>
        <label>
          Qty <input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} />
        </label>
        <label>
          Buy price <input type="number" value={buy} onChange={(e) => setBuy(+e.target.value)} />
        </label>
        <button onClick={add}>Add holding</button>
        <button
          onClick={() =>
            downloadCsv('portfolio.csv', [
              ['symbol', 'qty', 'buy_price', 'ltp', 'pl'],
              ...holdings.map((h) => {
                const ltp = prices[h.symbol] ?? h.buyPrice;
                return [h.symbol, h.qty, h.buyPrice, ltp.toFixed(1), ((ltp - h.buyPrice) * h.qty).toFixed(0)];
              }),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <div className="summary">
        <div>
          Invested <b>{cost.toFixed(0)}</b>
        </div>
        <div>
          Value <b>{value.toFixed(0)}</b>
        </div>
        <div className={pl >= 0 ? 'up' : 'down'}>
          P/L <b>{pl.toFixed(0)}</b> ({cost ? ((pl / cost) * 100).toFixed(2) : '0.00'}%)
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Qty</th>
            <th>Buy</th>
            <th>LTP</th>
            <th>P/L</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const ltp = prices[h.symbol] ?? h.buyPrice;
            const p = (ltp - h.buyPrice) * h.qty;
            return (
              <tr key={h.id}>
                <td className="click" onClick={() => onOpen(h.symbol)}>
                  <b>{h.symbol}</b>
                </td>
                <td>{h.qty}</td>
                <td>{h.buyPrice}</td>
                <td>{ltp.toFixed(1)}</td>
                <td className={p >= 0 ? 'up' : 'down'}>{p.toFixed(0)}</td>
                <td>
                  <button onClick={() => setHoldings(holdings.filter((x) => x.id !== h.id))}>✕</button>
                </td>
              </tr>
            );
          })}
          {holdings.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No holdings yet. Data stays in your browser.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
