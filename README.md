# NEPSE Charts

Web app: candlestick charts (SMA/EMA/Bollinger, RSI, MACD), watchlist, screener, portfolio P/L, price alerts.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static site in dist/

## Data
Runs on **synthetic demo data** by default. To use real data, run your own backend (or a licensed feed)
and set `VITE_API_URL`:

    VITE_API_URL=https://your-api.example.com npm run dev

It must serve `GET /stocks` -> `[{symbol,name,sector}]` and
`GET /candles/:symbol` -> `[{time:"YYYY-MM-DD",open,high,low,close,volume}]` (oldest first).
See `src/data/provider.ts`.
