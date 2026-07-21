import asyncio
import httpx
import sqlite3
import time
import zipfile
import io
import csv
from datetime import datetime, timedelta, timezone
import calendar
from loguru import logger

from download_history import setup_db, DB_FILE, check_gaps

INTERVALS_TO_FETCH = [
    ("1m", 90),
    ("1h", 365)
]

SYMBOLS = ["BTC/USDT", "ETH/USDT"]

BINANCE_SYMBOL_MAP = {
    "BTC/USDT": "BTCUSDT",
    "ETH/USDT": "ETHUSDT"
}

VISION_BASE_URL = "https://data.binance.vision/data/spot/monthly/klines"
REST_BASE_URL = "https://api.binance.com/api/v3/klines"

async def fetch_binance_rest(client, symbol_binance, interval, start_time_ms, limit=1000, max_retries=5):
    url = REST_BASE_URL
    params = {
        "symbol": symbol_binance,
        "interval": interval,
        "startTime": start_time_ms,
        "limit": limit
    }
    
    for attempt in range(max_retries):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                logger.warning(f"Rate limited (429) on REST API. Retrying... (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(2 ** attempt)
            elif resp.status_code >= 500:
                logger.warning(f"Server error {resp.status_code}. Retrying... (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(2 ** attempt)
            else:
                logger.error(f"Unexpected status {resp.status_code}: {resp.text}")
                break
        except Exception as e:
            logger.error(f"Request failed: {e}")
            await asyncio.sleep(2 ** attempt)
            
    return None

async def download_monthly_zip(client, symbol_binance, interval, year, month):
    month_str = f"{month:02d}"
    zip_name = f"{symbol_binance}-{interval}-{year}-{month_str}.zip"
    csv_name = f"{symbol_binance}-{interval}-{year}-{month_str}.csv"
    url = f"{VISION_BASE_URL}/{symbol_binance}/{interval}/{zip_name}"
    
    try:
        resp = await client.get(url)
        if resp.status_code == 404:
            return None # Expected if archive not yet published
        resp.raise_for_status()
        
        # Unzip in memory
        with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
            with z.open(csv_name) as f:
                content = f.read().decode('utf-8')
                return content
    except Exception as e:
        logger.error(f"Failed to fetch/parse ZIP for {year}-{month_str}: {e}")
        return None

def normalize_timestamp(t_val):
    try:
        t = int(t_val)
        if t > 1e14: # likely microseconds
            t = t // 1000
        return t
    except ValueError:
        return None

async def download_binance_history_for_symbol(client, conn, symbol, interval, lookback_days):
    symbol_binance = BINANCE_SYMBOL_MAP.get(symbol)
    if not symbol_binance:
        logger.error(f"No binance mapping for {symbol}")
        return
        
    namespaced_symbol = f"BINANCE:{symbol}"
    
    start_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    end_dt = datetime.now(timezone.utc)
    
    logger.info(f"Downloading {interval} Binance candles for {symbol} for past {lookback_days} days...")
    
    current_year = start_dt.year
    current_month = start_dt.month
    
    # Calculate target completed month
    # We define the last completed month as the month before the current month
    last_completed_dt = end_dt.replace(day=1) - timedelta(days=1)
    
    total_inserted = 0
    
    gap_start_dt = start_dt
    
    # Phase 1: Monthly Archives
    while True:
        if current_year > last_completed_dt.year or (current_year == last_completed_dt.year and current_month > last_completed_dt.month):
            break
            
        logger.info(f"Fetching monthly archive {current_year}-{current_month:02d} for {symbol}...")
        csv_content = await download_monthly_zip(client, symbol_binance, interval, current_year, current_month)
        
        if not csv_content:
            logger.warning(f"Archive {current_year}-{current_month:02d} not found. Falling back to REST for this month onwards.")
            # gap_start_dt remains at the start of this missing month, breaking out to phase 2
            break
            
        # Parse CSV
        reader = csv.reader(csv_content.splitlines())
        records = []
        for i, row in enumerate(reader):
            if not row: continue
            
            t = normalize_timestamp(row[0])
            if t is None:
                # Likely a header row
                if i == 0:
                    continue
                else:
                    logger.error(f"Invalid timestamp format in row {i}: {row[0]}")
                    continue
                    
            records.append((
                namespaced_symbol, interval, t,
                float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])
            ))
            
        if records:
            changes_before = conn.total_changes
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT INTO candles (symbol, interval, timestamp, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, interval, timestamp) DO NOTHING
            """, records)
            conn.commit()
            total_inserted += (conn.total_changes - changes_before)
            
        # Advance month
        gap_start_dt = gap_start_dt.replace(year=current_year, month=current_month, day=1)
        _, days_in_month = calendar.monthrange(current_year, current_month)
        gap_start_dt = gap_start_dt + timedelta(days=days_in_month)
        
        current_month += 1
        if current_month > 12:
            current_month = 1
            current_year += 1
            
        # Avoid hammering Binance Vision too fast just to be polite
        await asyncio.sleep(0.5)

    # Phase 2: REST API Gap Fill
    logger.info(f"Phase 1 complete for {symbol}. Fetched {total_inserted} rows via bulk archives.")
    
    # Adjust start_time_ms to gap_start_dt
    start_time_ms = int(gap_start_dt.timestamp() * 1000)
    end_time_ms = int(end_dt.timestamp() * 1000)
    
    logger.info(f"Phase 2: Filling gap from {gap_start_dt.strftime('%Y-%m-%d')} via REST API...")
    
    last_newest_time = -1
    rest_inserted = 0
    
    while start_time_ms < end_time_ms:
        candles = await fetch_binance_rest(client, symbol_binance, interval, start_time_ms)
        
        if not candles:
            logger.warning(f"Stopping REST fetch for {symbol} due to failure.")
            break
            
        if len(candles) == 0:
            logger.info("No more data from REST API.")
            break
            
        records = []
        newest_time_in_batch = -1
        
        for c in candles:
            t = normalize_timestamp(c[0])
            if t is None:
                continue
            records.append((
                namespaced_symbol, interval, t,
                float(c[1]), float(c[2]), float(c[3]), float(c[4]), float(c[5])
            ))
            if t > newest_time_in_batch:
                newest_time_in_batch = t
                
        if newest_time_in_batch <= last_newest_time:
            logger.error(f"STALL DETECTED: newest time ({newest_time_in_batch}) did not advance. API pagination stuck. Breaking loop.")
            break
            
        last_newest_time = newest_time_in_batch
        # Advance the start_time_ms for the next fetch to be exactly after the newest candle
        start_time_ms = newest_time_in_batch + 1
        
        changes_before = conn.total_changes
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO candles (symbol, interval, timestamp, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol, interval, timestamp) DO NOTHING
        """, records)
        conn.commit()
        rest_inserted += (conn.total_changes - changes_before)
        
        await asyncio.sleep(0.5)
        
    logger.info(f"Completed {symbol} {interval}. Total inserted: {total_inserted + rest_inserted} (Bulk: {total_inserted}, REST: {rest_inserted})")

async def main():
    logger.info("Starting Binance Historical Data Downloader...")
    conn = setup_db()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for symbol in SYMBOLS:
            for interval, lookback_days in INTERVALS_TO_FETCH:
                await download_binance_history_for_symbol(client, conn, symbol, interval, lookback_days)
                
            # Verify gaps
            for interval, _ in INTERVALS_TO_FETCH:
                check_gaps(conn, f"BINANCE:{symbol}", interval)
                
    conn.close()
    logger.info("All downloads and verifications complete.")

if __name__ == "__main__":
    asyncio.run(main())
