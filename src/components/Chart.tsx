import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { Candle, Drawing, Tool } from '../types';
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
  drawings,
  tool,
  onDraw,
}: {
  candles: Candle[];
  overlays: Overlays;
  pane: Pane;
  drawings: Drawing[];
  tool: Tool;
  onDraw: (d: Drawing) => void;
}) {
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const onDrawRef = useRef(onDraw);
  onDrawRef.current = onDraw;
  const pending = useRef<{ t: string; p: number } | null>(null);
  const saved = useRef<{ candles: Candle[]; range: { from: number; to: number } | null }>({ candles, range: null });
  const [hint, setHint] = useState('');

  useEffect(() => {
    pending.current = null;
    setHint(tool === 'hline' ? 'Click on the chart to place a horizontal line' : tool === 'trend' ? 'Click the first point of the trendline' : '');
  }, [tool]);

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

    drawings.forEach((d) => {
      if (d.kind === 'hline') {
        price.createPriceLine({ price: d.price, color: '#f5c542', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '' });
      } else if (d.t1 !== d.t2) {
        const [a, b] = d.t1 < d.t2 ? [[d.t1, d.p1], [d.t2, d.p2]] : [[d.t2, d.p2], [d.t1, d.p1]];
        const tl = main.addLineSeries({
          color: '#ff8a65',
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        tl.setData([
          { time: t(a[0] as string), value: a[1] as number },
          { time: t(b[0] as string), value: b[1] as number },
        ]);
      }
    });

    const el = mainRef.current;
    const onClick = (e: MouseEvent) => {
      // Native click rather than the library's: it drops quick successive clicks.
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < 0 || x > main.timeScale().width()) return; // ignore the price axis
      const p = price.coordinateToPrice(y);
      const bar = main.timeScale().coordinateToTime(x);
      if (p === null) return;
      const rounded = Math.round(p * 10) / 10;
      if (tool === 'hline') {
        onDrawRef.current({ id: crypto.randomUUID(), kind: 'hline', price: rounded });
      } else if (typeof bar === 'string') {
        if (!pending.current) {
          pending.current = { t: bar, p: rounded };
          setHint('Click the second point');
        } else if (pending.current.t !== bar) {
          const f = pending.current;
          pending.current = null;
          setHint('Click the first point of the trendline');
          onDrawRef.current({ id: crypto.randomUUID(), kind: 'trend', t1: f.t, p1: f.p, t2: bar, p2: rounded });
        }
      }
    };
    if (tool !== 'none') el.addEventListener('click', onClick);

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

    // keep the user's zoom/pan when only overlays/drawings change
    main.timeScale().setVisibleLogicalRange(
      saved.current.candles === candles && saved.current.range
        ? saved.current.range
        : { from: candles.length - 130, to: candles.length + 5 },
    );

    return () => {
      el.removeEventListener('click', onClick);
      saved.current = { candles, range: main.timeScale().getVisibleLogicalRange() };
      main.remove();
      sub?.remove();
    };
  }, [candles, overlays, pane, drawings, tool]);

  return (
    <div>
      {hint && <div className="hint">{hint}</div>}
      <div ref={mainRef} className={`chart-main${tool !== 'none' ? ' drawing' : ''}`} />
      {pane !== 'none' && <div ref={subRef} className="chart-sub" />}
    </div>
  );
}
