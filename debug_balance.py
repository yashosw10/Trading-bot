import asyncio
from backtest import run_backtest

async def main():
    res = await run_backtest("BINANCE:BTC/USDT", "1m", config={}, start_time_ms=1751328000000, end_time_ms=1760438400000)
    print("Return:", res['total_return_pct'])
    print("Balance:", res['final_balance'])
    
asyncio.run(main())
