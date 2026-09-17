"""
Persistence + KPI computation for the trading dashboard.
Trades and daily summaries are stored as JSON on disk so the dashboard
survives a backend restart within the same session.
"""

import json
import os
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
STATE_FILE = os.path.join(DATA_DIR, "state.json")

_lock = threading.Lock()


def _empty_state(starting_balance: float) -> dict:
    return {
        "starting_balance": starting_balance,
        "trades": [],
        "events": [],
    }


class Store:
    def __init__(self, starting_balance: float):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._state = self._load(starting_balance)

    def _load(self, starting_balance: float) -> dict:
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, "r") as f:
                    data = json.load(f)
                if "starting_balance" in data:
                    return data
            except (json.JSONDecodeError, OSError):
                pass
        return _empty_state(starting_balance)

    def _save(self):
        with open(STATE_FILE, "w") as f:
            json.dump(self._state, f, indent=2)

    def log_event(self, event_type: str, message: str):
        with _lock:
            self._state["events"].append(
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "type": event_type,
                    "message": message,
                }
            )
            self._state["events"] = self._state["events"][-200:]
            self._save()

    def record_trade(self, trade: dict):
        with _lock:
            trade = dict(trade)
            trade["id"] = len(self._state["trades"]) + 1
            self._state["trades"].append(trade)
            self._save()
        return trade

    def trades(self) -> List[dict]:
        with _lock:
            return list(self._state["trades"])

    def events(self) -> List[dict]:
        with _lock:
            return list(self._state["events"])

    def starting_balance(self) -> float:
        return self._state["starting_balance"]

    def kpis(self, current_balance: float) -> dict:
        trades = self.trades()
        sells = [t for t in trades if t["type"] == "SELL"]
        wins = [t for t in sells if t.get("profit_pct", 0) > 0]
        losses = [t for t in sells if t.get("profit_pct", 0) <= 0]

        total_trades = len(sells)
        win_rate = (len(wins) / total_trades * 100) if total_trades else 0.0
        avg_trade_pct = (
            sum(t.get("profit_pct", 0) for t in sells) / total_trades
            if total_trades
            else 0.0
        )
        best_trade = max((t.get("profit_pct", 0) for t in sells), default=0.0)
        worst_trade = min((t.get("profit_pct", 0) for t in sells), default=0.0)

        starting = self.starting_balance()
        total_pnl_usdt = current_balance - starting
        total_pnl_pct = (total_pnl_usdt / starting * 100) if starting else 0.0

        return {
            "starting_balance": starting,
            "current_balance": current_balance,
            "total_pnl_usdt": total_pnl_usdt,
            "total_pnl_pct": total_pnl_pct,
            "total_trades": total_trades,
            "win_count": len(wins),
            "loss_count": len(losses),
            "win_rate": win_rate,
            "avg_trade_pct": avg_trade_pct,
            "best_trade_pct": best_trade,
            "worst_trade_pct": worst_trade,
        }

    def daily_summary(self) -> List[dict]:
        trades = self.trades()
        sells = [t for t in trades if t["type"] == "SELL"]
        by_day: Dict[str, dict] = {}

        for t in sells:
            day = t["time"][:10]
            entry = by_day.setdefault(
                day,
                {"date": day, "trades": 0, "wins": 0, "losses": 0, "pnl_pct": 0.0},
            )
            entry["trades"] += 1
            pct = t.get("profit_pct", 0)
            entry["pnl_pct"] += pct
            if pct > 0:
                entry["wins"] += 1
            else:
                entry["losses"] += 1

        return sorted(by_day.values(), key=lambda e: e["date"])

    def today_summary(self) -> Optional[dict]:
        today = datetime.now(timezone.utc).date().isoformat()
        for entry in self.daily_summary():
            if entry["date"] == today:
                return entry
        return {"date": today, "trades": 0, "wins": 0, "losses": 0, "pnl_pct": 0.0}
