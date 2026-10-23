/**
 * Cloud data is untrusted input (it could be stale, from an old version, or edited by hand).
 * Each synced key gets a shape check; values that fail are ignored rather than crashing the UI.
 */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isArr = Array.isArray;
const str = (v: unknown) => typeof v === 'string';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

const checks: Record<string, (v: unknown) => boolean> = {
  watchlist: (v) => isArr(v) && v.length <= 500 && v.every(str),
  compare: (v) => isArr(v) && v.length <= 10 && v.every(str),
  pane: (v) => v === 'none' || v === 'rsi' || v === 'macd',
  overlays: (v) => isObj(v) && ['sma20', 'sma50', 'ema200', 'bb'].every((k) => typeof v[k] === 'boolean'),
  portfolio: (v) =>
    isArr(v) && v.length <= 2000 && v.every((h) => isObj(h) && str(h.id) && str(h.symbol) && num(h.qty) && num(h.buyPrice)),
  alerts: (v) =>
    isArr(v) &&
    v.length <= 500 &&
    v.every(
      (a) =>
        isObj(a) && str(a.id) && str(a.symbol) && (a.direction === 'above' || a.direction === 'below') && num(a.price) && typeof a.triggered === 'boolean',
    ),
  drawings: (v) =>
    isObj(v) &&
    Object.values(v).every(
      (list) =>
        isArr(list) &&
        list.length <= 200 &&
        list.every(
          (d) =>
            isObj(d) &&
            str(d.id) &&
            ((d.kind === 'hline' && num(d.price)) || (d.kind === 'trend' && str(d.t1) && str(d.t2) && num(d.p1) && num(d.p2))),
        ),
    ),
};

export const acceptValue = (key: string, value: unknown) => (checks[key] ? checks[key](value) : false);
