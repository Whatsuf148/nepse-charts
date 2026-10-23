import { useEffect, useMemo, useState } from 'react';
import './index.css';
import type { Candle, Stock } from './types';
import { provider } from './data/provider';
import { getCandlesCached } from './data/provider';
import { useLocal } from './lib/useLocal';
import Chart, { type Overlays, type Pane } from './components/Chart';
import Screener from './components/Screener';
import Portfolio from './components/Portfolio';
import Alerts from './components/Alerts';

type Tab = 'chart' | 'screener' | 'portfolio' | 'alerts';

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [symbol, setSymbol] = useLocal('symbol', 'NABIL');
  const [tab, setTab] = useState<Tab>('chart');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [watch, setWatch] = useLocal<string[]>('watchlist', ['NABIL', 'NTC', 'UPPER']);
  const [overlays, setOverlays] = useLocal<Overlays>('overlays', { sma20: true, sma50: true, ema200: false, bb: false });
  const [pane, setPane] = useLocal<Pane>('pane', 'rsi');

  useEffect(() => {
    provider.listStocks().then(setStocks).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setError('');
    getCandlesCached(symbol).then(setCandles).catch((e) => setError(String(e)));
  }, [symbol]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? stocks.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [stocks, query]);

  const open = (s: string) => {
    setSymbol(s);
    setTab('chart');
    setQuery('');
  };

  const l = candles.at(-1);
  const p = candles.at(-2);
  const chg = l && p ? ((l.close - p.close) / p.close) * 100 : 0;
  const info = stocks.find((s) => s.symbol === symbol);

  return (
    <div className="app">
      <header>
        <h1>NEPSE Charts</h1>
        <nav>
          {(['chart', 'screener', 'portfolio', 'alerts'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        <div className="search">
          <input placeholder="Search symbol or company…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {matches.length > 0 && (
            <ul>
              {matches.map((s) => (
                <li key={s.symbol} onClick={() => open(s.symbol)}>
                  <b>{s.symbol}</b> <span className="muted">{s.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="banner">Data source: {provider.label}. Not investment advice.</div>
      {error && <div className="error">{error}</div>}

      <main>
        <aside>
          <h3>Watchlist</h3>
          <ul>
            {watch.map((s) => (
              <li key={s} className={s === symbol ? 'sel' : ''} onClick={() => open(s)}>
                {s}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWatch(watch.filter((x) => x !== s));
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="content">
          {tab === 'chart' && (
            <section>
              <div className="title">
                <h2>
                  {symbol} <span className="muted">{info?.name}</span>
                </h2>
                {l && (
                  <div className={chg >= 0 ? 'up' : 'down'}>
                    <b>{l.close.toFixed(1)}</b> ({chg >= 0 ? '+' : ''}
                    {chg.toFixed(2)}%)
                  </div>
                )}
                <button onClick={() => !watch.includes(symbol) && setWatch([...watch, symbol])}>★ Watch</button>
              </div>
              <div className="filters">
                {(
                  [
                    ['sma20', 'SMA 20'],
                    ['sma50', 'SMA 50'],
                    ['ema200', 'EMA 200'],
                    ['bb', 'Bollinger'],
                  ] as [keyof Overlays, string][]
                ).map(([k, label]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={overlays[k]}
                      onChange={(e) => setOverlays({ ...overlays, [k]: e.target.checked })}
                    />{' '}
                    {label}
                  </label>
                ))}
                <select value={pane} onChange={(e) => setPane(e.target.value as Pane)}>
                  <option value="none">No indicator pane</option>
                  <option value="rsi">RSI (14)</option>
                  <option value="macd">MACD</option>
                </select>
              </div>
              <Chart candles={candles} overlays={overlays} pane={pane} />
            </section>
          )}
          {tab === 'screener' && stocks.length > 0 && <Screener stocks={stocks} onOpen={open} />}
          {tab === 'portfolio' && stocks.length > 0 && <Portfolio stocks={stocks} onOpen={open} />}
          {tab === 'alerts' && stocks.length > 0 && <Alerts stocks={stocks} />}
        </div>
      </main>
    </div>
  );
}
