import type { Candle, Point } from '../types';

export function sma(c: Candle[], period: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  for (let i = 0; i < c.length; i++) {
    sum += c[i].close;
    if (i >= period) sum -= c[i - period].close;
    if (i >= period - 1) out.push({ time: c[i].time, value: sum / period });
  }
  return out;
}

function emaValues(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function ema(c: Candle[], period: number): Point[] {
  const e = emaValues(c.map((x) => x.close), period);
  return c.slice(period - 1).map((x, i) => ({ time: x.time, value: e[i + period - 1] }));
}

export function rsi(c: Candle[], period = 14): Point[] {
  const out: Point[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < c.length; i++) {
    const d = c[i].close - c[i - 1].close;
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        out.push({ time: c[i].time, value: loss === 0 ? 100 : 100 - 100 / (1 + gain / loss) });
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out.push({ time: c[i].time, value: loss === 0 ? 100 : 100 - 100 / (1 + gain / loss) });
    }
  }
  return out;
}

export function macd(c: Candle[], fast = 12, slow = 26, signal = 9) {
  const closes = c.map((x) => x.close);
  const f = emaValues(closes, fast);
  const s = emaValues(closes, slow);
  const line = closes.map((_, i) => f[i] - s[i]);
  const sig = emaValues(line, signal);
  const start = slow - 1;
  const mk = (arr: number[]): Point[] => c.slice(start).map((x, i) => ({ time: x.time, value: arr[i + start] }));
  return { macd: mk(line), signal: mk(sig), hist: mk(line.map((v, i) => v - sig[i])) };
}

export function bollinger(c: Candle[], period = 20, mult = 2) {
  const upper: Point[] = [];
  const lower: Point[] = [];
  for (let i = period - 1; i < c.length; i++) {
    const w = c.slice(i - period + 1, i + 1).map((x) => x.close);
    const mean = w.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    upper.push({ time: c[i].time, value: mean + mult * sd });
    lower.push({ time: c[i].time, value: mean - mult * sd });
  }
  return { upper, lower };
}

export const last = <T,>(a: T[]): T | undefined => a[a.length - 1];
