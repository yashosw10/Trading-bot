import pandas as pd
import pandas_ta as ta
import sqlite3
import os
from loguru import logger
from api import get_ohlcv

# Strategy Constants (imported directly to prevent drift from strategy.py)
from strategy import (
    EMA_PERIOD, RSI_PERIOD, BB_PERIOD, BB_VOLATILITY_THRESH,
    RSI_ENTRY_GATE, RSI_DCA_SKIP_LOW, RSI_DCA_SKIP_HIGH,
    GRID_TIGHT, GRID_WIDE, MAX_DCA_LAYERS, BASE_ORDER, VOLUME_MULTIPLIER,
    PER_TRADE_STOP_PCT,
)

# Static Ladder benchmark constants
TP_TRANCHE_1_PCT = 0.40
TP_TRANCHE_2_PCT = 0.35

DB_PATH = "history.db"

# Same constants strategy.py hardcodes for these behaviors — kept local since
# strategy.py doesn't expose them as module-level names.
REENTRY_COOLDOWN_S = 120
TIME_STOP_HOURS = 72.0
TP1_DECAY_START_HOURS = 24.0
TP1_DECAY_WINDOW_HOURS = 48.0
TRAIL_STOP_FACTOR = 0.8

_INTERVAL_HOURS = {
    "1m": 1 / 60, "5m": 5 / 60, "15m": 15 / 60, "30m": 30 / 60,
    "1h": 1.0, "4h": 4.0, "1d": 24.0,
}


def _load_local(symbol: str, interval: str, limit: int = None, start_time_ms: int = None, end_time_ms: int = None):
    """
    Load candles from history.db. Supports either 'limit' (most recent N) or 
    explicit 'start_time_ms' and 'end_time_ms' bounds.
    Returns None if coverage is insufficient.
    """
    if not os.path.exists(DB_PATH):
        return None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if start_time_ms and end_time_ms:
            cursor.execute(
                """
                SELECT timestamp, open, high, low, close, volume
                FROM candles
                WHERE symbol = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp ASC
                """,
                (symbol, interval, start_time_ms, end_time_ms),
            )
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                return None
                
            min_ts = rows[0][0]
            max_ts = rows[-1][0]
            
            unit = interval[-1]
            value = int(interval[:-1])
            if unit == 'm':
                tolerance = value * 60 * 1000
            elif unit == 'h':
                tolerance = value * 60 * 60 * 1000
            elif unit == 'd':
                tolerance = value * 24 * 60 * 60 * 1000
            else:
                tolerance = 60 * 1000
                
            # Allow tolerance of up to 2 intervals at the edges
            if (min_ts - start_time_ms) > tolerance * 2 or (end_time_ms - max_ts) > tolerance * 2:
                logger.warning(
                    f"Local DB coverage insufficient for {symbol} {interval} date range. "
                    f"Requested {start_time_ms} to {end_time_ms}, got {min_ts} to {max_ts}."
                )
                return None
                
            logger.info(f"Loaded {len(rows)} local {interval} candles for {symbol} (date range coverage)")
            return [
                {"timestamp": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]}
                for r in rows
            ]
        else:
            # Data in history.db is namespaced with BINANCE: prefix
            namespaced_symbol = f"BINANCE:{symbol}" if not symbol.startswith("BINANCE:") else symbol
            cursor.execute(
                """
                SELECT timestamp, open, high, low, close, volume
                FROM candles
                WHERE symbol = ? AND interval = ?
                ORDER BY timestamp DESC LIMIT ?
                """,
                (namespaced_symbol, interval, limit),
            )
            rows = cursor.fetchall()
            conn.close()
            
            if not rows or len(rows) < limit:
                logger.warning(
                    f"Local DB coverage insufficient for {symbol} {interval}: "
                    f"requested {limit} candles, found {len(rows) if rows else 0}."
                )
                return None

            logger.info(f"Loaded {len(rows)} local {interval} candles for {symbol} (full limit coverage)")
            return [
                {"timestamp": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]}
                for r in reversed(rows)  # oldest first for pandas TA
            ]
            
    except Exception as e:
        logger.error(f"Error reading local history: {e}")
        return None


async def run_backtest(symbol: str, interval: str, limit: int | None, config: dict,
                       start_time_ms: int = None, end_time_ms: int = None,
                       exit_mode: str = "STATIC_LADDER",
                       atr_activation_mult: float = 2.0,
                       atr_trail_mult: float = 1.0) -> dict | None:
    if config is None: config = {}
    
    # ── Dynamic config overrides, matching what the live bot pulls from DB ──
    max_dca_layers = int(config.get("max_dca_layers", MAX_DCA_LAYERS))
    rsi_entry_gate = int(config.get("rsi_entry_gate", RSI_ENTRY_GATE))
    base_order = float(config.get("base_order", BASE_ORDER))
    volume_multiplier = float(config.get("volume_multiplier", VOLUME_MULTIPLIER))
    per_trade_stop_pct = float(config.get("per_trade_stop_pct", PER_TRADE_STOP_PCT))
    grid_tight = float(config.get("grid_tight", GRID_TIGHT))
    grid_wide = float(config.get("grid_wide", GRID_WIDE))
    time_stop_hours = float(config.get("time_stop_hours", TIME_STOP_HOURS))

    fee_rate = float(config.get("fee_rate", 0.001))
    slippage_rate = float(config.get("slippage_rate", 0.0005))

    ohlcv = _load_local(symbol, interval, limit, start_time_ms, end_time_ms)
    if not ohlcv:
        if symbol.startswith("BINANCE:"):
            logger.error(f"No local Binance-sourced data for {symbol} {interval} — "
                         f"there is no live-API fallback for namespaced symbols. Run download_binance.py first.")
            return None
        logger.info(f"Fetching {limit} candles from live API for {symbol} {interval}")
        ohlcv = await get_ohlcv(symbol, interval, limit)

    if not ohlcv or len(ohlcv) < EMA_PERIOD:
        return None

    df = pd.DataFrame(ohlcv)
    df.set_index(pd.to_datetime(df["timestamp"], unit="ms"), inplace=True)

    df.ta.ema(length=EMA_PERIOD, append=True)
    df.ta.rsi(length=RSI_PERIOD, append=True)
    df.ta.bbands(length=BB_PERIOD, append=True)
    df.ta.atr(length=14, append=True)
    df = df.dropna()

    if len(df) == 0:
        return None

    # Resolve indicator column names defensively — pandas_ta's BB naming
    # (e.g. "BBU_20_2.0" vs "BBU_20_2_0") has varied across versions.
    ema_col = f"EMA_{EMA_PERIOD}"
    rsi_col = f"RSI_{RSI_PERIOD}"
    atr_col = "ATRr_14"
    bbu_col = next((c for c in df.columns if c.startswith("BBU_")), None)
    bbl_col = next((c for c in df.columns if c.startswith("BBL_")), None)
    bbm_col = next((c for c in df.columns if c.startswith("BBM_")), None)
    if not all([ema_col in df.columns, rsi_col in df.columns, atr_col in df.columns, bbu_col, bbl_col, bbm_col]):
        logger.error(f"Expected indicator columns missing. Got columns: {list(df.columns)}")
        return None

    interval_hours = _INTERVAL_HOURS.get(interval, 1.0)
    reentry_cooldown_bars = max(1, round((REENTRY_COOLDOWN_S / 3600) / interval_hours))

    initial_balance = 10000.0
    balance = initial_balance
    max_position_size = float(config.get("max_position_size", 100.0))

    # ── Position state — mirrors SymbolState in strategy.py ──
    position_amount = 0.0
    total_invested = 0.0
    dca_layer = 0
    avg_entry = 0.0
    last_buy_price = 0.0
    entry_grid = 0.0
    tp1_done = False
    tp2_done = False
    trail_high = 0.0
    entry_bar_idx = None
    last_trade_bar_idx = None
    cooldown_remaining = 0

    trades = []          # each realized sell (partial or full) logged here
    peak_balance = initial_balance
    max_drawdown = 0.0

    def _record_sell(sell_amt, price, label, bar_idx):
        """Sell `sell_amt` units at `price`, applying fee/slippage, and book PnL."""
        nonlocal balance, position_amount, total_invested
        sell_price = price * (1 - slippage_rate)
        sale_value = sell_amt * sell_price
        fee = sale_value * fee_rate
        net_proceeds = sale_value - fee

        cost_basis = sell_amt * avg_entry  # avg_entry is cost-per-unit, constant across partial sells
        trade_pnl = net_proceeds - cost_basis
        balance += net_proceeds

        trades.append({
            "pnl": trade_pnl,
            "label": label,
            "bars_held": (bar_idx - entry_bar_idx) if entry_bar_idx is not None else 0,
        })

        position_amount -= sell_amt
        total_invested -= cost_basis
        return trade_pnl

    for i in range(len(df)):
        row = df.iloc[i]
        price = row["close"]
        ema = row[ema_col]
        rsi = row[rsi_col]
        atr = row[atr_col]
        bb_upper, bb_lower, bb_mid = row[bbu_col], row[bbl_col], row[bbm_col]

        bb_width = (bb_upper - bb_lower) / bb_mid if bb_mid > 0 else 0
        base_grid = grid_wide if bb_width > BB_VOLATILITY_THRESH else grid_tight
        grid = max(base_grid, 0.5 * bb_width)

        if cooldown_remaining > 0:
            cooldown_remaining -= 1

        closed_this_bar = False

        # ── Per-trade stop-loss (−8% from avg entry by default) ──
        if dca_layer > 0 and avg_entry > 0 and price < avg_entry * (1 - per_trade_stop_pct):
            _record_sell(position_amount, price, "STOP-LOSS", i)
            dca_layer = 0
            avg_entry = 0.0
            tp1_done = tp2_done = False
            trail_high = 0.0
            last_buy_price = 0.0
            entry_grid = 0.0
            entry_bar_idx = None
            cooldown_remaining = reentry_cooldown_bars
            closed_this_bar = True

        # ── Time-stop (position stuck > 72h) ──
        elif dca_layer > 0 and last_trade_bar_idx is not None and exit_mode == "STATIC_LADDER":
            hours_stuck = (i - last_trade_bar_idx) * interval_hours
            if hours_stuck > time_stop_hours:
                _record_sell(position_amount, price, "TIME-STOP", i)
                dca_layer = 0
                avg_entry = 0.0
                tp1_done = tp2_done = False
                trail_high = 0.0
                last_buy_price = 0.0
                entry_grid = 0.0
                entry_bar_idx = None
                cooldown_remaining = reentry_cooldown_bars
                closed_this_bar = True

        if closed_this_bar:
            equity = balance + position_amount * price
            peak_balance = max(peak_balance, equity)
            dd = (peak_balance - equity) / peak_balance * 100 if peak_balance > 0 else 0
            max_drawdown = max(max_drawdown, dd)
            continue

        # ── Base order (entry) ──
        if dca_layer == 0 and cooldown_remaining == 0:
            if price > ema and rsi < rsi_entry_gate:
                buy_size = min(base_order, max_position_size, balance)
                if buy_size > 10:
                    buy_price = price * (1 + slippage_rate)
                    fee = buy_size * fee_rate
                    amount = (buy_size - fee) / buy_price

                    position_amount = amount
                    total_invested = buy_size
                    balance -= buy_size
                    dca_layer = 1
                    avg_entry = total_invested / position_amount
                    last_buy_price = price
                    entry_grid = grid
                    entry_bar_idx = i
                    last_trade_bar_idx = i
                    trail_high = price

        # ── DCA layers (skip the RSI neutral zone) ──
        elif dca_layer > 0 and not tp1_done and price < last_buy_price * (1 - grid):
            if dca_layer < max_dca_layers and (rsi < RSI_DCA_SKIP_LOW or rsi > RSI_DCA_SKIP_HIGH):
                n = dca_layer  # matches strategy.py: n = st.dca_layer (0-indexed exponent)
                buy_size = min(base_order * (volume_multiplier ** n), balance)
                if buy_size > 10:
                    buy_price = price * (1 + slippage_rate)
                    fee = buy_size * fee_rate
                    amount = (buy_size - fee) / buy_price

                    position_amount += amount
                    total_invested += buy_size
                    balance -= buy_size
                    dca_layer += 1
                    avg_entry = total_invested / position_amount
                    last_buy_price = price
                    last_trade_bar_idx = i

        # ── Take-profit tranches / Trailing TP ──
        elif dca_layer > 0 and avg_entry > 0:
            if exit_mode == "STATIC_LADDER":
                g = entry_grid
                hours_stuck = (i - last_trade_bar_idx) * interval_hours if last_trade_bar_idx is not None else 0.0

                if not tp1_done:
                    if hours_stuck > TP1_DECAY_START_HOURS:
                        decay = min(1.0, (hours_stuck - TP1_DECAY_START_HOURS) / TP1_DECAY_WINDOW_HOURS)
                        target_mult = 1 + (g * (1 - decay)) + (0.002 * decay)
                    else:
                        target_mult = 1 + g

                    if price >= avg_entry * target_mult:
                        sell_amt = position_amount * TP_TRANCHE_1_PCT
                        _record_sell(sell_amt, price, "TP1-40pct", i)
                        tp1_done = True
                        trail_high = price

                elif tp1_done and not tp2_done and price >= avg_entry * (1 + 2 * g):
                    # 35% of what remains after TP1 (matches live behavior)
                    sell_amt = position_amount * TP_TRANCHE_2_PCT
                    _record_sell(sell_amt, price, "TP2-35pct", i)
                    tp2_done = True
                    trail_high = max(trail_high, price)

                elif tp2_done and position_amount > 0:
                    trail_high = max(trail_high, price)
                    trail_stop = trail_high * (1 - TRAIL_STOP_FACTOR * g)
                    if price <= trail_stop:
                        _record_sell(position_amount, price, "TP3-trailing", i)
                        dca_layer = 0
                        avg_entry = 0.0
                        tp1_done = tp2_done = False
                        trail_high = 0.0
                        last_buy_price = 0.0
                        entry_grid = 0.0
                        entry_bar_idx = None
                        cooldown_remaining = reentry_cooldown_bars
            
            elif exit_mode == "DYNAMIC_TRAILING":
                if atr > 0:
                    activation_price = avg_entry + (atr * atr_activation_mult)
                    trail_offset = atr * atr_trail_mult
                    
                    if not tp1_done and price >= activation_price:
                        tp1_done = True
                        trail_high = price
                    
                    if tp1_done:
                        trail_high = max(trail_high, price)
                        trail_stop = trail_high - trail_offset
                        
                        if price <= trail_stop:
                            _record_sell(position_amount, price, "TTP-trailing-exit", i)
                            dca_layer = 0
                            avg_entry = 0.0
                            tp1_done = tp2_done = False
                            trail_high = 0.0
                            last_buy_price = 0.0
                            entry_grid = 0.0
                            entry_bar_idx = None
                            cooldown_remaining = reentry_cooldown_bars

        equity = balance + position_amount * price
        peak_balance = max(peak_balance, equity)
        dd = (peak_balance - equity) / peak_balance * 100 if peak_balance > 0 else 0
        max_drawdown = max(max_drawdown, dd)

    # ── Force-close any residual open position at the final bar ──
    if position_amount > 0:
        _record_sell(position_amount, df.iloc[-1]["close"], "END-OF-BACKTEST", len(df) - 1)

    total_return_pct = ((balance - initial_balance) / initial_balance) * 100
    wins = sum(1 for t in trades if t["pnl"] > 0)
    gross_profit = sum(t["pnl"] for t in trades if t["pnl"] > 0)
    gross_loss = abs(sum(t["pnl"] for t in trades if t["pnl"] < 0))
    win_rate = (wins / len(trades)) if trades else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)

    # Only "full cycle closes" (stop-loss / time-stop / TP3 / TTP / end-of-backtest)
    # represent a complete position lifecycle for duration purposes.
    full_cycle_labels = {"STOP-LOSS", "TIME-STOP", "TP3-trailing", "TTP-trailing-exit", "END-OF-BACKTEST"}
    cycle_trades = [t for t in trades if t["label"] in full_cycle_labels]
    avg_trade_duration = (
        sum(t["bars_held"] for t in cycle_trades) / len(cycle_trades) * interval_hours
        if cycle_trades else 0.0
    )

    sl_hits = sum(1 for t in cycle_trades if t["label"] == "STOP-LOSS")
    sl_hit_rate = (sl_hits / len(cycle_trades) * 100) if cycle_trades else 0.0

    pnl_by_label = {}
    for t in trades:
        lbl = t["label"]
        pnl_by_label[lbl] = pnl_by_label.get(lbl, 0.0) + t["pnl"]

    return {
        "strategy": "VA-DCA Hybrid",
        "start_date": str(df.index[0]),
        "end_date": str(df.index[-1]),
        "initial_balance": initial_balance,
        "final_balance": round(balance, 2),
        "total_return_pct": round(total_return_pct, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 2),
        "total_trades": len(trades),
        "full_position_cycles": len(cycle_trades),
        "avg_trade_duration_hours": round(avg_trade_duration, 1),
        "sl_hit_rate_pct": round(sl_hit_rate, 2),
        "pnl_by_label": {k: round(v, 2) for k, v in pnl_by_label.items()},
        "is_mock": False,
    }
