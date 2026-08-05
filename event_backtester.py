import asyncio
import sqlite3
import pandas as pd
from datetime import datetime, timezone
from loguru import logger
import sys

from strategy import StrategyEngine, SymbolState
from models import TickerData, TradeSignal
import database

PAPER_WALLET_START = 10000.0
DB_PATH = "history.db"

class EventDrivenBacktester(StrategyEngine):
    def __init__(self, data_queue, order_queue, fiat_currency="USDT"):
        super().__init__(data_queue, order_queue)
        self.fiat_currency = fiat_currency
        
        self.current_sim_time = datetime.now(timezone.utc)
        self.simulated_balance = PAPER_WALLET_START
        self.total_trades = 0
        self.winning_trades = 0
        self.cpp_overrides = 0
        
        self.peak_balance = PAPER_WALLET_START
        self.max_drawdown = 0.0
        
        self.monthly_metrics = {} 
        self._last_month = None

    async def _sync_starting_balance(self, active_mode: str):
        self.starting_balance = self.simulated_balance
        self.last_balance_reset_day = self._now().date()

    def _update_period(self):
        month_key = self.current_sim_time.strftime("%Y-%m")
        if month_key not in self.monthly_metrics:
            self.monthly_metrics[month_key] = {
                "trades": 0, "wins": 0, "pnl_dollars": 0.0, "start_bal": self.simulated_balance
            }
        self._last_month = month_key

    async def _process_simulated_buy(self, symbol: str, amount_crypto: float, price: float, label: str):
        if symbol not in self.states:
            self.states[symbol] = SymbolState()
        st = self.states[symbol]
        
        amount_fiat = amount_crypto * price
        fee = amount_fiat * 0.001
        self.simulated_balance -= (amount_fiat + fee)
        
        new_total_invested = st.total_invested + amount_fiat
        st.position_amount += amount_crypto
        st.avg_entry = new_total_invested / st.position_amount
        st.total_invested = new_total_invested
        
        if "OVERRIDE" in label or getattr(st, 'current_kelly', 0) > 0:
            self.cpp_overrides += 1
            
        await self.on_order_completed(symbol, 'buy', amount_crypto, price, True, label)

    async def _process_simulated_sell(self, symbol: str, amount_crypto: float, price: float, label: str):
        st = self.states.get(symbol)
        if not st: return
        
        amount_fiat = amount_crypto * price
        fee = amount_fiat * 0.001
        
        # PnL logic before modifying position
        if st.avg_entry > 0:
            trade_profit = amount_fiat - fee - (amount_crypto * st.avg_entry)
            pnl_pct = ((price - st.avg_entry) / st.avg_entry) * 100
            
            self._update_period()
            month_data = self.monthly_metrics[self._last_month]
            
            self.total_trades += 1
            month_data["trades"] += 1
            month_data["pnl_dollars"] += trade_profit
            
            if pnl_pct > 0:
                self.winning_trades += 1
                month_data["wins"] += 1

        self.simulated_balance += (amount_fiat - fee)
        
        st.position_amount -= amount_crypto
        if st.position_amount <= 0.00001:
            st.position_amount = 0.0
            st.avg_entry = 0.0
            st.total_invested = 0.0
                
        if self.simulated_balance > self.peak_balance:
            self.peak_balance = self.simulated_balance
        dd = (self.peak_balance - self.simulated_balance) / self.peak_balance * 100
        if dd > self.max_drawdown:
            self.max_drawdown = dd
            
        await self.on_order_completed(symbol, 'sell', amount_crypto, price, True, label)

async def run_backtest_for_symbol(symbol: str):
    logger.info(f"--- Starting True Event-Driven Backtest for {symbol} ---")
    
    conn = sqlite3.connect(DB_PATH)
    db_symbol = f"BINANCE:{symbol}"
    query = f"SELECT timestamp, close FROM candles WHERE symbol = '{db_symbol}' ORDER BY timestamp ASC"
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if df.empty:
        logger.error(f"No historical data found for {db_symbol}")
        return
        
    logger.info(f"Loaded {len(df)} historical candles")
    
    data_queue = asyncio.Queue()
    order_queue = asyncio.Queue()
    engine = EventDrivenBacktester(data_queue, order_queue)
    
    # Mock DB
    async def mock_get_bot_config():
        return {
            "base_order": 100.0, "max_open_positions": 3, "rsi_entry_gate": 30.0,
            "auto_tune_enabled": False, "global_kill_pct": -15.0,
            "max_dca_layers": 4, "is_paused": False
        }
    async def mock_get_position(*args, **kwargs):
        return None 
    async def mock_persist_state(*args, **kwargs):
        pass
        
    database.get_bot_config = mock_get_bot_config
    database.get_position = mock_get_position
    engine._persist_state = mock_persist_state
    
    await engine._sync_starting_balance("paper")
    
    # Silence loop logs
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), level="WARNING")
    
    # Run engine in background
    shutdown_event = asyncio.Event()
    engine_task = asyncio.create_task(engine.start(shutdown_event))
    
    # Feed Loop
    for idx, row in df.iterrows():
        current_time = datetime.fromtimestamp(row['timestamp']/1000, tz=timezone.utc)
        engine.current_sim_time = current_time
        engine._update_period()
        
        ticker = TickerData(
            symbol=symbol, price_usd=row['close'],
            price_inr=row['close'] * 85, price_eur=row['close'] * 0.9,
            price_change_percent=0.0, timestamp=current_time
        )
        
        await engine.data_queue.put(ticker)
        
        # Wait for engine to process this tick entirely (requires data_queue.task_done() in engine)
        await engine.data_queue.join()
            
        # Process any orders it emitted
        while not engine.order_queue.empty():
            trade_signal, t = await engine.order_queue.get()
            if trade_signal.side == 'buy':
                await engine._process_simulated_buy(symbol, trade_signal.amount, row['close'], "SIM_BUY")
            else:
                await engine._process_simulated_sell(symbol, trade_signal.amount, row['close'], "SIM_SELL")
            engine.order_queue.task_done()
            
    shutdown_event.set()
    await engine.data_queue.put(None) # Unblock get()
    
    logger.remove()
    logger.add(sys.stderr, level="INFO")

    win_rate = (engine.winning_trades / engine.total_trades * 100) if engine.total_trades > 0 else 0
    net_profit = engine.simulated_balance - PAPER_WALLET_START
    
    print("\n" + "="*60)
    print(f"EVENT-DRIVEN BACKTEST REPORT: {symbol}")
    print("="*60)
    print(f"Total Candles Processed: {len(df):,}")
    print(f"Total Trades Executed:   {engine.total_trades}")
    print(f"Win Rate:                {win_rate:.1f}%")
    print(f"Max Drawdown:            {engine.max_drawdown:.2f}%")
    print(f"Starting Balance:        ${PAPER_WALLET_START:,.2f}")
    print(f"Ending Balance:          ${engine.simulated_balance:,.2f}")
    print(f"Net Profit:              ${net_profit:,.2f} ({(net_profit/PAPER_WALLET_START)*100:.2f}%)")
    
    print("\n--- SUB-PERIOD BREAKDOWN (MONTHLY) ---")
    for month, data in engine.monthly_metrics.items():
        if data["trades"] > 0:
            m_win_rate = (data["wins"] / data["trades"] * 100)
            print(f"[{month}] Trades: {data['trades']:2d} | Win Rate: {m_win_rate:5.1f}% | PnL: ${data['pnl_dollars']:+7.2f}")
    print("="*60 + "\n")

if __name__ == "__main__":
    asyncio.run(run_backtest_for_symbol("BTC/USDT"))
