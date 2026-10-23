export interface Candle {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
}

export interface Point {
  time: string;
  value: number;
}

export interface Holding {
  id: string;
  symbol: string;
  qty: number;
  buyPrice: number;
}

export interface Alert {
  id: string;
  symbol: string;
  direction: 'above' | 'below';
  price: number;
  triggered: boolean;
}

export type Tool = 'none' | 'hline' | 'trend';

export type Drawing =
  | { id: string; kind: 'hline'; price: number }
  | { id: string; kind: 'trend'; t1: string; p1: number; t2: string; p2: number };
