import asyncio
import httpx
import json
from datetime import datetime, timezone
from loguru import logger
from models import TickerData
import database

class Streamer:
    def __init__(self, queue: asyncio.Queue, symbol: str = 'BTC/USDT', broadcast_cb=None):
        self.queue = queue
        self.symbol = symbol
        self.broadcast_cb = broadcast_cb
        
        self.rest_url = "https://api.coindcx.com/exchange/ticker"
        self.latency_ms = 0
        
        from collections import defaultdict
        self.price_history = defaultdict(list)
        self.market_map = {}

    async def fetch_coindcx_async(self, client: httpx.AsyncClient):
        try:
            import time
            start = time.time()
            resp = await client.get(self.rest_url)
            self.latency_ms = int((time.time() - start) * 1000)
            return resp.status_code, resp.json()
        except Exception as e:
            logger.error(f"Error connecting to CoinDCX: {e}")
            self.latency_ms = 0
            return 0, []

    async def start(self, shutdown_event: asyncio.Event):
        logger.info("Starting CoinDCX Polling Streamer with Rate-Limit Backoff...")
        
        # Start a background task for real orderbook publishing
        asyncio.create_task(self._publish_orderbooks(shutdown_event))
        
        backoff_time = 5.0
        
        async with httpx.AsyncClient(timeout=10.0, headers={'User-Agent': 'Mozilla/5.0'}) as client:
            while not shutdown_event.is_set():
                try:
                    status, markets = await self.fetch_coindcx_async(client)
                    
                    if status == 200:
                        backoff_time = 5.0
                        config = await database.get_bot_config()
                        symbols = config.get("symbols", [])
                        if isinstance(symbols, str):
                            symbols = [s.strip() for s in symbols.split(",") if s.strip()]
                        if not self.market_map:
                            try:
                                mr_resp = await client.get("https://api.coindcx.com/exchange/v1/markets_details")
                                if mr_resp.status_code == 200:
                                    mr_data = mr_resp.json()
                                    for m in mr_data:
                                        target = m.get('target_currency_short_name', '')
                                        base = m.get('base_currency_short_name', '')
                                        self.market_map[m.get("coindcx_name")] = {
                                            "symbol": f"{target}/{base}",
                                            "pair": m.get("pair")
                                        }
                            except Exception as e:
                                logger.error(f"Error fetching market details in streamer: {e}")
                                
                        target_raw_markets = {name for name, info in self.market_map.items() if info["symbol"] in symbols}
                        if not target_raw_markets:
                            target_raw_markets = {s.replace("/", "") for s in symbols}
                        
                        # Fetch dynamic FX rates from the database cache
                        usd_to_inr = await database.get_fx_rate("INR")
                        usd_to_eur = await database.get_fx_rate("EUR")

                        found_coins = []
                        for market in markets:
                            raw_symbol = market.get('market')
                            if raw_symbol in target_raw_markets:
                                if raw_symbol in self.market_map:
                                    formatted_symbol = self.market_map[raw_symbol]["symbol"]
                                else:
                                    formatted_symbol = f"{raw_symbol[:-4]}/{raw_symbol[-4:]}"
                                
                                price_usd = float(market.get('last_price', 0) or 0)
                                price_inr = price_usd * usd_to_inr
                                price_eur = price_usd * usd_to_eur
                                price_change_percent = float(market.get('change_24_hour', 0) or 0)
                                
                                self.price_history[formatted_symbol].append(price_usd)
                                self.price_history[formatted_symbol] = self.price_history[formatted_symbol][-24:]
                                
                                ticker_data = TickerData(
                                    symbol=formatted_symbol,
                                    price_usd=price_usd,
                                    price_inr=price_inr,
                                    price_eur=price_eur,
                                    price_change_percent=price_change_percent,
                                    sparkline=self.price_history[formatted_symbol],
                                    timestamp=datetime.now(timezone.utc)
                                )
                                
                                await self.queue.put(ticker_data)
                                if self.broadcast_cb:
                                    payload = {"type": "ticker", **ticker_data.model_dump()}
                                    payload["timestamp"] = payload["timestamp"].isoformat()
                                    asyncio.create_task(self.broadcast_cb(json.dumps(payload)))
                                
                                found_coins.append(market)
                        
                        logger.debug("Successfully polled CoinDCX Top 5 prices.")
                        self.last_coins_data = found_coins
                    elif status == 429:
                        backoff_time = min(backoff_time * 2, 60.0)
                        logger.warning(f"CoinDCX rate limit hit (429). Backing off for {backoff_time}s...")
                    else:
                        backoff_time = min(backoff_time * 2, 60.0)
                        logger.warning(f"CoinDCX API returned status {status}. Backing off for {backoff_time}s...")
                except Exception as fetch_e:
                    backoff_time = min(backoff_time * 2, 60.0)
                    logger.error(f"CoinDCX API fetch error: {fetch_e}. Backing off for {backoff_time}s...")
                
                try:
                    await asyncio.wait_for(shutdown_event.wait(), timeout=backoff_time)
                except asyncio.TimeoutError:
                    pass
                    
        logger.info("Streamer stopped gracefully.")

    async def _publish_orderbooks(self, shutdown_event: asyncio.Event):
        async with httpx.AsyncClient(timeout=10.0, headers={'User-Agent': 'Mozilla/5.0'}) as client:
            while not shutdown_event.is_set():
                if hasattr(self, 'last_coins_data') and self.last_coins_data and self.broadcast_cb:
                    for market in self.last_coins_data:
                        raw_symbol = market.get('market')
                        if raw_symbol in getattr(self, 'market_map', {}):
                            formatted_symbol = self.market_map[raw_symbol]["symbol"]
                            orderbook_pair = self.market_map[raw_symbol]["pair"]
                        else:
                            formatted_symbol = f"{raw_symbol[:-4]}/{raw_symbol[-4:]}"
                            base = raw_symbol[:-4]
                            quote = raw_symbol[-4:]
                            orderbook_pair = f"B-{base}_{quote}"
                        
                        try:
                            # Fetch real orderbook
                            r = await client.get(f"https://public.coindcx.com/market_data/orderbook?pair={orderbook_pair}")
                            if r.status_code == 200:
                                data = r.json()
                                
                                # Convert {"price": "qty"} dict to list of [price, qty] floats
                                bids = [[float(k), float(v)] for k, v in data.get('bids', {}).items()]
                                asks = [[float(k), float(v)] for k, v in data.get('asks', {}).items()]
                                
                                # Sort bids descending, asks ascending and take top 20
                                bids = sorted(bids, key=lambda x: x[0], reverse=True)[:20]
                                asks = sorted(asks, key=lambda x: x[0])[:20]
                                
                                payload = {
                                    "type": "orderbook",
                                    "symbol": formatted_symbol,
                                    "bids": bids,
                                    "asks": asks
                                }
                                asyncio.create_task(self.broadcast_cb(json.dumps(payload)))
                            elif r.status_code == 429:
                                await asyncio.sleep(10) # backoff orderbook
                        except Exception as e:
                            logger.error(f"Error fetching real orderbook for {formatted_symbol}: {e}")
                
                try:
                    await asyncio.wait_for(shutdown_event.wait(), timeout=3.0)
                except asyncio.TimeoutError:
                    pass
