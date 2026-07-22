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
    
    for regime_name, start_date, end_date in regimes:
        start_ms = to_ms(start_date)
        end_ms = to_ms(end_date)
        
        print(f"\n=================================================================")
        print(f" REGIME: {regime_name.upper()} ({start_date} to {end_date})")
        print(f"=================================================================")
        
        res_static = await run_backtest(symbol, interval, None, config, start_time_ms=start_ms, end_time_ms=end_ms, exit_mode="STATIC_LADDER")
        res_dynamic = await run_backtest(symbol, interval, None, config, start_time_ms=start_ms, end_time_ms=end_ms, exit_mode="DYNAMIC_TRAILING")
        
        if res_static and res_dynamic:
            print(f"{'Metric':<25} | {'Static Ladder (Control)':<25} | {'Dynamic Trailing':<20}")
            print("-" * 65)
            print(f"{'Total Return %':<25} | {res_static['total_return_pct']:>23.2f}% | {res_dynamic['total_return_pct']:>17.2f}%")
            print(f"{'Max Drawdown %':<25} | {res_static['max_drawdown_pct']:>23.2f}% | {res_dynamic['max_drawdown_pct']:>17.2f}%")
            print(f"{'Win Rate %':<25} | {res_static['win_rate']*100:>23.1f}% | {res_dynamic['win_rate']*100:>17.1f}%")
            print(f"{'Stop-Loss Hit Rate %':<25} | {res_static.get('sl_hit_rate_pct', 0.0):>23.2f}% | {res_dynamic.get('sl_hit_rate_pct', 0.0):>17.2f}%")
            print(f"{'Profit Factor':<25} | {res_static['profit_factor']:>24.2f} | {res_dynamic['profit_factor']:>18.2f}")
            print(f"{'Avg Duration (h)':<25} | {res_static['avg_trade_duration_hours']:>24.1f} | {res_dynamic['avg_trade_duration_hours']:>18.1f}")
            print(f"{'Total Executions':<25} | {res_static['total_trades']:>24} | {res_dynamic['total_trades']:>18}")
            print("="*65 + "\n")
        else:
            print(f"\n[ERROR] Backtest failed for {regime_name}. Make sure you have downloaded historical data first.")

if __name__ == "__main__":
    asyncio.run(main())
