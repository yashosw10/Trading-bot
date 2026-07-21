import asyncio
from datetime import datetime, timezone
import pandas as pd
from backtest import run_backtest
from loguru import logger
import sys

# Keep standard logs, backtest uses logger heavily
# If it's too noisy we can filter later.

REGIMES = {
    "Pre-peak (Bull)": ("2025-07-01", "2025-10-14"),
    "Crash": ("2025-10-14", "2025-12-31"),
    "Chop / Distribution": ("2026-01-01", "2026-05-31"),
    "Full Year": ("2025-07-01", "2026-05-31")
}

SYMBOLS = ["BINANCE:BTC/USDT", "BINANCE:ETH/USDT"]

def dt_to_ms(dt_str: str) -> int:
    dt = datetime.strptime(dt_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)

VARIANTS = {
    "1. Macro Grid (3.0%)": {
        "grid_tight": 0.030,
        "grid_wide": 0.050,
        "time_stop_hours": 72.0,
        "per_trade_stop_pct": 0.08,
        "rsi_entry_gate": 48,
        "volume_multiplier": 1.35,
        "max_dca_layers": 4
    },
    "2. Huge Grid (4.0%)": {
        "grid_tight": 0.040,
        "grid_wide": 0.060,
        "time_stop_hours": 72.0,
        "per_trade_stop_pct": 0.08,
        "rsi_entry_gate": 48,
        "volume_multiplier": 1.35,
        "max_dca_layers": 4
    },
    "3. Macro + RSI 40": {
        "grid_tight": 0.030,
        "grid_wide": 0.050,
        "time_stop_hours": 72.0,
        "per_trade_stop_pct": 0.08,
        "rsi_entry_gate": 40,
        "volume_multiplier": 1.35,
        "max_dca_layers": 4
    },
    "4. Macro + Flat DCA": {
        "grid_tight": 0.030,
        "grid_wide": 0.050,
        "time_stop_hours": 72.0,
        "per_trade_stop_pct": 0.08,
        "rsi_entry_gate": 48,
        "volume_multiplier": 1.0,
        "max_dca_layers": 4
    }
}

async def main():
    print("=== Walk-Forward Validation (Ablation Study) ===")
    
    results = []
    pnl_results = []
    
    for symbol in SYMBOLS:
        for regime_name, (start_dt, end_dt) in REGIMES.items():
            start_ms = dt_to_ms(start_dt)
            end_ms = dt_to_ms(end_dt)
            
            for variant_name, config in VARIANTS.items():
                print(f"\n-> Running {symbol} | {regime_name} | {variant_name}...")
                res = await run_backtest(symbol, "1m", config=config, start_time_ms=start_ms, end_time_ms=end_ms)
                if res:
                    results.append({
                        "Symbol": symbol.replace("BINANCE:", ""),
                        "Regime": regime_name,
                        "Variant": variant_name,
                        "Return %": res["total_return_pct"],
                        "Max DD %": res["max_drawdown_pct"],
                        "Win Rate": res["win_rate"],
                        "Profit Factor": res["profit_factor"],
                        "Trades": res["total_trades"],
                        "Full Cycles": res["full_position_cycles"],
                        "Avg Hold (h)": res["avg_trade_duration_hours"]
                    })
                    
                    pnl_row = {
                        "Symbol": symbol.replace("BINANCE:", ""),
                        "Regime": regime_name,
                        "Variant": variant_name,
                        **res.get("pnl_by_label", {})
                    }
                    pnl_results.append(pnl_row)
                else:
                    print(f"Failed to get results for {symbol} - {regime_name} - {variant_name}")

    if results:
        df = pd.DataFrame(results)
        print("\n" + "="*95)
        print(" Walk-Forward Ablation Results:")
        print("="*95)
        df['Regime_Sort'] = df['Regime'].map({
            "Pre-peak (Bull)": 1, "Crash": 2, "Chop / Distribution": 3, "Full Year": 4
        })
        df = df.sort_values(by=["Symbol", "Regime_Sort", "Variant"]).drop(columns=["Regime_Sort"])
        print(df.to_string(index=False))
        print("="*95)
        print("Note: Unclosed positions at regime boundaries are force-closed ('END-OF-BACKTEST').")
        
        # Print PnL breakdown
        print("\n" + "="*125)
        print(" PnL Breakdown by Exit Reason (USD):")
        print("="*125)
        df_pnl = pd.DataFrame(pnl_results)
        df_pnl['Regime_Sort'] = df_pnl['Regime'].map({
            "Pre-peak (Bull)": 1, "Crash": 2, "Chop / Distribution": 3, "Full Year": 4
        })
        df_pnl = df_pnl.sort_values(by=["Symbol", "Regime_Sort", "Variant"]).drop(columns=["Regime_Sort"])
        
        df_pnl = df_pnl.fillna(0.0)
        ordered_cols = ["Symbol", "Regime", "Variant"]
        for col in ["TP1-40pct", "TP2-35pct", "TP3-trailing", "STOP-LOSS", "TIME-STOP", "END-OF-BACKTEST"]:
            if col in df_pnl.columns:
                ordered_cols.append(col)
                
        for col in df_pnl.columns:
            if col not in ordered_cols:
                ordered_cols.append(col)
                
        df_pnl = df_pnl[ordered_cols]
        print(df_pnl.to_string(index=False))
        print("="*125)

if __name__ == "__main__":
    asyncio.run(main())
