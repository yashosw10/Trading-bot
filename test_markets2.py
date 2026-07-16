import httpx
import asyncio
import json

async def fetch():
    async with httpx.AsyncClient() as client:
        resp = await client.get('https://api.coindcx.com/exchange/v1/markets_details')
        data = resp.json()
        print(json.dumps(data[:3], indent=2))
                
asyncio.run(fetch())
