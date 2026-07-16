import httpx
import asyncio
import json

async def fetch():
    async with httpx.AsyncClient() as client:
        resp = await client.get('https://api.coindcx.com/exchange/v1/markets_details')
        data = resp.json()
        
        # Look for BTC and USDT pair
        for m in data:
            if m.get('base_currency_short_name') == 'BTC' and m.get('target_currency_short_name') == 'USDT':
                print(json.dumps(m, indent=2))
                
asyncio.run(fetch())
