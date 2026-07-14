import hmac
import hashlib
import json
import time
import os
import httpx
from loguru import logger

class CoinDCXClient:
    def __init__(self):
        self.api_key = os.getenv('COINDCX_API_KEY')
        self.api_secret = os.getenv('COINDCX_API_SECRET')
        self.base_url = "https://api.coindcx.com"

    def _generate_headers(self, body):
        secret_bytes = bytes(self.api_secret, encoding='utf8')
        json_body = json.dumps(body, separators=(',', ':'))
        signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()
        
        return {
            'X-AUTH-APIKEY': self.api_key,
            'X-AUTH-SIGNATURE': signature,
            'Content-Type': 'application/json'
        }

    async def get_balances(self):
        if not self.api_key or not self.api_secret:
            logger.error("CoinDCX API keys missing in .env")
            return []
            
        body = {"timestamp": int(round(time.time() * 1000))}
        headers = self._generate_headers(body)
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(f"{self.base_url}/exchange/v1/users/balances", json=body, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                else:
                    logger.error(f"Failed to fetch balances: {resp.text}")
                    return []
            except Exception as e:
                logger.error(f"Error fetching balances: {e}")
                return []

    async def place_order(self, symbol: str, side: str, amount: float, price: float, order_type: str = "market"):
        if not self.api_key or not self.api_secret:
            logger.error("CoinDCX API keys missing in .env")
            return None
            
        # Format symbol for CoinDCX e.g. BTC/USDT -> BTCUSDT
        market = symbol.replace("/", "")
        
        body = {
            "side": side.lower(),
            "order_type": order_type.lower(),
            "market": market,
            "total_quantity": amount,
            "timestamp": int(round(time.time() * 1000))
        }
        if order_type.lower() == "limit":
            body["price_per_unit"] = price
            
        headers = self._generate_headers(body)
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(f"{self.base_url}/exchange/v1/orders/create", json=body, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                else:
                    logger.error(f"Failed to place order: {resp.text}")
                    return None
            except Exception as e:
                logger.error(f"Error placing order: {e}")
                return None
