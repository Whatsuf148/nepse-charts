import type { Candle, Stock } from '../src/types';

export const STOCKS: Stock[] = [
  { symbol: 'NABIL', name: 'Nabil Bank', sector: 'Commercial Banks' },
  { symbol: 'NICA', name: 'NIC Asia Bank', sector: 'Commercial Banks' },
  { symbol: 'SCBL', name: 'Standard Chartered Bank Nepal', sector: 'Commercial Banks' },
  { symbol: 'ADBL', name: 'Agricultural Development Bank', sector: 'Commercial Banks' },
  { symbol: 'GBIME', name: 'Global IME Bank', sector: 'Commercial Banks' },
  { symbol: 'NTC', name: 'Nepal Telecom', sector: 'Others' },
  { symbol: 'HRL', name: 'Himalayan Reinsurance', sector: 'Insurance' },
  { symbol: 'NLIC', name: 'Nepal Life Insurance', sector: 'Life Insurance' },
  { symbol: 'UPPER', name: 'Upper Tamakoshi Hydropower', sector: 'Hydropower' },
  { symbol: 'CHCL', name: 'Chilime Hydropower', sector: 'Hydropower' },
  { symbol: 'SHIVM', name: 'Shivam Cements', sector: 'Manufacturing' },
  { symbol: 'NIFRA', name: 'Nepal Infrastructure Bank', sector: 'Investment' },
];

// ---------- demo provider (synthetic data, clearly not real prices) ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function genCandles(symbol: string, bars = 520): Candle[] {
  const rnd = mulberry32(hash(symbol));
  let price = 200 + rnd() * 1200;
  const drift = (rnd() - 0.45) * 0.0015;
  const vol = 0.012 + rnd() * 0.015;
  const baseVolume = 20000 + rnd() * 200000;

  // NEPSE trades Sunday-Thursday.
  const days: Date[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (days.length < bars) {
    const dow = d.getUTCDay();
    if (dow !== 5 && dow !== 6) days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  days.reverse();

  return days.map((day) => {
    const open = price;
    const change = drift + (rnd() - 0.5) * 2 * vol;
    const close = Math.max(10, open * (1 + change));
    const high = Math.max(open, close) * (1 + rnd() * vol * 0.6);
    const low = Math.min(open, close) * (1 - rnd() * vol * 0.6);
    const volume = Math.round(baseVolume * (0.4 + rnd() * 1.6) * (1 + Math.abs(change) * 30));
    price = close;
    const r = (n: number) => Math.round(n * 10) / 10;
    return { time: iso(day), open: r(open), high: r(high), low: r(low), close: r(close), volume };
  });
}
