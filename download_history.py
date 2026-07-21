import asyncio
import httpx
import sqlite3
import time
from datetime import datetime, timedelta
from loguru import logger

DB_FILE = "history.db"
# (interval, lookback_days)
INTERVALS_TO_FETCH = [
    ("1m", 90),   # 3 months of 1-minute data
    ("1h", 365)   # 1 year of 1-hour data
]

SYMBOLS = ["BTC/USDT", "ETH/USDT"]  # Add more symbols as needed


def setup_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candles (
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
    """)
    conn.commit()
    return conn


async def fetch_candles_with_retry(client, market, interval, end_time, max_retries=5):
    url = "https://public.coindcx.com/market_data/candles"
    params = {
        "pair": market,
        "interval": interval,
        "endTime": end_time,
        "limit": 1000  # Max limit
    }

    for attempt in range(max_retries):
        try:
            resp = await client.get(url, params=params, timeout=10.0)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                wait_time = 2 ** attempt
                logger.warning(f"Rate limited (429). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            elif resp.status_code >= 500:
                wait_time = 2 ** attempt
                logger.warning(f"Server error ({resp.status_code}). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Unexpected status code {resp.status_code}: {resp.text}")
                return None
        except httpx.RequestError as e:
            wait_time = 2 ** attempt
            logger.error(f"Request error: {e}. Retrying in {wait_time}s...")
            await asyncio.sleep(wait_time)

    logger.error(f"Exhausted retries for {market} {interval} ending {end_time}")
    return None


async def download_history_for_symbol(client, conn, symbol, interval, lookback_days):
    market = f"B-{symbol.replace('/', '_')}"

    end_time_ms = int(time.time() * 1000)
    start_time_ms = int((datetime.now() - timedelta(days=lookback_days)).timestamp() * 1000)

    logger.info(f"Downloading {interval} candles for {symbol} for past {lookback_days} days...")

    total_inserted = 0
    last_oldest_time = float('inf')

    while end_time_ms > start_time_ms:
        candles = await fetch_candles_with_retry(client, market, interval, end_time_ms)

        if not candles:
            logger.warning(
                f"Stopping download for {symbol} {interval} due to fetch failure. "
                f"Progress so far ({total_inserted} rows) has already been committed to {DB_FILE}."
            )
            break

        if len(candles) == 0:
            logger.info(f"No more data available from exchange for {symbol} {interval}.")
            break

        records = []
        oldest_time_in_batch = end_time_ms
        for c in candles:
            t = c.get("time")
            records.append((
                symbol, interval, t,
                c.get("open"), c.get("high"), c.get("low"), c.get("close"), c.get("volume")
            ))
            if t < oldest_time_in_batch:
                oldest_time_in_batch = t

        if oldest_time_in_batch >= last_oldest_time:
            logger.error(
                f"STALL DETECTED for {symbol} {interval}: oldest time in batch "
                f"({oldest_time_in_batch}) did not decrease from previous fetch. "
                "The API is ignoring pagination parameters. Breaking loop to prevent rate-limit bans."
            )
            break
        last_oldest_time = oldest_time_in_batch

        # cursor.rowcount is unreliable with "ON CONFLICT DO NOTHING" in the
        # sqlite3 module (varies by version/driver), so measure the real
        # delta in total DB row changes instead.
        changes_before = conn.total_changes
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO candles (symbol, interval, timestamp, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol, interval, timestamp) DO NOTHING
        """, records)
        conn.commit()
        inserted = conn.total_changes - changes_before
        total_inserted += inserted

        logger.info(
            f"Fetched {len(candles)} candles. Inserted {inserted} new records. "
            f"Oldest in batch: {datetime.fromtimestamp(oldest_time_in_batch / 1000)}."
        )

        # CoinDCX limit check: if we got a small trailing batch, we've likely
        # hit the earliest available data for this pair.
        if len(candles) < 10:
            logger.info(f"Reached end of available data for {symbol} {interval}.")
            break

        end_time_ms = oldest_time_in_batch - 1

        # Respect rate limits even on successes
        await asyncio.sleep(0.2)

    logger.info(f"Finished {symbol} {interval}. Total new rows inserted: {total_inserted}")


def check_gaps(conn, symbol, interval):
    logger.info(f"Running gap analysis for {symbol} {interval}...")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp FROM candles
        WHERE symbol = ? AND interval = ?
        ORDER BY timestamp ASC
    """, (symbol, interval))

    rows = cursor.fetchall()
    if not rows:
        logger.info(f"No data to check for {symbol} {interval}.")
        return

    # dynamic gap detection based on interval
    unit = interval[-1]
    value = int(interval[:-1])
    if unit == 'm':
        expected_gap_ms = value * 60 * 1000
    elif unit == 'h':
        expected_gap_ms = value * 60 * 60 * 1000
    elif unit == 'd':
        expected_gap_ms = value * 24 * 60 * 60 * 1000
    else:
        expected_gap_ms = 60 * 1000 # default fallback

    gaps_found = 0
    prev_time = rows[0][0]

    for i in range(1, len(rows)):
        curr_time = rows[i][0]
        diff = curr_time - prev_time
        if diff > expected_gap_ms:
            missed_candles = diff // expected_gap_ms - 1
            if missed_candles > 3:
                start_gap = datetime.fromtimestamp(prev_time / 1000)
                end_gap = datetime.fromtimestamp(curr_time / 1000)
                logger.warning(
                    f"GAP DETECTED: {symbol} {interval} missing ~{missed_candles} candles "
                    f"between {start_gap} and {end_gap} "
                    f"(could be exchange downtime OR a missed request — verify manually)"
                )
                gaps_found += 1
        prev_time = curr_time

    if gaps_found == 0:
        logger.info(f"Data integrity excellent for {symbol} {interval}. No significant gaps found.")
    else:
        logger.warning(f"Found {gaps_found} gap periods for {symbol} {interval}. Please review.")


async def main():
    conn = setup_db()

    async with httpx.AsyncClient(timeout=15.0) as client:
        for symbol in SYMBOLS:
            for interval, lookback_days in INTERVALS_TO_FETCH:
                await download_history_for_symbol(client, conn, symbol, interval, lookback_days)
                check_gaps(conn, symbol, interval)

    conn.close()
    logger.info("Historical download complete.")


if __name__ == "__main__":
    asyncio.run(main())
