import asyncio
import database
from backtest import run_backtest

async def main():
    print("Initializing database...")
    await database.init_db()
    
    config = await database.get_bot_config()
    symbol = "BTC/USDT"
    interval = "1m"
    limit = 50000
    
    print(f"Running backtest for {symbol} ({interval}, last {limit} candles)...")
    result = await run_backtest(symbol, interval, limit, config)
    
    if result:
        success = await database.insert_backtest_result(result)
        if success:
            print("\n[SUCCESS] Backtest completed and saved successfully!")
            print("-> You can now refresh your Performance dashboard in the browser to view the results.")
        else:
            print("\n[ERROR] Backtest completed but failed to save to the database.")
    else:
        print("\n[ERROR] Backtest failed. Make sure you have downloaded historical data first.")

if __name__ == "__main__":
    asyncio.run(main())
