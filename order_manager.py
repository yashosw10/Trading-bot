import asyncio
from loguru import logger
from models import TradeSignal, TickerData
import database
import json
from datetime import datetime, timezone

class OrderManager:
    def __init__(self, order_queue: asyncio.Queue, broadcast_cb=None):
        self.order_queue = order_queue
        self.broadcast_cb = broadcast_cb
        self.fee_rate = 0.001       # 0.1% fee
        self.slippage_rate = 0.0005 # 0.05% slippage

    async def start(self, shutdown_event: asyncio.Event):
        logger.info("Starting Order Manager...")
        while not shutdown_event.is_set():
            try:
                # Wait for trade signal
                signal, ticker = await asyncio.wait_for(self.order_queue.get(), timeout=1.0)
                
                # Fetch correct fiat price
                if signal.fiat_currency == 'USD':
                    base_price = ticker.price_usd
                elif signal.fiat_currency == 'INR':
                    base_price = ticker.price_inr
                else:
                    base_price = ticker.price_eur

                # Calculate slippage
                if signal.side == 'buy':
                    execution_price = base_price * (1 + self.slippage_rate)
                else:
                    execution_price = base_price * (1 - self.slippage_rate)

                # Calculate fee (in fiat terms)
                fee = (execution_price * signal.amount) * self.fee_rate
                
                pnl_fiat = 0.0
                pnl_percent = 0.0
                
                # Fetch position to calculate PnL if selling
                if signal.side == 'sell':
                    pos = await database.get_position(signal.symbol)
                    if pos:
                        avg_price = pos[f'average_price_{signal.fiat_currency.lower()}']
                        if avg_price > 0:
                            cost_basis = avg_price * signal.amount
                            sale_value = execution_price * signal.amount
                            pnl_fiat = sale_value - cost_basis - fee
                            pnl_percent = (pnl_fiat / cost_basis) * 100

                logger.info(f"Executing {signal.side.upper()} {signal.amount} {signal.symbol} at {execution_price:.2f} {signal.fiat_currency} (Fee: {fee:.2f}, PnL: {pnl_fiat:.2f})")
                
                # Execute in DB
                success = await database.execute_trade(
                    symbol=signal.symbol,
                    side=signal.side,
                    fiat_currency=signal.fiat_currency,
                    amount=signal.amount,
                    price=execution_price,
                    fee=fee,
                    pnl_fiat=pnl_fiat,
                    pnl_percent=pnl_percent
                )
                
                if success:
                    balance = await database.get_balance(signal.fiat_currency)
                    logger.success(f"Trade successful! Remaining {signal.fiat_currency} Balance: {balance:.2f}")
                    if self.broadcast_cb:
                        payload = {
                            "type": "trade", 
                            "symbol": signal.symbol, 
                            "side": signal.side, 
                            "amount": signal.amount, 
                            "price": execution_price, 
                            "fee": fee,
                            "fiat_currency": signal.fiat_currency,
                            "pnl_fiat": pnl_fiat,
                            "pnl_percent": pnl_percent,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        asyncio.create_task(self.broadcast_cb(json.dumps(payload)))
                else:
                    logger.error("Trade failed (insufficient funds/asset).")

                self.order_queue.task_done()

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Order Manager Error: {e}")
                
        logger.info("Order Manager stopped gracefully.")
