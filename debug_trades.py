import asyncio
from backtest import run_backtest
import json

async def main():
    res = await run_backtest("BINANCE:BTC/USDT", "1m", config={}, start_time_ms=1751328000000, end_time_ms=1760438400000)
    print("Return:", res['total_return_pct'])
    print("Balance:", res['final_balance'])
    print("Profit Factor:", res['profit_factor'])
    print("Trades:", res['total_trades'])

    # Let's import the function and patch it to return trades
    from backtest import _load_local, _INTERVAL_HOURS, REENTRY_COOLDOWN_S, TIME_STOP_HOURS
    import pandas as pd
    
    # Just run it manually here
    ohlcv = _load_local("BINANCE:BTC/USDT", "1m", start_time_ms=1751328000000, end_time_ms=1760438400000)
    df = pd.DataFrame(ohlcv)
    # I won't re-write the whole logic. 
    # Let me just patch backtest.py to print the top 5 largest losses.
    
asyncio.run(main())
