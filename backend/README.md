# Trading Bot Backend

FastAPI service that runs the RSI + Moving Average strategy and exposes it
to the dashboard (live price, indicators, trades, KPIs, daily P&L) over
REST and a WebSocket.

**Defaults to PAPER mode**: it fetches real, live prices from Binance's
public API and simulates fills against a virtual balance. No API keys and
no real money are required to see it running.

## Run it

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit if you want different symbol/params
uvicorn main:app --reload --port 8000
```

Then point the frontend at `http://localhost:8000` (see `.env` at the repo
root / `VITE_API_URL`).

## Switching to LIVE (real money)

This is entirely your decision and your risk — the backend will not do it
on its own:

1. Set `TRADING_MODE=LIVE` in `backend/.env`.
2. Fill in real `BINANCE_API_KEY` / `BINANCE_API_SECRET` (trading enabled).
3. Restart the backend.

If `TRADING_MODE=LIVE` is set without real keys, the backend automatically
falls back to PAPER mode rather than silently failing or trading blind.

**Be aware:** the strategy is a simple RSI-oversold + MA-crossover rule on
a single symbol. It is shown on the dashboard exactly as it performs,
including losing streaks — nothing about it guarantees profit, and on a
small account trading fees alone can outweigh its edge. Do not run LIVE
mode with money you aren't prepared to lose, and don't run it unattended
from a machine that isn't yours to leave on 24/7.
