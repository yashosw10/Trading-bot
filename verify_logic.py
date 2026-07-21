import asyncio
import sqlite3
import os
import time
from loguru import logger
import download_history
from backtest import run_backtest

# Test 1: Gap Checker
def test_gap_checker():
    logger.info("=== Starting Test 1: Gap Checker ===")
    
    # Setup test db
    test_db = "test_history.db"
    if os.path.exists(test_db):
        os.remove(test_db)
        
    conn = sqlite3.connect(test_db)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE candles (
            symbol TEXT, interval TEXT, timestamp INTEGER,
            open REAL, high REAL, low REAL, close REAL, volume REAL,
            PRIMARY KEY (symbol, interval, timestamp)
        )
    """)
    
    # 1 minute = 60000 ms
    base_time = 1700000000000
    
    # Insert with a deliberate 5-minute gap (300000 ms) in the middle
    timestamps = [
        base_time, 
        base_time + 60000, 
        base_time + 120000, 
        base_time + 420000, # GAP! Missed 3 candles
        base_time + 480000
    ]
    
    records = []
    for t in timestamps:
        records.append(("BTC/USDT", "1m", t, 1.0, 1.0, 1.0, 1.0, 1.0))
        
    cursor.executemany("INSERT INTO candles VALUES (?,?,?,?,?,?,?,?)", records)
    conn.commit()
    
    # Run the gap checker on this test DB
    download_history.check_gaps(conn, "BTC/USDT", "1m")
    
    conn.close()
    if os.path.exists(test_db):
        os.remove(test_db)
    logger.info("=== Test 1 Complete ===\n")

# Test 2: Backtest Determinism
async def test_determinism():
    logger.info("=== Starting Test 2: Backtest Determinism ===")
    
    symbol = "BTC/USDT"
    interval = "1m"
    limit = 500
    config = {}
    
    # 1. Seed history.db with fake data for determinism test
    logger.info("Seeding history.db with fake data for determinism test...")
    if os.path.exists("history.db"):
        os.remove("history.db")
        
    conn = sqlite3.connect("history.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candles (
            symbol TEXT, interval TEXT, timestamp INTEGER,
            open REAL, high REAL, low REAL, close REAL, volume REAL,
            PRIMARY KEY (symbol, interval, timestamp)
        )
    """)
    
    # Insert 500 fake candles
    base_time = int(time.time() * 1000) - (500 * 60 * 1000)
    records = []
    price = 60000.0
    for i in range(500):
        t = base_time + (i * 60 * 1000)
        # Add some random walk so indicators compute something
        import random
        price = price + random.uniform(-100, 100)
        records.append((symbol, interval, t, price, price+50, price-50, price, 1.0))
        
    cursor.executemany("INSERT INTO candles VALUES (?,?,?,?,?,?,?,?)", records)
    conn.commit()
    conn.close()
    
    # 2. Run backtest #1
    logger.info("Running backtest #1 (from local cache)...")
    res1 = await run_backtest(symbol, interval, limit, config)
    
    # 3. Run backtest #2
    logger.info("Running backtest #2 (from local cache)...")
    res2 = await run_backtest(symbol, interval, limit, config)
    
    if res1 is None or res2 is None:
        logger.error("Backtest returned None. Ensure data was downloaded.")
        return
        
    # Check if identical
    diffs = []
    for k in res1.keys():
        if res1[k] != res2[k]:
            diffs.append(f"{k}: {res1[k]} != {res2[k]}")
            
    if not diffs:
        logger.info("SUCCESS! Both backtests produced 100% identical results on the same cached data.")
    else:
        logger.error(f"FAILURE! Determinism broken. Differences found: {diffs}")
        
    logger.info("=== Test 2 Complete ===")

if __name__ == "__main__":
    test_gap_checker()
    asyncio.run(test_determinism())
