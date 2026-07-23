import os
import requests
import zipfile
import pandas as pd
import sqlite3
from loguru import logger

def download_luna():
    symbol = "LUNAUSDT"
    month = "2022-05"
    url = f"https://data.binance.vision/data/spot/monthly/klines/{symbol}/1m/{symbol}-1m-{month}.zip"
    zip_path = f"{symbol}-1m-{month}.zip"
    
    if not os.path.exists(zip_path):
        logger.info(f"Downloading {symbol} data for {month}...")
        resp = requests.get(url, stream=True)
        if resp.status_code != 200:
            logger.error(f"Failed to download {url}")
            return
        with open(zip_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                
    csv_path = zip_path.replace('.zip', '.csv')
    if not os.path.exists(csv_path):
        logger.info(f"Extracting {zip_path}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall()

    logger.info(f"Loading {csv_path} into SQLite...")
    columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'close_time', 
               'quote_asset_volume', 'number_of_trades', 'taker_buy_base_asset_volume', 
               'taker_buy_quote_asset_volume', 'ignore']
    df = pd.read_csv(csv_path, names=columns)
    
    conn = sqlite3.connect('multi_year_history.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS candles (
                    symbol TEXT,
                    interval TEXT,
                    timestamp INTEGER,
                    open REAL,
                    high REAL,
                    low REAL,
                    close REAL,
                    volume REAL,
                    PRIMARY KEY (symbol, interval, timestamp)
                )''')
    
    records = []
    for _, row in df.iterrows():
        records.append(("BINANCE:LUNA/USDT", "1m", int(row['timestamp']), float(row['open']), float(row['high']), float(row['low']), float(row['close']), float(row['volume'])))
    
    c.executemany('''INSERT OR IGNORE INTO candles 
                     (symbol, interval, timestamp, open, high, low, close, volume) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', records)
    conn.commit()
    conn.close()
    
    logger.info(f"Inserted {len(records)} candles for BINANCE:LUNA/USDT")

if __name__ == "__main__":
    download_luna()
