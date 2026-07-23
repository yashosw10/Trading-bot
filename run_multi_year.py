import asyncio
import json
from datetime import datetime, timezone
import time
from loguru import logger

import backtest
from backtest import run_backtest

# Override DB path for the backtester
backtest.DB_PATH = "multi_year_history.db"

def to_ms(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)

async def main():
    symbol = "BINANCE:BTC/USDT"
    interval = "1m"
    config = {
        "mode": "paper",
        "is_paused": False,
        "base_order": 100,
        "volume_multiplier": 2.0,
        "max_dca_layers": 3,
        "per_trade_stop_pct": 8.0,
        "max_drawdown_pct": 15.0,
        "daily_loss_limit": 5.0,
    }
    
    # Define Regimes (2021 - 2024)
    regimes = [
        ("2021 Euphoria", "2021-01-01", "2021-05-01", "Bull"),
        ("2021 Summer Chop", "2021-05-01", "2021-08-01", "Chop"),
        ("2021 Q4 Blowoff", "2021-08-01", "2021-12-01", "Bull"),
        ("2022 Bear / Contagion", "2021-12-01", "2023-01-01", "Bear"),
        ("2023 Recovery / Chop", "2023-01-01", "2023-10-01", "Chop"),
        ("Late '23 / Early '24 ETF Bull", "2023-10-01", "2024-04-01", "Bull"),
        ("2024 Post-Halving Chop", "2024-04-01", "2024-10-01", "Chop"),
        ("2024 Q4 Rally", "2024-10-01", "2024-12-31", "Bull")
    ]
    
    usable_bear_chop_count = 0
    atr_success_count = 0
    
    for r_name, start_date, end_date, r_type in regimes:
        start_ms = to_ms(start_date)
        end_ms = to_ms(end_date)
        
        print(f"\n=========================================================================================")
        print(f" REGIME: {r_name.upper()} ({start_date} to {end_date}) [{r_type}]")
        print(f"=========================================================================================")
        
        # None for limit so it uses start_time_ms / end_time_ms
        res_static = await run_backtest(symbol, interval, None, config, start_ms, end_ms, "STATIC_LADDER")
        res_atr = await run_backtest(symbol, interval, None, config, start_ms, end_ms, "DYNAMIC_TRAILING", 2.0, 1.0)
        
        if not res_static or not res_atr:
            print(f"[ERROR] Missing data for {r_name}")
            continue
            
        print(f"{'Metric':<25} | {'Static Ladder':<25} | {'ATR (2.0x/1.0x)':<20}")
        print("-" * 75)
        print(f"{'Total Return %':<25} | {res_static['total_return_pct']:>24.4f}% | {res_atr['total_return_pct']:>19.4f}%")
        print(f"{'Max Drawdown %':<25} | {res_static['max_drawdown_pct']:>24.2f}% | {res_atr['max_drawdown_pct']:>19.2f}%")
        print(f"{'Win Rate %':<25} | {res_static['win_rate']*100:>24.1f}% | {res_atr['win_rate']*100:>19.1f}%")
        print(f"{'Profit Factor':<25} | {res_static['profit_factor']:>25.2f} | {res_atr['profit_factor']:>20.2f}")
        print(f"{'Total Executions':<25} | {res_static['total_trades']:>25} | {res_atr['total_trades']:>20}")
        print("="*75)
        
        min_trades = min(res_static['total_trades'], res_atr['total_trades'])
        
        if min_trades < 15:
            print(f">>> VERDICT: INCONCLUSIVE (Trade count {min_trades} < 15 threshold)")
        else:
            if r_type in ["Bear", "Chop"]:
                usable_bear_chop_count += 1
                atr_lower_dd = res_atr['max_drawdown_pct'] < res_static['max_drawdown_pct']
                atr_better_pf = res_atr['profit_factor'] >= res_static['profit_factor']
                
                if atr_lower_dd and atr_better_pf:
                    print(f">>> VERDICT: ATR SUCCESS (Lower DD & Better/Eq PF in {r_type})")
                    atr_success_count += 1
                else:
                    print(f">>> VERDICT: ATR FAILED criteria in {r_type}")
            else:
                static_better_pf = res_static['profit_factor'] >= res_atr['profit_factor']
                if static_better_pf:
                    print(f">>> VERDICT: STATIC SUCCESS (Better/Eq PF in Bull)")
                else:
                    print(f">>> VERDICT: ATR SURPRISE (ATR beat Static in Bull)")

    print("\n\n" + "#"*75)
    print(" FINAL VERDICT")
    print("#"*75)
    print(f"Total Usable Bear/Chop Regimes (>15 trades): {usable_bear_chop_count}")
    print(f"Regimes where ATR beat Static in Bear/Chop: {atr_success_count}")
    if usable_bear_chop_count > 0:
        if atr_success_count >= 2 and atr_success_count >= (usable_bear_chop_count * 0.66):
            print(">>> META-REGIME HYPOTHESIS VALIDATED: ATR is demonstrably safer in Bear/Chop")
        else:
            print(">>> META-REGIME HYPOTHESIS REJECTED: ATR failed strict threshold criteria")
    else:
        print(">>> META-REGIME HYPOTHESIS INCONCLUSIVE: Not enough valid bear/chop regimes")

if __name__ == "__main__":
    asyncio.run(main())
