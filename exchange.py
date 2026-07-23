import hmac
import hashlib
import json
import time
import os
import httpx
from loguru import logger

class CoinDCXClient:
    # Class-level cache to persist across ephemeral instances
    _market_details = {}
    _market_details_last_fetch = 0.0
    CACHE_TTL_SECONDS = 3600  # 1 hour

    def __init__(self):
        self.api_key = os.getenv('COINDCX_API_KEY')
        self.api_secret = os.getenv('COINDCX_API_SECRET')
        self.base_url = "https://api.coindcx.com"

    async def _fetch_market_details(self, force=False):
        now = time.time()
        if not force and CoinDCXClient._market_details and (now - CoinDCXClient._market_details_last_fetch < CoinDCXClient.CACHE_TTL_SECONDS):
            return
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"{self.base_url}/exchange/v1/markets_details")
                if resp.status_code == 200:
                    data = resp.json()
                    for m in data:
                        # Map base_target string (e.g. BTCUSDT) to its details
                        target = m.get('target_currency_short_name', '')
                        base = m.get('base_currency_short_name', '')
                        symbol = f"{target}{base}"
                        CoinDCXClient._market_details[symbol] = {
                            "coindcx_name": m.get("coindcx_name"),
                            "target_precision": m.get("target_currency_precision", 8),
                            "base_precision": m.get("base_currency_precision", 2),
                            "step": m.get("step", 0.00001),
                            "min_quantity": m.get("min_quantity", 0.0),
                            "min_notional": m.get("min_notional", 0.0)
                        }
                    CoinDCXClient._market_details_last_fetch = now
            except Exception as e:
                logger.error(f"Error fetching market details: {e}")

    async def get_min_quantity_for_symbol(self, symbol: str) -> float:
        raw_symbol = symbol.replace("/", "")
        if raw_symbol not in CoinDCXClient._market_details:
            await self._fetch_market_details(force=True)
        market_info = CoinDCXClient._market_details.get(raw_symbol)
        if market_info:
            return market_info.get("min_quantity", 0.0)
        return 0.0

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
            
        await self._fetch_market_details()
        
        raw_symbol = symbol.replace("/", "")
        
        market_info = CoinDCXClient._market_details.get(raw_symbol)
        if not market_info:
            await self._fetch_market_details(force=True)
            market_info = CoinDCXClient._market_details.get(raw_symbol)

        if market_info:
            market = market_info["coindcx_name"]
            # Round amount to target_precision (e.g. 5 decimal places)
            amount = round(amount, market_info["target_precision"])
            price = round(price, market_info["base_precision"])
            
            notional = amount * price
            min_quantity = market_info.get("min_quantity", 0.0)
            min_notional = market_info.get("min_notional", 0.0)
            
            if amount < min_quantity:
                logger.warning(f"Order rejected locally: Amount {amount} is below the exchange minimum of {min_quantity}.")
                return None
            if notional < min_notional:
                logger.warning(f"Order rejected locally: Total value {notional} is below the exchange minimum of {min_notional}. Please increase your base_order size in Settings.")
                return None
        else:
            market = raw_symbol
            amount = round(amount, 8)
            price = round(price, 2)
            
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
