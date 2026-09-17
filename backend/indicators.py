"""
Technical indicator calculations used by the trading engine.
All functions take an OHLCV candle list (as returned by ccxt: [ts, open, high, low, close, volume])
and return plain floats. No external numeric dependency required.
"""

from typing import List, Optional, Tuple


class TechnicalIndicators:
    def calculate_rsi(self, ohlcv: List[list], period: int = 14) -> Optional[float]:
        closes = [c[4] for c in ohlcv]
        if len(closes) < period + 1:
            return None

        deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
        recent = deltas[-period:]

        gains = [d for d in recent if d > 0]
        losses = [-d for d in recent if d < 0]

        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period

        if avg_loss == 0:
            return 100.0 if avg_gain > 0 else 50.0

        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    def calculate_moving_averages(
        self, ohlcv: List[list], short: int = 10, long: int = 20
    ) -> Tuple[Optional[float], Optional[float]]:
        closes = [c[4] for c in ohlcv]
        if len(closes) < long:
            return None, None

        ma_short = sum(closes[-short:]) / short
        ma_long = sum(closes[-long:]) / long
        return ma_short, ma_long

    def calculate_volume(self, ohlcv: List[list], period: int = 20) -> Optional[float]:
        volumes = [c[5] for c in ohlcv]
        if not volumes:
            return None
        window = volumes[-period:] if len(volumes) >= period else volumes
        return sum(window) / len(window)
