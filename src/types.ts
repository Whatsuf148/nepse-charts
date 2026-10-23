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
