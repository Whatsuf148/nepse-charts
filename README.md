# NEPSE Charts

Web app: candlestick charts (SMA/EMA/Bollinger, RSI, MACD), watchlist, screener, portfolio P/L, price alerts.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static site in dist/

## Data and backend

The `api/` folder is a Vercel serverless backend:

- `GET /api/stocks` -> `[{symbol,name,sector}]`
- `GET /api/candles/:symbol` -> `[{time:"YYYY-MM-DD",open,high,low,close,volume}]` (oldest first)

Data comes from a **vendor adapter** (`api/_lib/vendors/`) chosen by the `VENDOR` env var:

| VENDOR | Source |
| --- | --- |
| `mock` (default) | Synthetic demo data. Not real prices. |
| `template` | Skeleton for a licensed vendor. Fill in the two mappers in `template.ts`, then set `VENDOR_BASE_URL` and `VENDOR_API_KEY` in Vercel env vars. |

To add a vendor: implement the `Vendor` interface (`types.ts`), register it in `index.ts`.
Keys belong in environment variables, never in the repo. Make sure your vendor licence covers public display.

The production build sets `VITE_API_URL=/api` (`.env.production`). `npm run dev` uses in-browser demo data;
use `vercel dev` to run the API locally, or set `VITE_API_URL` to any compatible backend.
