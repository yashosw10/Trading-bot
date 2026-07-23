import asyncio
import httpx
import sqlite3
import zipfile
import io
import csv
from datetime import datetime, timezone
from loguru import logger

DB_FILE = 'multi_year_history.db'
INTERVAL = "1m"
SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "ZEC/USDT", "BNB/USDT", "XRP/USDT"]
VISION_BASE_URL = "https://data.binance.vision/data/spot/monthly/klines"

def setup_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS klines (
            symbol TEXT,
            interval TEXT,
            timestamp INTEGER,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            PRIMARY KEY (symbol, interval, timestamp)
        )
    ''')
    conn.commit()
    return conn

async def download_monthly_zip(client, symbol_binance, year, month):
    month_str = f"{month:02d}"
    zip_name = f"{symbol_binance}-{INTERVAL}-{year}-{month_str}.zip"
    csv_name = f"{symbol_binance}-{INTERVAL}-{year}-{month_str}.csv"
    url = f"{VISION_BASE_URL}/{symbol_binance}/{INTERVAL}/{zip_name}"
    
    try:
        resp = await client.get(url)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        
        with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
            with z.open(csv_name) as f:
                return f.read().decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to fetch {zip_name}: {e}")
        return None

async def download_symbol(client, conn, symbol):
    symbol_binance = symbol.replace("/", "")
    namespaced_symbol = f"BINANCE:{symbol}"
    
    logger.info(f"Downloading 2021-2024 {INTERVAL} data for {symbol}...")
    
    missing_months = []
    
    for year in range(2021, 2025):
        for month in range(1, 13):
            csv_content = await download_monthly_zip(client, symbol_binance, year, month)
            if not csv_content:
                logger.warning(f"GAP DETECTED: No data for {symbol} in {year}-{month:02d}")
                missing_months.append(f"{year}-{month:02d}")
                continue
                
            reader = csv.reader(csv_content.splitlines())
            records = []
            for i, row in enumerate(reader):
                if not row: continue
                try:
                    t = int(row[0])
                    if t > 1e14: t = t // 1000
                    records.append((
                        namespaced_symbol, INTERVAL, t,
                        float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])
                    ))
                except ValueError:
                    continue
                    
            if records:
                c = conn.cursor()
                c.executemany(
                    "INSERT OR IGNORE INTO klines VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    records
                )
                conn.commit()
                logger.info(f"Inserted {len(records)} candles for {symbol} ({year}-{month:02d})")
                
    if missing_months:
        logger.error(f"CRITICAL DATA GAPS for {symbol}: {', '.join(missing_months)}")
    else:
        logger.info(f"{symbol} has fully contiguous data for 2021-2024.")

async def main():
    conn = setup_db()
    
    # Use limits for httpx to prevent connection drops
    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    timeout = httpx.Timeout(30.0)
    
    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        # Download sequentially to be nice to Binance API and avoid huge memory spikes
        for sym in SYMBOLS:
            await download_symbol(client, conn, sym)
            
    conn.close()
    logger.info("Multi-year data download complete.")

if __name__ == "__main__":
    asyncio.run(main())
