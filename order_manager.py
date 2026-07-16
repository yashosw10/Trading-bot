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
        self.order_queue = order_queue
        self.broadcast_cb = broadcast_cb

    async def start(self, shutdown_event: asyncio.Event):
        logger.info("Starting Order Manager...")
        while not shutdown_event.is_set():
            try:
                # Wait for trade signal
                signal, ticker = await asyncio.wait_for(self.order_queue.get(), timeout=1.0)
                
                config = await database.get_bot_config()
                mode = signal.mode_override if signal.mode_override else config.get("mode", "paper")
                
                fee_rate = config.get("fee_rate", 0.001)
                slippage_rate = config.get("slippage_rate", 0.0005)
                
                # Fetch correct fiat price
                if signal.fiat_currency == 'USD':
                    base_price = ticker.price_usd
                elif signal.fiat_currency == 'INR':
                    base_price = ticker.price_inr
                else:
                    base_price = ticker.price_eur

                # Calculate slippage
                if signal.side == 'buy':
                    execution_price = base_price * (1 + slippage_rate)
                else:
                    execution_price = base_price * (1 - slippage_rate)

                # Calculate fee (in fiat terms)
                fee = (execution_price * signal.amount) * fee_rate
                
                pnl_fiat = 0.0
                pnl_percent = 0.0
                
                # Fetch position to calculate PnL if selling
                if signal.side == 'sell':
                    pos = await database.get_position(signal.symbol, mode=mode)
                    if pos:
                        avg_price = pos[f'average_price_{signal.fiat_currency.lower()}']
                        if avg_price > 0:
                            cost_basis = avg_price * signal.amount
                            sale_value = execution_price * signal.amount
                            pnl_fiat = sale_value - cost_basis - fee
                            pnl_percent = (pnl_fiat / cost_basis) * 100

                logger.info(f"Executing {signal.side.upper()} {signal.amount} {signal.symbol} at {execution_price:.2f} {signal.fiat_currency} (Fee: {fee:.2f}, PnL: {pnl_fiat:.2f})")
                
                success = True
                # If live mode, place the order on CoinDCX FIRST before DB
                if mode == 'live':
                    from exchange import CoinDCXClient
                    client = CoinDCXClient()
                    
                    # PRE-TRADE SYNC
                    live_balances = await client.get_balances()
                    if isinstance(live_balances, list):
                        for b in live_balances:
                            currency = b.get("currency")
                            b_amt = float(b.get("balance", 0.0))
                            if currency in ["USDT", "INR", "EUR"]:
                                cur = "USD" if currency == "USDT" else currency
                                await database.set_balance(cur, b_amt, mode="live")

                    # Execute market order using USD execution price mapping
                    resp = await client.place_order(
                        symbol=signal.symbol,
                        side=signal.side,
                        amount=signal.amount,
                        price=execution_price
                    )
                    if not resp:
                        logger.error(f"Failed to place {mode} order on CoinDCX! Dropping trade to maintain DB sync.")
                        success = False
                    else:
                        if resp.get('price_per_unit'):
                            execution_price = float(resp['price_per_unit'])
                        if resp.get('fee_amount'):
                            fee = float(resp['fee_amount'])
                        if resp.get('total_quantity'):
                            signal.amount = float(resp['total_quantity'])
                
                # If the exchange order succeeded (or paper mode), log it to the database
                if success:
                    success = await database.execute_trade(
                        symbol=signal.symbol,
                        side=signal.side,
                        fiat_currency=signal.fiat_currency,
                        amount=signal.amount,
                        price=execution_price,
                        fee=fee,
                        pnl_fiat=pnl_fiat,
                        pnl_percent=pnl_percent,
                        mfe=signal.mfe,
                        mae=signal.mae,
                        mode=mode
                    )
                
                if success:
                    balance = await database.get_balance(signal.fiat_currency, mode=mode)
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
                            "mfe": signal.mfe,
                            "mae": signal.mae,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        asyncio.create_task(self.broadcast_cb(json.dumps(payload)))
                        
                        from utils import send_telegram_alert
                        import html
                        try:
                            if config.get("trade_alerts_enabled", True):
                                msg_side = "🟢 BUY" if signal.side == 'buy' else "🔴 SELL"
                                pnl_str = f"\nPnL: ${pnl_fiat:+.2f}" if signal.side == 'sell' else ""
                                safe_symbol = html.escape(signal.symbol)
                                asyncio.create_task(send_telegram_alert(
                                    f"<b>{msg_side} {safe_symbol}</b>\nPrice: ${execution_price:,.2f}\nQty: {signal.amount}{pnl_str}"
                                ))

                        except RuntimeError:
                            # No event loop running — skip silently, never block trade execution
                            pass
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
