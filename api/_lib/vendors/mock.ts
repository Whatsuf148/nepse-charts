import { STOCKS, genCandles } from '../../../shared/mockData.js';
import type { Vendor } from './types.js';

/** Synthetic data. Not real prices. */
export const mockVendor: Vendor = {
  name: 'mock',
  async listStocks() {
    return STOCKS;
  },
  async getCandles(symbol) {
    return genCandles(symbol);
  },
};
