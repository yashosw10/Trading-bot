import math
from datetime import datetime

# ==========================================
# OLD SCALAR LOGIC (Copied from strategy.py)
# ==========================================
def _calc_ema_old(prices: list[float], period: int) -> float:
    if not prices: return 0.0
    if len(prices) < period: return sum(prices) / len(prices)
    k = 2.0 / (period + 1)
    ema = sum(prices[:period]) / period
    for p in prices[period:]:
        ema = p * k + ema * (1 - k)
    return ema

def _calc_rsi_old(closes: list[float], period: int) -> float:
    if len(closes) < period + 1: return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    seed = deltas[:period]
    avg_gain = sum(d for d in seed if d > 0) / period
    avg_loss = sum(-d for d in seed if d < 0) / period
    for d in deltas[period:]:
        gain = d if d > 0 else 0.0
        loss = -d if d < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0: return 100.0
    return 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))

def _grid_spacing_old(candles: list[float], period: int) -> float:
    if len(candles) < period: return 0.030
    recent = candles[-period:]
    sma = sum(recent) / period
    if sma == 0: return 0.030
    variance = sum((p - sma) ** 2 for p in recent) / period
    bb_width = (4 * math.sqrt(variance)) / sma
    base_grid = 0.050 if bb_width > 0.020 else 0.030
    return max(base_grid, 0.5 * bb_width)

class _CandleAggregatorOld:
    def __init__(self):
        self._close = None
        self._deadline = None
    def feed(self, price: float, ts: datetime) -> float | None:
        now = ts.timestamp()
        if self._deadline is None:
            self._deadline = now + 60
            self._close = price
            return None
        if now < self._deadline:
            self._close = price
            return None
        close = self._close
        self._close = price
        self._deadline = now + 60
        return close


# ==========================================
# NEW OHLC LOGIC (Proposed for strategy.py)
# ==========================================
def _calc_ema_new(candles: list[dict], period: int) -> float:
    prices = [c["close"] for c in candles]
    if not prices: return 0.0
    if len(prices) < period: return sum(prices) / len(prices)
    k = 2.0 / (period + 1)
    ema = sum(prices[:period]) / period
    for p in prices[period:]:
        ema = p * k + ema * (1 - k)
    return ema

def _calc_rsi_new(candles: list[dict], period: int) -> float:
    closes = [c["close"] for c in candles]
    if len(closes) < period + 1: return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    seed = deltas[:period]
    avg_gain = sum(d for d in seed if d > 0) / period
    avg_loss = sum(-d for d in seed if d < 0) / period
    for d in deltas[period:]:
        gain = d if d > 0 else 0.0
        loss = -d if d < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0: return 100.0
    return 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))

def _grid_spacing_new(candles: list[dict], period: int) -> float:
    closes = [c["close"] for c in candles]
    if len(closes) < period: return 0.030
    recent = closes[-period:]
    sma = sum(recent) / period
    if sma == 0: return 0.030
    variance = sum((p - sma) ** 2 for p in recent) / period
    bb_width = (4 * math.sqrt(variance)) / sma
    base_grid = 0.050 if bb_width > 0.020 else 0.030
    return max(base_grid, 0.5 * bb_width)

class _CandleAggregatorNew:
    def __init__(self):
        self._open = None
        self._high = None
        self._low = None
        self._close = None
        self._deadline = None

    def feed(self, price: float, ts: datetime) -> dict | None:
        now = ts.timestamp()
        if self._deadline is None:
            self._deadline = now + 60
            self._open = self._high = self._low = self._close = price
            return None
        
        if now < self._deadline:
            if price > self._high: self._high = price
            if price < self._low: self._low = price
            self._close = price
            return None
        
        # Candle complete
        completed_candle = {
            "open": self._open,
            "high": self._high,
            "low": self._low,
            "close": self._close
        }
        
        self._open = self._high = self._low = self._close = price
        self._deadline = now + 60
        return completed_candle

# ==========================================
# REGRESSION TESTS
# ==========================================
def test_equivalence():
    print("Running Indicator Equivalence Regression Test...")
    
    # Generate Synthetic Feed with Edge Cases
    # Each tuple: (timestamp_offset_seconds, price)
    ticks = [
        # Warmup Period (first 14 candles, standard volatility)
        *[(i*10, 100.0 + (i%5)) for i in range(120)],
        
        # Edge Case 1: A minute with only one tick (Open == High == Low == Close)
        (1205, 110.0),
        # Gap Minute (streamer downtime)
        # Missing data from 1206s to 1270s
        
        # Edge Case 2: Post-gap minute
        (1275, 115.0),
        (1280, 112.0),
        (1300, 118.0),
        
        # Normal high volatility to trigger wider grid
        *[(1300 + (i*5), 118.0 + (i*2) * (-1)**i) for i in range(1, 100)]
    ]
    
    agg_old = _CandleAggregatorOld()
    agg_new = _CandleAggregatorNew()
    
    old_closes = []
    new_candles = []
    
    base_ts = 1751328000.0  # Just a fixed starting point
    
    for offset, price in ticks:
        ts = datetime.fromtimestamp(base_ts + offset)
        
        old_val = agg_old.feed(price, ts)
        if old_val is not None:
            old_closes.append(old_val)
            
        new_val = agg_new.feed(price, ts)
        if new_val is not None:
            new_candles.append(new_val)
            
    # Force close the final unclosed candle for testing purposes
    old_closes.append(agg_old._close)
    new_candles.append({"open": agg_new._open, "high": agg_new._high, "low": agg_new._low, "close": agg_new._close})

    assert len(old_closes) == len(new_candles), f"Candle count mismatch: Old={len(old_closes)}, New={len(new_candles)}"
    
    # Assert Indicator Equivalence
    EMA_PERIOD = 50
    RSI_PERIOD = 14
    BB_PERIOD = 20
    
    # Calculate for each step
    for i in range(1, len(old_closes) + 1):
        c_old = old_closes[:i]
        c_new = new_candles[:i]
        
        # EMA
        ema_old = _calc_ema_old(c_old, EMA_PERIOD)
        ema_new = _calc_ema_new(c_new, EMA_PERIOD)
        assert round(ema_old, 6) == round(ema_new, 6), f"EMA Mismatch at candle {i}: {ema_old} vs {ema_new}"
        
        # RSI
        rsi_old = _calc_rsi_old(c_old, RSI_PERIOD)
        rsi_new = _calc_rsi_new(c_new, RSI_PERIOD)
        assert round(rsi_old, 6) == round(rsi_new, 6), f"RSI Mismatch at candle {i}: {rsi_old} vs {rsi_new}"
        
        # BB Grid Spacing
        grid_old = _grid_spacing_old(c_old, BB_PERIOD)
        grid_new = _grid_spacing_new(c_new, BB_PERIOD)
        assert round(grid_old, 6) == round(grid_new, 6), f"Grid Spacing Mismatch at candle {i}: {grid_old} vs {grid_new}"
    print(f"[SUCCESS] All indicators (EMA, RSI, BB Width) match exactly to 6 decimal places across {len(old_closes)} synthetic candles (including warmup, 1-tick minute, and data gaps).")

if __name__ == "__main__":
    test_equivalence()
