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
