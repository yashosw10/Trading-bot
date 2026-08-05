import httpx
from loguru import logger
import time

_FNG_CACHE = {"timestamp": 0, "value": 50, "classification": "Neutral"}
CACHE_TTL = 3600  # 1 hour cache

def get_fear_and_greed_index() -> dict:
    """
    Fetches the Crypto Fear & Greed Index from alternative.me.
    Returns dict with 'value' (0-100) and 'classification'.
    Caches the result for 1 hour to avoid API rate limits.
    """
    current_time = time.time()
    if current_time - _FNG_CACHE["timestamp"] < CACHE_TTL:
        return _FNG_CACHE
        
    try:
        url = "https://api.alternative.me/fng/"
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
        data = response.json()
        
        if data.get("data") and len(data["data"]) > 0:
            latest = data["data"][0]
            _FNG_CACHE["value"] = int(latest["value"])
            _FNG_CACHE["classification"] = latest["value_classification"]
            _FNG_CACHE["timestamp"] = current_time
            logger.info(f"Fetched Fear & Greed Index: {_FNG_CACHE['value']} ({_FNG_CACHE['classification']})")
            return _FNG_CACHE
            
    except Exception as e:
        logger.error(f"Failed to fetch Fear & Greed Index: {e}")
        
    # Return last known or default if fails
    return _FNG_CACHE
