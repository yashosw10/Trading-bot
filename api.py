import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import database

app = FastAPI(title="Trading Bot API")

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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
