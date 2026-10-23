import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Vendor } from './vendors/types.js';
import { getVendor } from './vendors/index.js';

const SYMBOL = /^[A-Z0-9]{1,12}$/;

export function stocksHandler(vendor: () => Vendor = getVendor) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
    try {
      const v = vendor();
      const data = await v.listStocks();
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('X-Data-Source', v.name);
      return res.status(200).json(data);
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'upstream data unavailable' });
    }
  };
}

export function candlesHandler(vendor: () => Vendor = getVendor) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
    const raw = req.query.symbol;
    const symbol = String(Array.isArray(raw) ? raw[0] : raw ?? '').toUpperCase();
    if (!SYMBOL.test(symbol)) return res.status(400).json({ error: 'invalid symbol' });
    try {
      const v = vendor();
      const stocks = await v.listStocks();
      if (!stocks.some((s) => s.symbol === symbol)) return res.status(404).json({ error: 'unknown symbol' });
      const data = await v.getCandles(symbol);
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      res.setHeader('X-Data-Source', v.name);
      return res.status(200).json(data);
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'upstream data unavailable' });
    }
  };
}
