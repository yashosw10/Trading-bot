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
        self.top_5_markets = {'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'}
        
        from collections import defaultdict
        self.price_history = defaultdict(list)

    async def fetch_coindcx_async(self, client: httpx.AsyncClient):
        try:
            resp = await client.get(self.rest_url)
            return resp.status_code, resp.json()
        except Exception as e:
            logger.error(f"Error connecting to CoinDCX: {e}")
            return 0, []

    async def start(self, shutdown_event: asyncio.Event):
        logger.info("Starting CoinDCX Polling Streamer with Rate-Limit Backoff...")
        
        # Start a background task for real orderbook publishing
        asyncio.create_task(self._publish_orderbooks(shutdown_event))
        
        async with httpx.AsyncClient(timeout=10.0, headers={'User-Agent': 'Mozilla/5.0'}) as client:
            while not shutdown_event.is_set():
                try:
                    status, markets = await self.fetch_coindcx_async(client)
                    
                    if status == 200:
                        # Fetch dynamic FX rates from the database cache
                        usd_to_inr = await database.get_fx_rate("INR")
                        usd_to_eur = await database.get_fx_rate("EUR")

                        found_coins = []
                        for market in markets:
                            if market.get('market') in self.top_5_markets:
                                raw_symbol = market.get('market')
                                formatted_symbol = f"{raw_symbol[:-4]}/{raw_symbol[-4:]}" # e.g. BTC/USDT
                                
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
                        logger.warning("CoinDCX rate limit hit (429). Pausing for 30 seconds...")
                        await asyncio.sleep(30)
                    else:
                        logger.warning(f"CoinDCX API returned status {status}")
                except Exception as fetch_e:
                    logger.error(f"CoinDCX API fetch error: {fetch_e}")
                
                # Wait 5 seconds before polling again to respect rate limits
                try:
                    await asyncio.wait_for(shutdown_event.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    pass
                    
        logger.info("Streamer stopped gracefully.")

    async def _publish_orderbooks(self, shutdown_event: asyncio.Event):
        async with httpx.AsyncClient(timeout=10.0, headers={'User-Agent': 'Mozilla/5.0'}) as client:
            while not shutdown_event.is_set():
                if hasattr(self, 'last_coins_data') and self.last_coins_data and self.broadcast_cb:
                    for market in self.last_coins_data:
                        raw_symbol = market.get('market')
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
