import type { Candle, Stock } from '../types';

/**
 * Everything the UI knows about market data goes through this interface.
 * Swap the implementation to plug in a real NEPSE feed.
 */
export interface DataProvider {
  readonly label: string;
  listStocks(): Promise<Stock[]>;
  getCandles(symbol: string): Promise<Candle[]>;
}

import { STOCKS, genCandles } from '../../shared/mockData';
export { STOCKS };

export const demoProvider: DataProvider = {
  label: 'Demo data (synthetic)',
  async listStocks() {
    return STOCKS;
  },
  async getCandles(symbol) {
    return genCandles(symbol);
  },
};

// ---------- HTTP provider: point it at YOUR OWN backend / licensed feed ----------

export function httpProvider(baseUrl: string): DataProvider {
  return {
    label: `API: ${baseUrl}`,
    async listStocks() {
      const r = await fetch(`${baseUrl}/stocks`);
      if (!r.ok) throw new Error(`stocks: ${r.status}`);
      return r.json();
    },
    async getCandles(symbol) {
      const r = await fetch(`${baseUrl}/candles/${encodeURIComponent(symbol)}`);
      if (!r.ok) throw new Error(`candles ${symbol}: ${r.status}`);
      return r.json();
    },
  };
}

const apiUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL;
export const provider: DataProvider = apiUrl ? httpProvider(apiUrl) : demoProvider;

const cache = new Map<string, Promise<Candle[]>>();
export function getCandlesCached(symbol: string) {
  let p = cache.get(symbol);
  if (!p) {
    p = provider.getCandles(symbol);
    cache.set(symbol, p);
  }
  return p;
}
