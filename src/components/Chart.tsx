import { useEffect, useRef } from 'react';
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '../types';
import { bollinger, ema, macd, rsi, sma } from '../lib/indicators';

export interface Overlays {
  sma20: boolean;
  sma50: boolean;
  ema200: boolean;
  bb: boolean;
}
export type Pane = 'none' | 'rsi' | 'macd';

const t = (x: string) => x as Time;
const dark = {
  layout: { background: { color: '#0f1419' }, textColor: '#9aa4b2' },
  grid: { vertLines: { color: '#1b232d' }, horzLines: { color: '#1b232d' } },
  rightPriceScale: { borderColor: '#243040' },
  timeScale: { borderColor: '#243040' },
};

export default function Chart({
  candles,
  overlays,
  pane,
}: {
  candles: Candle[];
  overlays: Overlays;
  pane: Pane;
}) {
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || candles.length === 0) return;
    const main: IChartApi = createChart(mainRef.current, {
      ...dark,
      height: 420,
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    const price = main.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    price.setData(candles.map((c) => ({ ...c, time: t(c.time) })));

    const vol = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(
      candles.map((c) => ({
        time: t(c.time),
        value: c.volume,
        color: c.close >= c.open ? '#26a69a55' : '#ef535055',
      })),
    );

    const line = (data: { time: string; value: number }[], color: string, width: 1 | 2 = 1) => {
      const s: ISeriesApi<'Line'> = main.addLineSeries({
        color,
        lineWidth: width,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(data.map((p) => ({ time: t(p.time), value: p.value })));
    };
    if (overlays.sma20) line(sma(candles, 20), '#f5c542');
    if (overlays.sma50) line(sma(candles, 50), '#4da3ff');
    if (overlays.ema200) line(ema(candles, 200), '#c77dff', 2);
    if (overlays.bb) {
      const b = bollinger(candles);
      line(b.upper, '#6b7a8c');
      line(b.lower, '#6b7a8c');
    }

    let sub: IChartApi | null = null;
    if (pane !== 'none' && subRef.current) {
      sub = createChart(subRef.current, { ...dark, height: 160, autoSize: true });
      const sl = (data: { time: string; value: number }[], color: string) => {
        const s = sub!.addLineSeries({ color, lineWidth: 1, priceLineVisible: false });
        s.setData(data.map((p) => ({ time: t(p.time), value: p.value })));
        return s;
      };
      if (pane === 'rsi') {
        const s = sl(rsi(candles), '#f5c542');
        s.createPriceLine({ price: 70, color: '#ef5350', lineWidth: 1, lineStyle: 2, title: '70' });
        s.createPriceLine({ price: 30, color: '#26a69a', lineWidth: 1, lineStyle: 2, title: '30' });
      } else {
        const m = macd(candles);
        const h = sub.addHistogramSeries({ priceLineVisible: false });
        h.setData(
          m.hist.map((p) => ({ time: t(p.time), value: p.value, color: p.value >= 0 ? '#26a69a' : '#ef5350' })),
        );
        sl(m.macd, '#4da3ff');
        sl(m.signal, '#f5c542');
      }
      // keep the two time axes in sync
      const subChart = sub;
      main.timeScale().subscribeVisibleLogicalRangeChange((r) => r && subChart.timeScale().setVisibleLogicalRange(r));
      subChart.timeScale().subscribeVisibleLogicalRangeChange((r) => r && main.timeScale().setVisibleLogicalRange(r));
    }

    main.timeScale().setVisibleLogicalRange({ from: candles.length - 130, to: candles.length + 5 });

    return () => {
      main.remove();
      sub?.remove();
    };
  }, [candles, overlays, pane]);

  return (
    <div>
      <div ref={mainRef} className="chart-main" />
      {pane !== 'none' && <div ref={subRef} className="chart-sub" />}
    </div>
  );
}
