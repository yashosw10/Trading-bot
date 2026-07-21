import sqlite3
import pandas as pd
from datetime import datetime

conn = sqlite3.connect('history.db')

# Get daily closes (taking the last candle of each day)
query = """
SELECT date(timestamp/1000, 'unixepoch') AS day, close
FROM candles
WHERE symbol = 'BINANCE:BTC/USDT' AND interval = '1h'
  AND time(timestamp/1000, 'unixepoch') = '23:00:00'
ORDER BY day;
"""
df = pd.read_sql_query(query, conn)

# Let's find the absolute max and min to identify regimes
ath_row = df.loc[df['close'].idxmax()]
print(f"ATH: {ath_row['day']} at {ath_row['close']}")

# Let's print out the close price on the 1st and 15th of every month to see the macro trend
monthly_df = df[df['day'].str.endswith('-01') | df['day'].str.endswith('-15')]
print("\nMacro Trend (1st and 15th of every month):")
print(monthly_df.to_string(index=False))

