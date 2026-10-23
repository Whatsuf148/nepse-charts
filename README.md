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

## Accounts and cross-device sync (optional)

Sign in to keep your watchlist, portfolio, alerts, drawings and chart settings in sync across devices.
Without the setup below the app works exactly as before, with everything stored in the browser.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. **Authentication -> URL Configuration**: set *Site URL* to your deployed URL and add it (and `http://localhost:5173`) to *Redirect URLs*. This is what makes email links come back to your app.
4. **Project Settings -> API**: copy the *Project URL* and the *anon public* key.
5. In Vercel: **Project -> Settings -> Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy (these are baked in at build time).
   For local dev copy `.env.example` to `.env.local`.

The anon key is meant to be public. Row Level Security (in `schema.sql`) restricts every request to the signed-in user's own row. Never put the `service_role` key in this app.

How sync works
- Synced: watchlist, portfolio, alerts, drawings, chart overlays/indicator pane, compare list. Not synced: the symbol you last viewed.
- Each setting carries a timestamp; the **most recent edit wins per setting**. Two devices editing the *same* setting at once keep only the newer edit.
- Changes push after a 1.5 s pause; devices pull on focus, reconnect, and every minute.
- A version number on the cloud row stops two devices overwriting each other mid-sync.
- Signing out removes synced data from that browser (it stays in your account). Signing in as a different account never merges the previous account's local data.
- Forgot your password: use *Email me a link* to sign in. (Changing the password in-app isn't built yet.)

## Tests

    npm test          # merge rules, sync engine (two simulated devices), data validation, local store
