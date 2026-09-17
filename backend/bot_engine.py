"""
TradingEngine - runs the RSI + Moving Average strategy against live market
data and either simulates fills (PAPER mode, default, no API keys required
and no real money at risk) or places real orders on Binance (LIVE mode,
only if the operator supplies real API keys and explicitly opts in).

This is a monitoring/paper-trading tool. Nothing here promises profit: the
strategy is a simple RSI-oversold + moving-average-crossover rule and is
shown as-is so its real, live performance (including losing streaks) is
visible on the dashboard rather than hidden.
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Callable, List, Optional

import ccxt

from indicators import TechnicalIndicators
from store import Store

FAST_INTERVAL_SEC = 5      # price tick cadence, drives the live chart
EVAL_INTERVAL_SEC = 30     # signal / indicator re-evaluation cadence
PRICE_HISTORY_LIMIT = 720  # ~1 hour of 5s ticks


class TradingEngine:
    def __init__(
        self,
        mode: str = "PAPER",
        symbol: str = "BTC/USDT",
        timeframe: str = "15m",
        position_size_pct: float = 0.9,
        take_profit_pct: float = 2.5,
        stop_loss_pct: float = 1.5,
        rsi_buy_threshold: float = 30,
        paper_starting_balance: float = 1000.0,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
    ):
        self.mode = mode.upper()
        self.symbol = symbol
        self.timeframe = timeframe
        self.position_size_pct = position_size_pct
        self.take_profit_pct = take_profit_pct
        self.stop_loss_pct = stop_loss_pct
        self.rsi_buy_threshold = rsi_buy_threshold

        self.indicators = TechnicalIndicators()
        self.store = Store(starting_balance=paper_starting_balance)

        exchange_config = {"enableRateLimit": True, "options": {"defaultType": "spot"}}
        if self.mode == "LIVE":
            if not api_key or not api_secret:
                raise ValueError("LIVE mode requires BINANCE_API_KEY and BINANCE_API_SECRET")
            exchange_config["apiKey"] = api_key
            exchange_config["secret"] = api_secret
        self.exchange = ccxt.binance(exchange_config)

        # Trading state
        self.in_position = False
        self.entry_price = 0.0
        self.entry_time: Optional[datetime] = None
        self.moving_stop_loss = 0.0
        self.amount_held = 0.0
        self.paper_balance = paper_starting_balance if self.mode == "PAPER" else 0.0

        # Live snapshot for the dashboard
        self.last_price: Optional[float] = None
        self.last_analysis: Optional[dict] = None
        self.price_history: List[dict] = []
        self.status_message = "Starting..."

        self._on_update: Optional[Callable[[dict], None]] = None
        self._running = False

    def on_update(self, callback: Callable[[dict], None]):
        self._on_update = callback

    def _emit(self):
        if self._on_update:
            self._on_update(self.snapshot())

    # ---------- market data ----------

    async def _fetch_ticker(self) -> Optional[float]:
        try:
            ticker = await asyncio.to_thread(self.exchange.fetch_ticker, self.symbol)
            return float(ticker["last"])
        except Exception as e:
            self.store.log_event("ERROR", f"Erreur prix: {e}")
            return None

    async def _fetch_ohlcv(self) -> Optional[list]:
        try:
            return await asyncio.to_thread(
                self.exchange.fetch_ohlcv, self.symbol, self.timeframe, None, 60
            )
        except Exception as e:
            self.store.log_event("ERROR", f"Erreur OHLCV: {e}")
            return None

    def get_balance(self) -> float:
        if self.mode == "PAPER":
            return self.paper_balance
        try:
            balance = self.exchange.fetch_balance()
            return float(balance["USDT"]["free"])
        except Exception as e:
            self.store.log_event("ERROR", f"Erreur solde: {e}")
            return 0.0

    # ---------- strategy ----------

    def _analyze(self, ohlcv: list) -> Optional[dict]:
        rsi = self.indicators.calculate_rsi(ohlcv)
        ma_short, ma_long = self.indicators.calculate_moving_averages(ohlcv)
        volume = self.indicators.calculate_volume(ohlcv)
        if rsi is None or ma_short is None:
            return None
        return {
            "rsi": rsi,
            "ma_short": ma_short,
            "ma_long": ma_long,
            "volume": volume,
            "price": float(ohlcv[-1][4]),
        }

    def _should_buy(self, analysis: dict) -> bool:
        if self.in_position:
            return False
        oversold = analysis["rsi"] < self.rsi_buy_threshold
        trend_up = analysis["ma_short"] > analysis["ma_long"]
        return oversold and trend_up

    def _should_sell(self, price: float):
        if not self.in_position:
            return False, None
        if price >= self.entry_price * (1 + self.take_profit_pct / 100):
            return True, "TAKE_PROFIT"
        if price <= self.moving_stop_loss:
            return True, "STOP_LOSS"
        if price > self.entry_price * 1.01:
            new_stop = price * (1 - self.stop_loss_pct / 100)
            if new_stop > self.moving_stop_loss:
                self.moving_stop_loss = new_stop
        return False, None

    def _reasoning(self, analysis: dict) -> str:
        if self.in_position:
            target = self.entry_price * (1 + self.take_profit_pct / 100)
            return (
                f"En position depuis {self.entry_price:.2f}$ | "
                f"Objectif (Take Profit): {target:.2f}$ | "
                f"Stop (trailing): {self.moving_stop_loss:.2f}$"
            )
        oversold = analysis["rsi"] < self.rsi_buy_threshold
        trend_up = analysis["ma_short"] > analysis["ma_long"]
        parts = [
            f"RSI {analysis['rsi']:.1f} ({'survendu' if oversold else 'neutre'}, seuil {self.rsi_buy_threshold})",
            f"MA{10} {analysis['ma_short']:.2f} vs MA{20} {analysis['ma_long']:.2f} "
            f"({'tendance haussière' if trend_up else 'pas de tendance haussière'})",
        ]
        if oversold and trend_up:
            parts.append("→ Signal ACHAT")
        else:
            parts.append("→ En attente")
        return " | ".join(parts)

    # ---------- execution ----------

    def _execute_buy(self, price: float):
        balance = self.get_balance()
        if balance < 10:
            self.store.log_event("WARNING", "Solde insuffisant pour acheter")
            return

        amount_usdt = balance * self.position_size_pct
        amount_asset = amount_usdt / price * 0.999  # ~0.1% fee

        if self.mode == "LIVE":
            try:
                self.exchange.create_market_buy_order(self.symbol, amount_asset)
            except Exception as e:
                self.store.log_event("ERROR", f"Erreur achat: {e}")
                return
        else:
            self.paper_balance -= amount_usdt

        self.in_position = True
        self.entry_price = price
        self.entry_time = datetime.now(timezone.utc)
        self.moving_stop_loss = price * (1 - self.stop_loss_pct / 100)
        self.amount_held = amount_asset

        trade = self.store.record_trade(
            {
                "type": "BUY",
                "price": price,
                "amount": amount_asset,
                "time": self.entry_time.isoformat(),
                "mode": self.mode,
            }
        )
        self.store.log_event("TRADE", f"BUY {amount_asset:.6f} @ {price:.2f}")
        return trade

    def _execute_sell(self, price: float, reason: str):
        if self.mode == "LIVE":
            try:
                self.exchange.create_market_sell_order(self.symbol, self.amount_held)
            except Exception as e:
                self.store.log_event("ERROR", f"Erreur vente: {e}")
                return
        else:
            self.paper_balance += self.amount_held * price * 0.999

        profit_pct = ((price - self.entry_price) / self.entry_price) * 100

        trade = self.store.record_trade(
            {
                "type": "SELL",
                "price": price,
                "amount": self.amount_held,
                "profit_pct": profit_pct,
                "reason": reason,
                "time": datetime.now(timezone.utc).isoformat(),
                "mode": self.mode,
            }
        )
        self.store.log_event(
            "TRADE", f"SELL {self.amount_held:.6f} @ {price:.2f} | {profit_pct:+.2f}% ({reason})"
        )

        self.in_position = False
        self.entry_price = 0.0
        self.amount_held = 0.0
        return trade

    # ---------- snapshot / loop ----------

    def snapshot(self) -> dict:
        balance = self.get_balance()
        return {
            "mode": self.mode,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "status_message": self.status_message,
            "last_price": self.last_price,
            "in_position": self.in_position,
            "entry_price": self.entry_price if self.in_position else None,
            "moving_stop_loss": self.moving_stop_loss if self.in_position else None,
            "analysis": self.last_analysis,
            "reasoning": self._reasoning(self.last_analysis) if self.last_analysis else None,
            "balance": balance,
            "kpis": self.store.kpis(balance),
            "today": self.store.today_summary(),
            "price_history": self.price_history[-PRICE_HISTORY_LIMIT:],
        }

    async def _tick(self):
        price = await self._fetch_ticker()
        if price is None:
            return
        self.last_price = price
        self.price_history.append(
            {"time": time.time(), "price": price}
        )
        self.price_history = self.price_history[-PRICE_HISTORY_LIMIT:]

        should_sell, reason = self._should_sell(price)
        if should_sell:
            self.status_message = f"Signal VENTE ({reason})"
            self._execute_sell(price, reason)

        self._emit()

    async def _evaluate(self):
        ohlcv = await self._fetch_ohlcv()
        if not ohlcv:
            return
        analysis = self._analyze(ohlcv)
        if not analysis:
            return
        self.last_analysis = analysis
        self.last_price = analysis["price"]

        if self._should_buy(analysis):
            self.status_message = "Signal ACHAT détecté"
            self._execute_buy(analysis["price"])
        elif not self.in_position:
            self.status_message = "En attente d'un signal"

        self._emit()

    async def run(self):
        self._running = True
        self.store.log_event(
            "START", f"Agent démarré en mode {self.mode} sur {self.symbol} ({self.timeframe})"
        )
        await self._evaluate()

        last_eval = time.time()
        while self._running:
            try:
                await self._tick()
                if time.time() - last_eval >= EVAL_INTERVAL_SEC:
                    await self._evaluate()
                    last_eval = time.time()
            except Exception as e:
                self.store.log_event("ERROR", f"Erreur boucle: {e}")
            await asyncio.sleep(FAST_INTERVAL_SEC)

    def stop(self):
        self._running = False
