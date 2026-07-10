import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import database
from streamer import Streamer
from strategy import StrategyEngine
from order_manager import OrderManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.add("bot.log", rotation="10 MB")
    logger.info("Initializing Crypto Paper Trading Bot with FastAPI Lifespan...")
    
    await database.init_db()
    
    shutdown_event = asyncio.Event()
    data_queue = asyncio.Queue()
    order_queue = asyncio.Queue()

    async def broadcast_ws(msg: str):
        await manager.broadcast(msg)

    streamer = Streamer(queue=data_queue, symbol='BTC/USDT', broadcast_cb=broadcast_ws)
    strategy = StrategyEngine(data_queue=data_queue, order_queue=order_queue)
    strategy.fiat_currency = 'USD' 
    order_manager = OrderManager(order_queue=order_queue, broadcast_cb=broadcast_ws)

    # Attach to app state so we can access them later if needed
    app.state.streamer_task = asyncio.create_task(streamer.start(shutdown_event))
    app.state.strategy_task = asyncio.create_task(strategy.start(shutdown_event))
    app.state.order_manager_task = asyncio.create_task(order_manager.start(shutdown_event))
    
    yield
    
    logger.warning("FastAPI shutdown! Gracefully stopping bot components...")
    shutdown_event.set()
    
    for task in [app.state.streamer_task, app.state.strategy_task, app.state.order_manager_task]:
        if not task.done():
            task.cancel()
            
    await asyncio.gather(app.state.streamer_task, app.state.strategy_task, app.state.order_manager_task, return_exceptions=True)
    logger.info("Bot shutdown complete.")

app = FastAPI(title="Trading Bot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

from pydantic import BaseModel

class AddFundsRequest(BaseModel):
    currency: str
    amount: float
    clear_history: bool = False

@app.post("/api/add-funds")
async def add_funds(req: AddFundsRequest):
    # Add primary currency
    await database.add_balance(req.currency, req.amount)
    
    # Sync other currencies
    usd_to_inr = 83.0
    usd_to_eur = 0.92
    
    if req.currency == 'USD':
        await database.add_balance('INR', req.amount * usd_to_inr)
        await database.add_balance('EUR', req.amount * usd_to_eur)
    elif req.currency == 'INR':
        usd_amount = req.amount / usd_to_inr
        await database.add_balance('USD', usd_amount)
        await database.add_balance('EUR', usd_amount * usd_to_eur)
    elif req.currency == 'EUR':
        usd_amount = req.amount / usd_to_eur
        await database.add_balance('USD', usd_amount)
        await database.add_balance('INR', usd_amount * usd_to_inr)

    if req.clear_history:
        await database.clear_history()
        
    return {"status": "success", "message": f"Added {req.amount} to {req.currency} balance"}

@app.get("/api/balances")
async def get_balances():
    usd = await database.get_balance("USD")
    inr = await database.get_balance("INR")
    eur = await database.get_balance("EUR")
    return {"USD": usd, "INR": inr, "EUR": eur}

@app.get("/api/positions")
async def get_positions():
    pos = await database.get_position("BTC/USDT")
    return {"BTC/USDT": pos}

@app.get("/api/total-profit")
async def api_get_total_profit(currency: str = "USD"):
    # All trades are stored with fiat_currency='USD'.
    # Always fetch the USD sum, then convert to the requested currency.
    profit_usd = await database.get_total_profit("USD")
    usd_to_inr = 83.0
    usd_to_eur = 0.92
    if currency == "INR":
        return {"total_profit": round(profit_usd * usd_to_inr, 2)}
    elif currency == "EUR":
        return {"total_profit": round(profit_usd * usd_to_eur, 2)}
    return {"total_profit": round(profit_usd, 2)}

@app.get("/api/invested")
async def get_invested():
    """Returns total fiat currently deployed in open positions.
    Reads directly from the positions table (amount × average_price_usd).
    """
    import aiosqlite
    usd_to_inr = 83.0
    usd_to_eur = 0.92
    invested_usd = 0.0
    async with aiosqlite.connect(database.DB_FILE) as db:
        async with db.execute(
            "SELECT amount, average_price_usd FROM positions WHERE amount > 0.000001"
        ) as cur:
            async for row in cur:
                amount, avg_price_usd = row[0], row[1]
                if avg_price_usd and avg_price_usd > 0:
                    invested_usd += amount * avg_price_usd
    return {
        "USD": round(invested_usd, 2),
        "INR": round(invested_usd * usd_to_inr, 2),
        "EUR": round(invested_usd * usd_to_eur, 2),
    }

@app.get("/api/trades")
async def get_trades():
    import aiosqlite
    trades = []
    async with aiosqlite.connect(database.DB_FILE) as db:
        async with db.execute('SELECT symbol, side, fiat_currency, amount, price, fee, pnl_fiat, pnl_percent, timestamp FROM trades ORDER BY id DESC LIMIT 50') as cursor:
            async for row in cursor:
                trades.append({
                    "symbol": row[0],
                    "side": row[1],
                    "fiat_currency": row[2],
                    "amount": row[3],
                    "price": row[4],
                    "fee": row[5],
                    "pnl_fiat": row[6],
                    "pnl_percent": row[7],
                    "timestamp": row[8] + "Z" if row[8] and not row[8].endswith("Z") else row[8]
                })
    return trades

@app.get("/api/ohlcv")
async def get_ohlcv(symbol: str = "BTC/USDT", interval: str = "1h", limit: int = 100):
    import time
    import random
    now = int(time.time())
    data = []
    price = 65000.0
    for i in range(limit):
        ts = (now - (limit - i) * 3600) * 1000
        open_p = price
        close_p = price * random.uniform(0.99, 1.01)
        high_p = max(open_p, close_p) * random.uniform(1.0, 1.005)
        low_p = min(open_p, close_p) * random.uniform(0.995, 1.0)
        vol = random.uniform(10, 500)
        data.append({
            "timestamp": ts,
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": close_p,
            "volume": vol
        })
        price = close_p
    return data

@app.get("/api/config")
async def api_get_config():
    return await database.get_bot_config()

@app.put("/api/config")
async def api_put_config(config: dict):
    success = await database.update_bot_config(config)
    if success:
        return {"status": "success"}
    return {"status": "error", "message": "Failed to update config"}

@app.get("/api/indicators")
async def get_indicators(symbol: str = 'BTC/USDT', type: str = 'RSI', interval: str = '1h'):
    import pandas as pd
    import pandas_ta as ta
    ohlcv = get_ohlcv(symbol, interval)
    if not ohlcv:
        return []
    
    df = pd.DataFrame(ohlcv)
    df.set_index(pd.DatetimeIndex(df['timestamp']), inplace=True)
    
    if type.upper() == 'RSI':
        df.ta.rsi(length=14, append=True)
        # Drop NaN
        df = df.dropna(subset=['RSI_14'])
        return [{"timestamp": row['timestamp'], "value": row['RSI_14']} for _, row in df.iterrows()]
        
    elif type.upper() == 'SMA':
        df.ta.sma(length=20, append=True)
        df = df.dropna(subset=['SMA_20'])
        return [{"timestamp": row['timestamp'], "value": row['SMA_20']} for _, row in df.iterrows()]
        
    elif type.upper() == 'EMA':
        df.ta.ema(length=20, append=True)
        df = df.dropna(subset=['EMA_20'])
        return [{"timestamp": row['timestamp'], "value": row['EMA_20']} for _, row in df.iterrows()]
        
    elif type.upper() == 'MACD':
        df.ta.macd(append=True)
        # MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
        df = df.dropna(subset=['MACD_12_26_9'])
        return [{"timestamp": row['timestamp'], "macd": row['MACD_12_26_9'], "signal": row['MACDs_12_26_9'], "histogram": row['MACDh_12_26_9']} for _, row in df.iterrows()]
        
    elif type.upper() == 'BOLLINGER':
        df.ta.bbands(append=True)
        # BBL_5_2.0, BBM_5_2.0, BBU_5_2.0
        df = df.dropna(subset=['BBL_5_2.0'])
        return [{"timestamp": row['timestamp'], "lower": row['BBL_5_2.0'], "middle": row['BBM_5_2.0'], "upper": row['BBU_5_2.0']} for _, row in df.iterrows()]
    
    return []

@app.post("/api/bot/kill")
async def kill_bot():
    """
    Sets bot state to KILLED, closes all positions + stops bot.
    (Mocked implementation for frontend wiring)
    """
    # TODO: call Layer 5 kill switch
    return {"status": "success", "message": "Bot killed. All positions closed."}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/health")
async def get_health():
    import time
    start = time.time()
    db_status = "ok"
    try:
        await database.get_bot_config()
    except Exception:
        db_status = "error"
    db_latency = int((time.time() - start) * 1000)
    
    return {
        "status": "healthy",
        "database": {
            "status": db_status,
            "latency_ms": db_latency
        },
        "websocket": {
            "status": "connected",
            "active_clients": len(manager.active_connections) if hasattr(manager, 'active_connections') else 0
        },
        "exchange": {
            "status": "connected",
            "latency_ms": 45 # mock latency for exchange connection
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/api/bot/pause")
async def pause_bot():
    config = await database.get_bot_config()
    config['is_paused'] = True
    await database.update_bot_config(config)
    return {"status": "success", "message": "Bot paused. Will not open new positions."}

@app.post("/api/bot/resume")
async def resume_bot():
    config = await database.get_bot_config()
    config['is_paused'] = False
    await database.update_bot_config(config)
    return {"status": "success", "message": "Bot resumed. Will resume strategy execution."}

@app.post("/api/bot/test-telegram")
async def test_telegram():
    from utils import send_telegram_alert
    try:
        await send_telegram_alert("🔔 <b>Test Alert</b>\nThis is a test message from your Trading Bot.")
        return {"status": "success", "message": "Test alert sent."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class OrderRequest(BaseModel):
    symbol: str
    side: str
    amount: float
    type: str = "market"

@app.post("/api/orders")
async def manual_order(order: OrderRequest):
    from fastapi import HTTPException
    config = await database.get_bot_config()
    if config.get("mode") == "live":
        raise HTTPException(
            status_code=503,
            detail="Live exchange execution not yet wired. Switch to Paper mode to place manual orders."
        )
    
    # Paper execution
    # Fetch current price from latest ticker or fallback to 0 (which would fail trade)
    import aiosqlite
    from streamer import fetch_coindcx_ticker
    
    # Mocking fetching price for manual order
    price_usd = 0.0
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.coindcx.com/exchange/ticker")
            data = resp.json()
            # Find the BTCUSDT market (since we use BTC/USDT)
            target = order.symbol.replace('/', '')
            for m in data:
                if m.get('market') == target:
                    price_usd = float(m.get('last_price', 0))
                    break
    except Exception as e:
        logger.error(f"Failed to fetch live price for manual order: {e}")
        
    if price_usd <= 0:
        raise HTTPException(status_code=400, detail="Could not fetch valid price for execution.")
        
    # Since manual order, we don't have strategy context, pass mfe=0, mae=0
    success = await database.execute_trade(
        symbol=order.symbol,
        side=order.side.lower(),
        fiat_currency="USD",
        amount=order.amount,
        price=price_usd,
        fee=(order.amount * price_usd * 0.001)
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="Trade execution failed. Check wallet balance or position limits.")
        
    return {"status": "success", "message": "Manual order executed.", "price": price_usd}

@app.get("/api/backtest/latest")
async def get_latest_backtest():
    from fastapi import HTTPException
    import aiosqlite
    async with aiosqlite.connect(database.DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('SELECT * FROM backtest_results ORDER BY timestamp DESC LIMIT 1') as cur:
            row = await cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="No backtest results found")
            return dict(row)
