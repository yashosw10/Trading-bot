import asyncio
import math
from collections import deque
from datetime import datetime, timezone
from loguru import logger
from models import TickerData, TradeSignal
import database

# ─────────────────────────────────────────────
#  Configuration constants  (tweak here only)
# ─────────────────────────────────────────────
# ── Portfolio: $9,500 USD ────────────────────────────────────────────────────
# Max per-coin stack (4 layers): $100 + $135 + $182 + $246 + $332 = $995
# Max 3 coins deployed: ~$2,985  |  Remaining buffer: ~$6,515  (68% safe)
# Global Kill fires at: −$1,425  |  Per-trade SL fires at: −8% of avg_entry
# ─────────────────────────────────────────────────────────────────────────────
BASE_ORDER           = 100.0  # $ for the first buy
VOLUME_MULTIPLIER    = 1.35   # Gentler curve — max Layer 4 = ~$332 per order
MAX_DCA_LAYERS       = 4      # Hard cap — 4 layers keeps max per-coin at ~$995
MAX_CONCURRENT_POS   = 3      # Max symbols in an active DCA stack at once

BB_PERIOD            = 20     # Bollinger Band look-back (in 1-min candles)
BLACK_SWAN_PERIOD    = 12     # 60 s at 5 s polling → 12 ticks
BLACK_SWAN_DROP      = 0.15   # 15 % drop in 60 s triggers blacklist
BLACK_SWAN_MAX       = 3      # Permanent ban after this many events in 24 h

RSI_PERIOD           = 14     # RSI look-back (1-min candles)
RSI_ENTRY_GATE       = 48     # Loosened: enter when RSI < 48 (was 40 — missed too many quality dips)
RSI_DCA_SKIP_LOW     = 48     # DCA skip zone: 48–58 (neutral — let position age)
RSI_DCA_SKIP_HIGH    = 58     # (was 40–60 — now narrower, allows more DCA layers)
EMA_PERIOD           = 50     # Trend filter — only buy above this EMA (1-min candles)

GRID_TIGHT           = 0.005  # 0.5 % grid when low volatility
GRID_WIDE            = 0.020  # 2.0 % grid when high volatility
BB_VOLATILITY_THRESH = 0.020  # BBW above this → wide grid

# Take-profit tranches (must sum to 1.0)
TP_TRANCHE_1_PCT     = 0.40   # sell 40 % at 1× grid above avg entry
TP_TRANCHE_2_PCT     = 0.35   # sell 35 % at 2× grid above avg entry
TP_TRANCHE_3_PCT     = 0.25   # trail remaining 25 % with trailing stop

PER_TRADE_STOP_PCT   = 0.08   # Per-symbol stop-loss: exit if price < avg_entry × (1 − this)
GLOBAL_KILL_PCT      = 0.15   # Panic-sell all if wallet unrealized loss > 15 % of start

REENTRY_COOLDOWN_S   = 120    # 2-min cooldown after any TP or stop-loss exit (was 300s — too slow)
BLACKLIST_TIMEOUT_S  = 7200   # 2-hour soft ban after a flash crash
CANDLE_INTERVAL_S    = 60     # Aggregate 5 s ticks into 1-min candles for indicators
PANIC_SELL_STAGGER_S = 30     # Seconds between each staggered panic-sell order


# ─────────────────────────────────────────────
#  Indicator helpers
# ─────────────────────────────────────────────

def _calc_ema(prices: list[float], period: int) -> float:
    """EMA over a list (oldest → newest). Falls back to SMA if too few points."""
    if not prices:
        return 0.0
    if len(prices) < period:
        return sum(prices) / len(prices)
    k = 2.0 / (period + 1)
    ema = sum(prices[:period]) / period
    for p in prices[period:]:
        ema = p * k + ema * (1 - k)
    return ema


def _calc_rsi(closes: list[float], period: int) -> float:
    """
    Wilder RSI.  Uses simple average for the seed, then applies Wilder smoothing
    for any bars beyond the seed window.  Returns 50.0 (neutral) if not enough data.
    """
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    seed = deltas[:period]
    avg_gain = sum(d for d in seed if d > 0) / period
    avg_loss = sum(-d for d in seed if d < 0) / period
    for d in deltas[period:]:
        gain = d if d > 0 else 0.0
        loss = -d if d < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0:
        return 100.0
    return 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))


# ─────────────────────────────────────────────
#  Candle aggregator
# ─────────────────────────────────────────────

class _CandleAggregator:
    """
    Rolls up raw 5-second price ticks into completed 1-minute candles using
    wall-clock deadlines — no silent gaps if a tick happens to straddle a
    minute boundary.
    """

    def __init__(self):
        self._close    = None
        self._deadline = None

    def feed(self, price: float, ts: datetime) -> float | None:
        """
        Feed one raw tick.  Returns the completed candle's close price when a
        minute boundary is crossed, otherwise None.
        """
        now = ts.timestamp()
        if self._deadline is None:
            self._deadline = now + CANDLE_INTERVAL_S
            self._close = price
            return None
        if now < self._deadline:
            self._close = price
            return None
        # Candle complete
        close = self._close
        self._close    = price
        self._deadline = now + CANDLE_INTERVAL_S
        return close


# ─────────────────────────────────────────────
#  Per-symbol state
# ─────────────────────────────────────────────

class SymbolState:
    """All mutable state for one trading symbol, in one place."""

    def __init__(self):
        # Raw 5 s ticks — used only for black-swan detection
        self.raw_prices: deque = deque(maxlen=BLACK_SWAN_PERIOD)

        # 1-min candle closes — used for all three indicators
        self.candles: deque = deque(maxlen=max(BB_PERIOD, EMA_PERIOD, RSI_PERIOD + 1) + 5)
        self.aggregator = _CandleAggregator()

        # ── Position tracking ──
        self.position_amount: float = 0.0
        self.total_invested: float  = 0.0
        self.dca_layer: int         = 0      # 0 = flat, 1 = base order placed, 2+ = DCA layers
        self.avg_entry: float       = 0.0
        self.last_buy_price: float  = 0.0
        self.entry_grid: float      = 0.0   # grid spacing locked in at the time of the base order
        self.price_high: float      = 0.0   # highest price during position lifetime (MFE)
        self.price_low: float       = 0.0   # lowest price during position lifetime (MAE)
        self.last_trade_ts: float   = 0.0   # timestamp of the last buy or partial sell

        # ── Take-profit tranche flags ──
        self.tp1_done: bool    = False
        self.tp2_done: bool    = False
        self.trail_high: float = 0.0        # highest price seen after TP1; drives trailing stop

        # ── Cooldown / ban ──
        self.reentry_until: float          = 0.0
        self.blacklist_until: float        = 0.0   # 0 = not banned; inf = permanent
        self.flash_crash_count: int        = 0
        self.flash_crash_window_start: float = 0.0

    def to_dict(self):
        return {
            "position_amount": self.position_amount,
            "total_invested": self.total_invested,
            "dca_layer": self.dca_layer,
            "avg_entry": self.avg_entry,
            "last_buy_price": self.last_buy_price,
            "entry_grid": self.entry_grid,
            "price_high": self.price_high,
            "price_low": self.price_low,
            "tp1_done": self.tp1_done,
            "tp2_done": self.tp2_done,
            "trail_high": self.trail_high,
            "reentry_until": self.reentry_until,
            "blacklist_until": self.blacklist_until,
            "flash_crash_count": self.flash_crash_count,
            "flash_crash_window_start": self.flash_crash_window_start,
            "last_trade_ts": self.last_trade_ts
        }

    def from_dict(self, data: dict):
        self.position_amount = data.get("position_amount", 0.0)
        self.total_invested = data.get("total_invested", 0.0)
        self.dca_layer = data.get("dca_layer", 0)
        self.avg_entry = data.get("avg_entry", 0.0)
        self.last_buy_price = data.get("last_buy_price", 0.0)
        self.entry_grid = data.get("entry_grid", 0.0)
        self.price_high = data.get("price_high", 0.0)
        self.price_low = data.get("price_low", 0.0)
        self.tp1_done = data.get("tp1_done", False)
        self.tp2_done = data.get("tp2_done", False)
        self.trail_high = data.get("trail_high", 0.0)
        self.reentry_until = data.get("reentry_until", 0.0)
        self.blacklist_until = data.get("blacklist_until", 0.0)
        self.flash_crash_count = data.get("flash_crash_count", 0)
        self.flash_crash_window_start = data.get("flash_crash_window_start", 0.0)
        self.last_trade_ts = data.get("last_trade_ts", 0.0)

# ─────────────────────────────────────────────
#  Strategy engine
# ─────────────────────────────────────────────

class StrategyEngine:
    def __init__(self, data_queue: asyncio.Queue, order_queue: asyncio.Queue):
        self.data_queue    = data_queue
        self.order_queue   = order_queue
        self.fiat_currency = 'USD'

        self.states: dict[str, SymbolState] = {}
        self.bot_halted       = False
        self.is_panic_selling = False
        self.starting_balance = 0.0
        self.peak_equity      = 0.0
        self.start_ts         = 0.0

    # ══════════════════════════════════════════
    #  Internal helpers
    # ══════════════════════════════════════════

    async def _persist_state(self, symbol: str):
        state = self.states[symbol]
        import json
        await database.upsert_strategy_state(symbol, json.dumps(state.to_dict()))

    def _active_positions(self) -> int:
        return sum(1 for s in self.states.values() if s.dca_layer > 0)

    def _grid_spacing(self, symbol: str) -> float:
        """
        Volatility-adjusted grid spacing from 1-min Bollinger Band width.
        TP target also scales: max(base_grid, 0.5 × bb_width) so we don't
        exit too early during high-volatility regimes.
        """
        candles = list(self.states[symbol].candles)
        if len(candles) < BB_PERIOD:
            return GRID_TIGHT
        recent = candles[-BB_PERIOD:]
        sma = sum(recent) / BB_PERIOD
        if sma == 0:
            return GRID_TIGHT
        variance = sum((p - sma) ** 2 for p in recent) / BB_PERIOD
        bb_width = (4 * math.sqrt(variance)) / sma
        base_grid = GRID_WIDE if bb_width > BB_VOLATILITY_THRESH else GRID_TIGHT
        return max(base_grid, 0.5 * bb_width)

    def _indicators(self, symbol: str) -> tuple[float, float]:
        """Return (ema, rsi) computed on the 1-min candle history."""
        candles = list(self.states[symbol].candles)
        return _calc_ema(candles, EMA_PERIOD), _calc_rsi(candles, RSI_PERIOD)

    def _passes_entry_gate(self, symbol: str) -> bool:
        """
        Base-order gate:
          • Price must be above the 50-EMA  (confirmed uptrend)
          • RSI must be below RSI_ENTRY_GATE (oversold / quality entry)
        """
        st = self.states[symbol]
        price = st.raw_prices[-1] if st.raw_prices else 0.0
        ema, rsi = self._indicators(symbol)
        if price <= ema:
            logger.debug(f"{symbol}: trend FAIL  price={price:.4f} EMA={ema:.4f}")
            return False
        if rsi >= RSI_ENTRY_GATE:
            logger.debug(f"{symbol}: RSI FAIL  RSI={rsi:.1f}")
            return False
        return True

    def _passes_dca_gate(self, symbol: str) -> bool:
        """
        DCA layer gate:
          • Only add when RSI < 40 (deep oversold) OR RSI > 60 (strong momentum)
          • Skip the 40–60 neutral zone — let the position age instead.
        """
        _, rsi = self._indicators(symbol)
        passes = rsi < RSI_DCA_SKIP_LOW or rsi > RSI_DCA_SKIP_HIGH
        if not passes:
            logger.debug(f"{symbol}: DCA RSI gate FAIL  RSI={rsi:.1f} (neutral zone)")
        return passes

    async def _place_buy(self, symbol: str, amount_fiat: float,
                         price: float, ticker: TickerData, label: str):
        amount_crypto = amount_fiat / price
        logger.info(f"BUY  {symbol} | {label} | ${amount_fiat:.2f} @ {price:.4f}")
        await self.order_queue.put((
            TradeSignal(symbol=symbol, side='buy',
                        fiat_currency=self.fiat_currency, amount=amount_crypto),
            ticker
        ))
        st = self.states[symbol]
        st.last_buy_price   = price
        if st.dca_layer == 0:
            st.price_high = price
            st.price_low = price
            st.entry_grid = self._grid_spacing(symbol)
        else:
            st.price_high = max(st.price_high, price)
            st.price_low = min(st.price_low, price)
            
        st.dca_layer       += 1
        st.trail_high       = max(st.trail_high, price)
        st.last_trade_ts    = datetime.now(timezone.utc).timestamp()
        await self._persist_state(symbol)

    async def _place_sell(self, symbol: str, amount_crypto: float,
                          price: float, ticker: TickerData, label: str):
        if amount_crypto <= 0:
            return
            
        st = self.states[symbol]
        mfe = (st.price_high - st.avg_entry) / st.avg_entry * 100 if st.avg_entry > 0 else 0.0
        mae = (st.avg_entry - st.price_low) / st.avg_entry * 100 if st.avg_entry > 0 else 0.0

        logger.info(f"SELL {symbol} | {label} | {amount_crypto:.6f} @ {price:.4f} (MFE: {mfe:.2f}%, MAE: {mae:.2f}%)")
        await self.order_queue.put((
            TradeSignal(symbol=symbol, side='sell',
                        fiat_currency=self.fiat_currency, amount=amount_crypto,
                        mfe=mfe, mae=mae),
            ticker
        ))
        st.last_trade_ts = datetime.now(timezone.utc).timestamp()
        
        await self._persist_state(symbol)

    def _reset_position(self, symbol: str, cooldown: bool = True):
        st = self.states[symbol]
        st.dca_layer       = 0
        st.avg_entry       = 0.0
        st.last_buy_price  = 0.0
        st.entry_grid      = 0.0
        st.tp1_done        = False
        st.tp2_done        = False
        st.trail_high      = 0.0
        st.price_high      = 0.0
        st.price_low       = 0.0
        st.last_trade_ts   = 0.0
        if cooldown:
            st.reentry_until = datetime.now(timezone.utc).timestamp() + REENTRY_COOLDOWN_S
            logger.info(f"{symbol}: {REENTRY_COOLDOWN_S}s re-entry cooldown started.")
        asyncio.create_task(self._persist_state(symbol))

    async def _staggered_panic_sell(self):
        """
        Close all open positions across both paper and live modes.
        Each sell is staggered by PANIC_SELL_STAGGER_S to reduce slippage.
        """
        self.is_panic_selling = True
        config = await database.get_bot_config()
        active_mode = config.get("mode", "paper")
        
        positions = await database.get_all_positions(active_mode)
        for pos in positions:
            sym = pos['symbol']
            amount = pos['amount']
            
            # Grab current price from active state if available, else fallback to avg price
            st = self.states.get(sym)
            price = st.raw_prices[-1] if st and st.raw_prices else pos['average_price_usd']
            
            logger.critical(f"PANIC SELL {sym} ({active_mode.upper()}) | {amount:.6f} @ {price:.4f}")
            usd_to_inr = await database.get_fx_rate("INR")
            usd_to_eur = await database.get_fx_rate("EUR")
            
            fake_ticker = TickerData(
                symbol=sym, price_usd=price,
                price_inr=price * usd_to_inr, price_eur=price * usd_to_eur, price_change_percent=0,
                timestamp=datetime.now(timezone.utc)
            )
            
            mfe = (st.price_high - st.avg_entry) / st.avg_entry * 100 if st and st.avg_entry > 0 else 0.0
            mae = (st.avg_entry - st.price_low) / st.avg_entry * 100 if st and st.avg_entry > 0 else 0.0
            
            await self.order_queue.put((
                TradeSignal(symbol=sym, side='sell',
                            fiat_currency=self.fiat_currency, amount=amount,
                            mfe=mfe, mae=mae, mode_override=active_mode),
                fake_ticker
            ))
            if st:
                st.position_amount = 0.0
                st.total_invested  = 0.0
                await self._persist_state(sym)
            await asyncio.sleep(PANIC_SELL_STAGGER_S)
        self.is_panic_selling = False

    # ══════════════════════════════════════════
    #  Main event loop
    # ══════════════════════════════════════════

    async def start(self, shutdown_event: asyncio.Event):
        logger.info("Starting Volatility-Adjusted DCA Hybrid Engine (v3 — merged)...")

        config = await database.get_bot_config()
        active_mode = config.get("mode", "paper")
        self.starting_balance = await database.get_balance(self.fiat_currency, mode=active_mode)
        if active_mode == "live":
            try:
                from exchange import CoinDCXClient
                client = CoinDCXClient()
                live_balances = await client.get_balances()
                if isinstance(live_balances, list):
                    for b in live_balances:
                        currency = b.get("currency")
                        b_amt = float(b.get("balance", 0.0))
                        if currency in ["USDT", "INR", "EUR"]:
                            cur = "USD" if currency == "USDT" else currency
                            await database.set_balance(cur, b_amt, mode="live")
                            if cur == self.fiat_currency:
                                self.starting_balance = b_amt
            except Exception as e:
                logger.error(f"Failed to fetch live starting balance: {e}")
        
        global_kill_pct = config.get("daily_loss_limit", 15.0) / 100.0
        
        logger.info(
            f"Starting balance ({active_mode.upper()}) : ${self.starting_balance:.2f}  |  "
            f"Global kill switch : −{global_kill_pct*100:.0f}%  "
            f"(−${self.starting_balance * global_kill_pct:.2f})  |  "
            f"Per-trade SL : −{PER_TRADE_STOP_PCT*100:.0f}%"
        )

        self.peak_equity = self.starting_balance
        self.start_ts = datetime.now(timezone.utc).timestamp()

        while not shutdown_event.is_set():
            try:
                config = await database.get_bot_config()
                global_kill_pct = config.get("daily_loss_limit", 15.0) / 100.0
                is_paused = config.get("is_paused", False)
                
                # Dynamic parameters
                base_order = float(config.get("base_order", BASE_ORDER))
                volume_multiplier = float(config.get("volume_multiplier", VOLUME_MULTIPLIER))
                per_trade_stop_pct = float(config.get("per_trade_stop_pct", PER_TRADE_STOP_PCT * 100)) / 100.0
                max_dca_layers = int(config.get("max_dca_layers", MAX_DCA_LAYERS))
                
                ticker: TickerData = await asyncio.wait_for(
                    self.data_queue.get(), timeout=1.0
                )

                if self.bot_halted:
                    self.data_queue.task_done()
                    continue

                symbol  = ticker.symbol
                price   = ticker.price_usd
                now_ts  = datetime.now(timezone.utc).timestamp()

                # ── Initialise state for new symbol ───────────────────
                if symbol not in self.states:
                    state = SymbolState()
                    import json
                    st_json = await database.load_strategy_state(symbol)
                    if st_json:
                        try:
                            state.from_dict(json.loads(st_json))
                            logger.info(f"Loaded persistent state for {symbol}")
                        except Exception as e:
                            logger.error(f"Failed to load state for {symbol}: {e}")
                    self.states[symbol] = state
                st = self.states[symbol]

                # ── True DB State Sync ────────────────────────────────
                pos = await database.get_position(symbol, mode=active_mode)
                if pos:
                    st.position_amount = pos['amount']
                    st.avg_entry = pos['average_price_usd']
                    st.total_invested = st.position_amount * st.avg_entry
                else:
                    st.position_amount = 0.0
                    st.avg_entry = 0.0
                    st.total_invested = 0.0

                # ── Feed raw tick ─────────────────────────────────────
                st.raw_prices.append(price)

                if st.dca_layer > 0:
                    st.price_high = max(st.price_high, price)
                    st.price_low = min(st.price_low, price)

                # ── Aggregate raw tick → 1-min candle ─────────────────
                candle_close = st.aggregator.feed(price, ticker.timestamp)
                if candle_close is not None:
                    st.candles.append(candle_close)

                # ════════════════════════════════════════════════════
                #  RISK LAYER 1 — Black-swan circuit breaker
                # ════════════════════════════════════════════════════
                if len(st.raw_prices) == st.raw_prices.maxlen:
                    max_60s = max(st.raw_prices)
                    if price < max_60s * (1 - BLACK_SWAN_DROP):
                        if now_ts - st.flash_crash_window_start > 86400:
                            st.flash_crash_count = 0
                            st.flash_crash_window_start = now_ts
                        st.flash_crash_count += 1

                        logger.critical(
                            f"FLASH CRASH {symbol} | drop >{BLACK_SWAN_DROP*100:.0f}% "
                            f"in 60s | event #{st.flash_crash_count} today"
                        )

                        if st.flash_crash_count >= BLACK_SWAN_MAX:
                            st.blacklist_until = float('inf')
                            logger.critical(f"{symbol}: permanently blacklisted (3 crashes today).")
                        else:
                            st.blacklist_until = now_ts + BLACKLIST_TIMEOUT_S
                            logger.warning(f"{symbol}: soft-banned for {BLACKLIST_TIMEOUT_S // 3600}h.")

                        await self._persist_state(symbol)

                        if st.position_amount > 0:
                            await self._place_sell(symbol, st.position_amount, price, ticker, "FLASH CRASH EXIT")
                            self._reset_position(symbol, cooldown=False)

                        self.data_queue.task_done()
                        continue

                # Honour active ban
                if st.blacklist_until > now_ts:
                    self.data_queue.task_done()
                    continue

                # ════════════════════════════════════════════════════
                #  RISK LAYER 2 — Global kill switch  (−15 % of wallet)
                #  Closes all positions sorted worst-first, 30 s apart.
                # ════════════════════════════════════════════════════
                total_unrealized = sum(
                    s.position_amount * s.raw_prices[-1] - s.total_invested
                    for s in self.states.values()
                    if s.total_invested > 0 and s.raw_prices
                )
                if (self.starting_balance > 0 and
                        total_unrealized <= -(self.starting_balance * global_kill_pct)):
                    logger.critical(
                        f"GLOBAL KILL SWITCH | unrealized PnL ${total_unrealized:.2f} | "
                        f"limit -{global_kill_pct*100:.1f}% | halting bot and panic-selling (worst first)."
                    )
                    self.bot_halted = True
                    asyncio.create_task(self._staggered_panic_sell())
                    self.data_queue.task_done()
                    continue

                # ════════════════════════════════════════════════════
                #  RISK LAYER 2B — Max Drawdown from Peak Equity
                # ════════════════════════════════════════════════════
                max_drawdown_pct = config.get("max_drawdown_pct", 15.0) / 100.0
                session_pnl = await database.get_session_pnl(self.fiat_currency, self.start_ts, mode=active_mode)
                
                total_position_value = sum(
                    s.position_amount * s.raw_prices[-1] 
                    for s in self.states.values() 
                    if s.position_amount > 0 and s.raw_prices
                )
                
                # Equity generated by the bot, ignoring external deposits/withdrawals
                current_equity = self.starting_balance + session_pnl + total_unrealized
                
                if current_equity > self.peak_equity:
                    self.peak_equity = current_equity
                
                if self.peak_equity > 0:
                    drawdown = (self.peak_equity - current_equity) / self.peak_equity
                    if drawdown >= max_drawdown_pct:
                        logger.critical(
                            f"MAX DRAWDOWN HIT | Peak Equity ${self.peak_equity:.2f} | "
                            f"Current Equity ${current_equity:.2f} | "
                            f"Drawdown {drawdown*100:.1f}% >= Limit {max_drawdown_pct*100:.1f}% | "
                            f"halting bot and panic-selling."
                        )
                        self.bot_halted = True
                        asyncio.create_task(self._staggered_panic_sell())
                        self.data_queue.task_done()
                        continue

                # ════════════════════════════════════════════════════
                #  RISK LAYER 3 — Per-symbol stop-loss  (−8 % from avg entry)
                # ════════════════════════════════════════════════════
                if (st.dca_layer > 0 and st.avg_entry > 0 and
                        price < st.avg_entry * (1 - per_trade_stop_pct)):
                    logger.warning(
                        f"STOP LOSS {symbol} | drop >{per_trade_stop_pct*100:.0f}% from avg entry | "
                        f"stop {st.avg_entry * (1 - per_trade_stop_pct):.4f}"
                    )
                    await self._place_sell(symbol, st.position_amount, price, ticker, "STOP-LOSS")
                    self._reset_position(symbol, cooldown=True)
                    self.data_queue.task_done()
                    continue

                # ── Re-entry cooldown gate ────────────────────────────
                if st.dca_layer == 0 and now_ts < st.reentry_until:
                    self.data_queue.task_done()
                    continue

                # ── Need BB_PERIOD candles before we can trade ────────
                if len(st.candles) < BB_PERIOD:
                    self.data_queue.task_done()
                    continue

                grid = self._grid_spacing(symbol)

                # ════════════════════════════════════════════════════
                #  EXECUTION — Base order
                #  Entry gates: concurrent cap · EMA trend · RSI oversold
                # ════════════════════════════════════════════════════
                if st.dca_layer == 0:
                    if is_paused:
                        self.data_queue.task_done()
                        continue
                    if self._active_positions() >= MAX_CONCURRENT_POS:
                        self.data_queue.task_done()
                        continue
                    if not self._passes_entry_gate(symbol):
                        self.data_queue.task_done()
                        continue

                    await self._place_buy(symbol, base_order, price, ticker, "Base Order")
                    st.entry_grid = grid   # lock grid at entry for all TP maths

                # ════════════════════════════════════════════════════
                #  EXECUTION — DCA layers  (hard-capped at MAX_DCA_LAYERS)
                #  DCA RSI gate: skip the 40–60 neutral zone
                # ════════════════════════════════════════════════════
                elif (st.tp1_done is False and
                      price < st.last_buy_price * (1 - grid)):
                    if st.dca_layer >= max_dca_layers:
                        logger.warning(f"{symbol}: DCA cap ({max_dca_layers}) reached — holding.")
                    elif self._passes_dca_gate(symbol):
                        n = st.dca_layer
                        amount_fiat = base_order * (volume_multiplier ** n)
                        await self._place_buy(symbol, amount_fiat, price, ticker, f"DCA Layer {n + 1}")

                # ════════════════════════════════════════════════════
                #  EXECUTION — Take-profit tranches
                #
                #  Tranche 1 (40 %) — 1× grid above avg entry
                #  Tranche 2 (35 %) — 2× grid above avg entry
                #  Tranche 3 (25 %) — trailing stop: 0.8× grid below trail_high
                #
                #  entry_grid is used (not live grid) so targets don't shift
                #  mid-position if volatility changes after entry.
                # ════════════════════════════════════════════════════
                elif st.dca_layer > 0 and st.avg_entry > 0:
                    g = st.entry_grid
                    hours_stuck = (now_ts - st.last_trade_ts) / 3600.0 if st.last_trade_ts > 0 else 0.0

                    if hours_stuck > 72.0:
                        logger.warning(f"TIME STOP {symbol} | Stuck for >72h | Exiting at market")
                        await self._place_sell(symbol, st.position_amount, price, ticker, "TIME-STOP")
                        self._reset_position(symbol, cooldown=True)
                        self.data_queue.task_done()
                        continue

                    if not st.tp1_done:
                        if hours_stuck > 24.0:
                            decay_factor = min(1.0, (hours_stuck - 24.0) / 48.0)
                            target_multiplier = 1 + (g * (1 - decay_factor)) + (0.002 * decay_factor)
                        else:
                            target_multiplier = 1 + g

                        # FIX: the sell + state updates were previously
                        # dedented out of this `if`, causing an
                        # UnboundLocalError on `sell_amt` every tick the
                        # price target was NOT met, silently swallowed by
                        # the outer try/except in the main loop.
                        if price >= st.avg_entry * target_multiplier:
                            sell_amt = st.position_amount * TP_TRANCHE_1_PCT
                            await self._place_sell(symbol, sell_amt, price, ticker, "TP1 — 40%")
                            st.tp1_done   = True
                            st.trail_high = price

                    elif st.tp1_done and not st.tp2_done and price >= st.avg_entry * (1 + 2 * g):
                        sell_amt = st.position_amount * TP_TRANCHE_2_PCT
                        await self._place_sell(symbol, sell_amt, price, ticker, "TP2 — 35%")
                        st.tp2_done   = True
                        st.trail_high = max(st.trail_high, price)

                    elif st.tp2_done and st.position_amount > 0:
                        st.trail_high = max(st.trail_high, price)
                        trail_stop    = st.trail_high * (1 - 0.8 * g)
                        if price <= trail_stop:
                            await self._place_sell(symbol, st.position_amount, price, ticker, "TP3 — trailing stop 25%")
                            self._reset_position(symbol, cooldown=True)
                            logger.info(f"{symbol}: full cycle complete.")

                self.data_queue.task_done()

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Strategy error: {e}")

        logger.info("Strategy Engine stopped gracefully.")