import type { Candle, Stock } from '../../../src/types';

/**
 * A market-data vendor. Implement this to plug in a licensed NEPSE feed;
 * the HTTP handlers and the frontend never see vendor-specific shapes.
 */
export interface Vendor {
  readonly name: string;
  listStocks(): Promise<Stock[]>;
  /** Daily candles, oldest first. */
  getCandles(symbol: string): Promise<Candle[]>;
}
