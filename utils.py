import httpx
import database
from loguru import logger

async def send_telegram_alert(msg: str):
    try:
        config = await database.get_bot_config()
        token = config.get("telegram_bot_token")
        chat_id = config.get("telegram_chat_id")

        if not token or not chat_id:
            return  # Gracefully bypass if not configured
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": msg,
            "parse_mode": "HTML"
        }
        
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error(f"Telegram alert failed: {resp.text}")
    except Exception as e:
        logger.error(f"Error sending telegram alert: {e}")

async def fetch_current_price(symbol: str) -> float:
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            "https://api.coindcx.com/exchange/ticker",
            params={"market": symbol.replace('/', '')}
        )
        return float(r.json()[0]["last_price"])
