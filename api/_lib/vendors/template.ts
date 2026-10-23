import type { Candle, Stock } from '../../../src/types';
import type { Vendor } from './types.js';

/**
 * Starting point for a real, licensed vendor. Fill in the two mappers once you
 * have the vendor's docs and credentials. Keys come from environment variables
 * (Vercel: Project -> Settings -> Environment Variables), never from the repo.
 *
 *   VENDOR=template
 *   VENDOR_BASE_URL=https://vendor.example.com
 *   VENDOR_API_KEY=...
 */
export function templateVendor(env: Record<string, string | undefined>): Vendor {
  const base = env.VENDOR_BASE_URL;
  const key = env.VENDOR_API_KEY;
  if (!base || !key) throw new Error('VENDOR_BASE_URL and VENDOR_API_KEY must be set');

  const get = async (path: string) => {
    const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`vendor ${path}: ${r.status}`);
    return r.json();
  };

  return {
    name: 'template',
    async listStocks(): Promise<Stock[]> {
      const raw = await get('/stocks'); // TODO: adjust path + response shape
      return raw.map((x: { symbol: string; name: string; sector: string }) => ({
        symbol: x.symbol,
        name: x.name,
        sector: x.sector,
      }));
    },
    async getCandles(symbol): Promise<Candle[]> {
      const raw = await get(`/history/${encodeURIComponent(symbol)}`); // TODO
      return raw.map((x: { date: string; o: number; h: number; l: number; c: number; v: number }) => ({
        time: x.date,
        open: x.o,
        high: x.h,
        low: x.l,
        close: x.c,
        volume: x.v,
      }));
    },
  };
}
