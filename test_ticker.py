import httpx
import asyncio
import json

async def fetch():
    async with httpx.AsyncClient() as client:
        resp = await client.get('https://api.coindcx.com/exchange/ticker')
        data = resp.json()
        print(json.dumps(data[:3], indent=2))
        
        for m in data:
            if m.get('market') in ['BTCUSDT', 'B-BTC_USDT']:
                print("FOUND BTCUSDT market:", json.dumps(m, indent=2))
                
asyncio.run(fetch())
