import asyncio
import json
import math
import sqlite3
import pandas as pd
from datetime import datetime, timezone, timedelta
from loguru import logger
from collections import deque
import unittest.mock as mock

import database
database.DB_FILE = "luna_test.db"

import strategy
from strategy import StrategyEngine
from models import TickerData, TradeSignal

# Global simulation time
SIMULATED_TIME = None

class MockDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return SIMULATED_TIME

async def setup_db():
    await database.init_db()
    
    conn = sqlite3.connect("luna_test.db")
    c = conn.cursor()
    # Wipe tables
    c.execute("DELETE FROM positions_paper")
    c.execute("DELETE FROM strategy_state")
    c.execute("DELETE FROM trades_paper")
    c.execute("DELETE FROM bot_config")
    c.execute("DELETE FROM wallet_paper")
    conn.commit()
    conn.close()

    await database.set_balance("USD", 10000.0, mode="paper")
    await database.update_bot_config({
        "mode": "paper",
        "is_paused": False,
        "daily_loss_limit": 5.0,
        "max_drawdown_pct": 15.0,
        "per_trade_stop_pct": 8.0,
        "base_order": 100,
        "volume_multiplier": 1.35,
        "max_dca_layers": 4,
        "fee_rate": 0.001,
        "slippage_rate": 0.05 # Note: We apply dynamic 5% manually in order manager
    })
    
async def mock_order_manager(order_queue: asyncio.Queue, engine: StrategyEngine):
    while True:
        try:
            signal, ticker = await order_queue.get()
            symbol = signal.symbol
            side = signal.side
            amount = signal.amount
            
            fee_rate = 0.001
            # Dynamic Slippage
            # 5% slippage on panic sells/crashes, 0.1% on buys
            slippage_rate = 0.05 if side == 'sell' else 0.001
            
            if side == 'buy':
                execution_price = ticker.price_usd * (1 + slippage_rate)
            else:
                execution_price = ticker.price_usd * (1 - slippage_rate)
                
            fee = (execution_price * amount) * fee_rate
            
            # Persist to DB using execute_trade
            pos = await database.get_position(symbol, mode="paper")
            pnl_fiat = 0.0
            pnl_percent = 0.0
            if side == 'sell' and pos:
                pnl_fiat = (execution_price - pos['average_price_usd']) * amount - fee
                pnl_percent = (execution_price - pos['average_price_usd']) / pos['average_price_usd'] * 100
                
            await database.execute_trade(
                symbol=symbol,
                side=side,
                fiat_currency='USD',
                amount=amount,
                price=execution_price,
                fee=fee,
                pnl_fiat=pnl_fiat,
                pnl_percent=pnl_percent,
                mfe=signal.mfe,
                mae=signal.mae,
                mode="paper"
            )
            
            # Notify engine
            label = "TEST"
            if signal.mae > 0 or signal.mfe > 0: label = "EXIT"
            if signal.side == 'sell': logger.warning(f"EXECUTED SELL: {amount} @ {execution_price} (SLIPPAGE APPLIED)")
            await engine.on_order_completed(symbol, side, amount, execution_price, True, label=label)
            
            order_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Mock Order Manager Error: {e}")
            
def get_luna_candles():
    conn = sqlite3.connect("multi_year_history.db")
    c = conn.cursor()
    c.execute("SELECT timestamp, open, high, low, close FROM candles WHERE symbol = 'BINANCE:LUNA/USDT' ORDER BY timestamp ASC")
    rows = c.fetchall()
    conn.close()
    return rows

def interpolate_ohlc(open_p, high_p, low_p, close_p):
    """
    Interpolate 12 ticks.
    Green candle: Open -> Low -> High -> Close
    Red candle: Open -> High -> Low -> Close
    """
    ticks = []
    
    if close_p >= open_p:
        # Green
        pts = [(0, open_p), (3, low_p), (8, high_p), (11, close_p)]
    else:
        # Red
        pts = [(0, open_p), (3, high_p), (8, low_p), (11, close_p)]
        
    # Linear interpolation between the keyframes
    def get_price(idx):
        for i in range(len(pts)-1):
            if pts[i][0] <= idx <= pts[i+1][0]:
                x0, y0 = pts[i]
                x1, y1 = pts[i+1]
                if x1 == x0: return y0
                return y0 + (y1 - y0) * ((idx - x0) / (x1 - x0))
        return close_p
        
    return [get_price(i) for i in range(12)]

async def main():
    global SIMULATED_TIME
    await setup_db()
    
    candles = get_luna_candles()
    logger.info(f"Loaded {len(candles)} candles for LUNA")
    
    data_queue = asyncio.Queue()
    order_queue = asyncio.Queue()
    
    # Patch datetime.now() inside strategy.py
    with mock.patch('strategy.datetime', MockDatetime):
        engine = StrategyEngine(data_queue, order_queue)
        engine.fiat_currency = "USD"
        
        # Start Engine
        shutdown_event = asyncio.Event()
        engine_task = asyncio.create_task(engine.start(shutdown_event))
        order_manager_task = asyncio.create_task(mock_order_manager(order_queue, engine))
        
        # Stream data
        # Let's fast forward to May 7th, where the peg started breaking and LUNA crashed
        start_ts = 1651881600000 # May 7 2022
        
        first = True
        for row in candles:
            ts, o, h, l, c = row
            if ts < start_ts:
                continue
                
            SIMULATED_TIME = datetime.fromtimestamp(ts / 1000.0, tz=timezone.utc)
            if first:
                engine.start_ts = SIMULATED_TIME.timestamp()
                engine.last_balance_reset_day = SIMULATED_TIME.date()
                first = False
                
            ticks = interpolate_ohlc(o, h, l, c)
            
            for i, price in enumerate(ticks):
                SIMULATED_TIME = datetime.fromtimestamp((ts / 1000.0) + (i * 5), tz=timezone.utc)
                ticker = TickerData(
                    symbol="BINANCE:LUNA/USDT",
                    price_usd=price,
                    price_inr=price * 80,
                    price_eur=price * 0.9,
                    price_change_percent=0.0,
                    timestamp=SIMULATED_TIME
                )
                data_queue.put_nowait(ticker)
                # Yield to let engine process
                await asyncio.sleep(0)
                
            if engine.bot_halted:
                logger.critical(f"BOT HALTED AT {SIMULATED_TIME}")
                break
                
        # Wait for queue to drain
        await data_queue.join()
        
        # Give order manager a moment to process the panic sells
        await asyncio.sleep(1.0)
        
        shutdown_event.set()
        await asyncio.sleep(0.1)
        
        # Report
        bal = await database.get_balance("USD", "paper")
        logger.info(f"FINAL BALANCE: ${bal:.2f}")
        logger.info(f"CAPITAL LOST: ${10000.0 - bal:.2f}")

if __name__ == "__main__":
    asyncio.run(main())
