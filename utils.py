import httpx
import database
from loguru import logger

async def send_telegram_alert(msg: str):
    try:
        config = await database.get_bot_config()
        token = config.get("telegram_bot_token")
        chat_id = config.get("telegram_chat_id")

        if not token or not chat_id:
            return False, "Credentials missing"
            
        token = str(token).strip()
        chat_id = str(chat_id).strip()
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": msg,
            "parse_mode": "HTML"
        }
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error(f"Telegram alert failed: {resp.text}")
                try:
                    err = resp.json().get('description', resp.text)
                except:
                    err = resp.text
                return False, err
            return True, "Success"
    except Exception as e:
        logger.error(f"Error sending telegram alert: {e}")
        return False, str(e)

async def send_daily_summary():
    try:
        config = await database.get_bot_config()
        if not config.get("daily_summary_enabled", False):
            return
            
        pnl_usd = await database.get_24h_pnl("USD")
        
        msg = "📊 <b>Daily Summary</b>\n\n"
        msg += f"<b>24h PnL (USD):</b> ${pnl_usd:+.2f}\n"
        
        # Optionally add total profit
        total_pnl = await database.get_total_profit("USD")
        msg += f"<b>Total PnL (USD):</b> ${total_pnl:+.2f}\n"
        
        await send_telegram_alert(msg)
    except Exception as e:
        logger.error(f"Error sending daily summary: {e}")


async def fetch_current_price(symbol: str) -> float:
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get("https://api.coindcx.com/exchange/ticker")
        data = r.json()
        target_market = symbol.replace('/', '')
        
        for ticker in data:
            if ticker.get("market") == target_market:
                return float(ticker["last_price"])
                
        # Fallback if not found
        return 0.0

async def update_fx_rates():
    """Fetches real exchange rates for INR and EUR from public API and updates DB."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            if r.status_code == 200:
                data = r.json()
                rates = data.get("rates", {})
                
                inr_rate = rates.get("INR")
                eur_rate = rates.get("EUR")
                
                if inr_rate:
                    await database.update_fx_rate("INR", inr_rate)
                if eur_rate:
                    await database.update_fx_rate("EUR", eur_rate)
                logger.info(f"Successfully updated FX rates: INR={inr_rate}, EUR={eur_rate}")
            else:
                logger.warning(f"Failed to fetch FX rates, status code: {r.status_code}")
    except Exception as e:
        logger.error(f"Error fetching FX rates: {e}")
