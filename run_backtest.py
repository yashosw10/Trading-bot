import asyncio
import database
from backtest import run_backtest
from datetime import datetime, timezone

def to_ms(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)

async def main():
    print("Initializing database...")
    await database.init_db()
    
    config = await database.get_bot_config()
    symbol = "BINANCE:BTC/USDT"
    interval = "1m"
    
    regimes = [
        ("Bull Breakout", "2025-07-01", "2025-10-15"),
        ("Bear Drawdown", "2025-11-01", "2026-03-01"),
        ("Sideways Chop", "2026-03-01", "2026-06-01")
    ]
    
    grid = [
        (1.5, 0.5),
        (2.0, 1.0),
        (3.0, 1.5)
    ]
    
    for regime_name, start_date, end_date in regimes:
        pass # Skip grid search, already done
        
    print("\n--- OUT OF SAMPLE VALIDATION (Jun 2026 - Jul 2026) ---")
    start_ms = to_ms("2026-06-01")
    end_ms = to_ms("2026-07-20")
    res_static = await run_backtest(symbol, interval, None, config, start_time_ms=start_ms, end_time_ms=end_ms, exit_mode="STATIC_LADDER")
    # Using 2.0/1.0 as the hypothesis winner placeholder (will analyze in terminal)
    res_dyn = await run_backtest(symbol, interval, None, config, start_time_ms=start_ms, end_time_ms=end_ms, exit_mode="DYNAMIC_TRAILING", atr_activation_mult=2.0, atr_trail_mult=1.0)
    
    if res_static and res_dyn:
        print(f"{'Metric':<25} | {'Static Ladder':<25} | {'ATR (2.0x/1.0x)':<20}")
        print(f"{'Total Return %':<25} | {res_static['total_return_pct']:>24.4f}% | {res_dyn['total_return_pct']:>19.4f}%")
        print(f"{'Max Drawdown %':<25} | {res_static['max_drawdown_pct']:>24.2f}% | {res_dyn['max_drawdown_pct']:>19.2f}%")
        print(f"{'Win Rate %':<25} | {res_static['win_rate']*100:>24.1f}% | {res_dyn['win_rate']*100:>19.1f}%")
        print(f"{'Profit Factor':<25} | {res_static['profit_factor']:>25.2f} | {res_dyn['profit_factor']:>20.2f}")
        print(f"{'Total Executions':<25} | {res_static['total_trades']:>25} | {res_dyn['total_trades']:>20}")

if __name__ == "__main__":
    asyncio.run(main())
