import asyncio
import httpx

async def test_macro():
    async with httpx.AsyncClient() as client:
        symbols = ["BTC/USDT", "ETH/USDT"]
        for interval in ["1d", "1w", "1W", "1M"]:
            print(f"Fetching BTC/USDT with interval {interval}...")
            res = await client.get(
                "https://public.coindcx.com/market_data/candles",
                params={"pair": "B-BTC_USDT", "interval": interval, "limit": 2},
                timeout=5.0
            )
            print("Status:", res.status_code)
            if res.status_code == 200:
                data = res.json()
                print("Data length:", len(data))
                if len(data) > 0:
                    print("First candle:", data[0])
            else:
                print(res.text)

asyncio.run(test_macro())
