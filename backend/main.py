import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from bot_engine import TradingEngine

load_dotenv()

MODE = os.getenv("TRADING_MODE", "PAPER").upper()
SYMBOL = os.getenv("SYMBOL", "BTC/USDT")
TIMEFRAME = os.getenv("TIMEFRAME", "15m")
POSITION_SIZE = float(os.getenv("POSITION_SIZE", "0.9"))
TAKE_PROFIT_PCT = float(os.getenv("TAKE_PROFIT_PCT", "2.5"))
STOP_LOSS_PCT = float(os.getenv("STOP_LOSS_PCT", "1.5"))
RSI_THRESHOLD = float(os.getenv("RSI_THRESHOLD", "30"))
PAPER_STARTING_BALANCE = float(os.getenv("PAPER_STARTING_BALANCE", "1000"))
API_KEY = os.getenv("BINANCE_API_KEY")
API_SECRET = os.getenv("BINANCE_API_SECRET")

if MODE == "LIVE" and (not API_KEY or API_KEY == "ta_cle_api_ici"):
    # Safety net: never silently trade real money without real keys configured.
    MODE = "PAPER"

engine = TradingEngine(
    mode=MODE,
    symbol=SYMBOL,
    timeframe=TIMEFRAME,
    position_size_pct=POSITION_SIZE,
    take_profit_pct=TAKE_PROFIT_PCT,
    stop_loss_pct=STOP_LOSS_PCT,
    rsi_buy_threshold=RSI_THRESHOLD,
    paper_starting_balance=PAPER_STARTING_BALANCE,
    api_key=API_KEY,
    api_secret=API_SECRET,
)


class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    def broadcast(self, message: dict):
        living = []
        for ws in self.connections:
            living.append(ws)
        for ws in living:
            asyncio.create_task(self._safe_send(ws, message))

    async def _safe_send(self, ws: WebSocket, message: dict):
        try:
            await ws.send_json(message)
        except Exception:
            self.disconnect(ws)


manager = ConnectionManager()
engine.on_update(lambda snapshot: manager.broadcast({"type": "snapshot", "data": snapshot}))


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(engine.run())
    yield
    engine.stop()
    task.cancel()


app = FastAPI(title="Trading Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def get_status():
    return engine.snapshot()


@app.get("/api/trades")
def get_trades():
    return engine.store.trades()


@app.get("/api/kpis")
def get_kpis():
    return engine.store.kpis(engine.get_balance())


@app.get("/api/daily")
def get_daily():
    return engine.store.daily_summary()


@app.get("/api/events")
def get_events():
    return engine.store.events()


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "snapshot", "data": engine.snapshot()})
        while True:
            # Keep the connection open; client doesn't need to send anything.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
