import asyncio
import database
from datetime import datetime, timezone
import httpx
from loguru import logger
import google.generativeai as genai

async def generate_system_summary(strategy_engine=None) -> str:
    """Generates a markdown summary of the system's current state."""
    config = await database.get_bot_config()
    mode = config.get("mode", "paper")
    
    pnl_usd = await database.get_24h_pnl("USD", mode=mode)
    total_pnl = await database.get_total_profit("USD", mode=mode)
    
    positions = await database.get_all_positions(mode=mode)
    usd_bal = await database.get_balance("USD", mode=mode)
    
    report = f"# System Summary Report ({mode.upper()} MODE)\n\n"
    report += f"**Generated At:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
    
    report += "## Performance\n"
    report += f"- **24h PnL (USD):** ${pnl_usd:+.2f}\n"
    report += f"- **Total PnL (USD):** ${total_pnl:+.2f}\n"
    report += f"- **Wallet Balance (USD):** ${usd_bal:.2f}\n\n"
    
    report += "## Active Positions\n"
    if positions:
        for pos in positions:
            sym = pos.get('symbol')
            amt = pos.get('amount')
            avg = pos.get('average_price_usd')
            report += f"- **{sym}**: {amt} @ ${avg:.2f}\n"
    else:
        report += "- *No active positions.*\n"
        
    report += "\n## System Status\n"
    is_paused = config.get("is_paused", False)
    report += f"- **Bot Paused:** {'Yes' if is_paused else 'No'}\n"
    
    if strategy_engine:
        bot_halted = getattr(strategy_engine, 'bot_halted', False)
        report += f"- **Kill Switch Activated:** {'Yes' if bot_halted else 'No'}\n"
        
        # Macro Regimes
        regimes = strategy_engine.macro_regimes
        if regimes:
            report += "\n### Macro Regimes\n"
            for sym, regime_data in regimes.items():
                regime_str = regime_data.get("regime", "unknown") if isinstance(regime_data, dict) else str(regime_data)
                report += f"- **{sym}:** {regime_str.upper()}\n"
                
    return report

async def generate_trade_suggestions(strategy_engine=None) -> str:
    """Uses Gemini API to generate manual trade suggestions based on system data."""
    config = await database.get_bot_config()
    api_key = config.get("llm_api_key", "").strip()
    
    import os
    if not api_key or "***" in api_key:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    
    if not api_key or "***" in api_key:
        return "Error: A valid Gemini LLM API Key is required. Please set it in the Settings page or add `GEMINI_API_KEY` to your `.env` file."
        
    genai.configure(api_key=api_key)
    
    # Gather system context
    mode = config.get("mode", "paper")
    positions = await database.get_all_positions(mode=mode)
    
    context = "Here is the current state of my crypto trading bot:\n\n"
    context += f"Mode: {mode}\n"
    
    if positions:
        context += "Active Positions:\n"
        for pos in positions:
            context += f"- {pos.get('symbol')}: {pos.get('amount')} @ ${pos.get('average_price_usd'):.2f}\n"
    else:
        context += "Active Positions: None\n"
        
    if strategy_engine:
        regimes = strategy_engine.macro_regimes
        if regimes:
            context += "\nCurrent Macro Regimes (Trend):\n"
            for sym, regime_data in regimes.items():
                regime_str = regime_data.get("regime", "unknown") if isinstance(regime_data, dict) else str(regime_data)
                context += f"- {sym}: {regime_str.upper()}\n"
                
    # We could also fetch some recent prices to give the LLM more context
    symbols = config.get("symbols", ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT"])
    if isinstance(symbols, str):
        symbols = [s.strip() for s in symbols.split(",") if s.strip()]
        
    context += "\nRecent Prices:\n"
    for sym in symbols:
        try:
            from utils import fetch_current_price
            price = await fetch_current_price(sym)
            if price > 0:
                context += f"- {sym}: ${price:.2f}\n"
        except Exception:
            pass
            
    prompt = context + "\n\nBased on the above market state, macro regimes, and my current positions, provide a short, actionable report with 2-3 manual trade suggestions (e.g., buy/sell opportunities, managing existing positions). Keep it concise, analytical, and format as Markdown."
    
    try:
        # We'll use gemini-1.5-flash for faster responses, or pro if preferred
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        response = await model.generate_content_async(prompt)
        
        return f"# AI Trade Suggestions\n\n**Generated At:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n{response.text}"
    except Exception as e:
        logger.error(f"LLM Generation Error: {e}")
        return f"Error generating suggestions: {str(e)}"
