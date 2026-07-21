import asyncio
from datetime import datetime, timezone
from backtest import run_backtest

SYMBOLS = ["BINANCE:BTC/USDT", "BINANCE:ETH/USDT"]
START = "2026-06-01"
END = "2026-07-21"

def dt_to_ms(dt_str: str) -> int:
    dt = datetime.strptime(dt_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)

async def main():
    start_ms = dt_to_ms(START)
    end_ms = dt_to_ms(END)
    
    for sym in SYMBOLS:
        print(f"\nRunning holdout test for {sym}...")
        res = await run_backtest(sym, "1m", config={}, start_time_ms=start_ms, end_time_ms=end_ms)
        if res:
            print(f"Total Return: {res['total_return_pct']}%")
            print(f"Max DD: {res['max_drawdown_pct']}%")
            print(f"Trades: {res['total_trades']}")
            print(f"Win Rate: {res['win_rate']}")
            print(f"Profit Factor: {res['profit_factor']}")
            print(f"PnL: {res['pnl_by_label']}")
        else:
            print("Failed to run backtest.")

if __name__ == "__main__":
    asyncio.run(main())
