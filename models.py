from datetime import datetime
from pydantic import BaseModel

class TickerData(BaseModel):
    symbol: str
    price_usd: float
    price_inr: float
    price_eur: float
    price_change_percent: float = 0.0
    timestamp: datetime

class TradeSignal(BaseModel):
    symbol: str
    side: str  # 'buy' or 'sell'
    fiat_currency: str  # 'USD', 'INR', or 'EUR'
    amount: float  # Quantity of crypto to buy/sell
