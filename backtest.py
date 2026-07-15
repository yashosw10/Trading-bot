import pandas as pd
import pandas_ta as ta
import math
from datetime import datetime
from loguru import logger
import asyncio
from api import get_ohlcv

# Strategy Constants (matching strategy.py)
EMA_PERIOD = 50
RSI_PERIOD = 14
BB_PERIOD = 20
BB_VOLATILITY_THRESH = 0.05
RSI_ENTRY_GATE = 35
RSI_DCA_SKIP_LOW = 40
RSI_DCA_SKIP_HIGH = 60

GRID_TIGHT = 0.01   # 1%
GRID_WIDE = 0.03    # 3%
MAX_DCA_LAYERS = 5

async def run_backtest(symbol: str, interval: str, limit: int, config: dict):
    # Fetch historical data
    ohlcv = await get_ohlcv(symbol, interval, limit)
    if not ohlcv or len(ohlcv) < EMA_PERIOD:
        return None
        
    df = pd.DataFrame(ohlcv)
    df.set_index(pd.DatetimeIndex(df['timestamp']), inplace=True)
    
    # Calculate Indicators
    df.ta.ema(length=EMA_PERIOD, append=True)
    df.ta.rsi(length=RSI_PERIOD, append=True)
    df.ta.bbands(length=BB_PERIOD, append=True)
    
    # Drop rows with NaN (warmup period)
    df = df.dropna()
    
    if len(df) == 0:
        return None
        
    initial_balance = 10000.0
    balance = initial_balance
    
    position_amount = 0.0
    total_invested = 0.0
    dca_layer = 0
    
    fee_rate = config.get("fee_rate", 0.001)
    slippage_rate = config.get("slippage_rate", 0.0005)
    max_position_size = config.get("max_position_size", 100.0)
    
    trades = 0
    wins = 0
    losses = 0
    gross_profit = 0.0
    gross_loss = 0.0
    
    max_drawdown = 0.0
    peak_balance = initial_balance
    
    total_bars_in_trade = 0
    current_trade_bars = 0
    
    for i in range(len(df)):
        row = df.iloc[i]
        price = row['close']
        ema = row[f'EMA_{EMA_PERIOD}']
        rsi = row[f'RSI_{RSI_PERIOD}']
        
        bb_upper = row[f'BBU_{BB_PERIOD}_2.0']
        bb_lower = row[f'BBL_{BB_PERIOD}_2.0']
        bb_mid = row[f'BBM_{BB_PERIOD}_2.0']
        
        bb_width = (bb_upper - bb_lower) / bb_mid if bb_mid > 0 else 0
        base_grid = GRID_WIDE if bb_width > BB_VOLATILITY_THRESH else GRID_TIGHT
        grid_spacing = max(base_grid, 0.5 * bb_width)
        
        if position_amount > 0:
            current_trade_bars += 1
            avg_entry = total_invested / position_amount
            current_value = position_amount * price
            pnl_pct = (current_value - total_invested) / total_invested if total_invested > 0 else 0
            
            if pnl_pct >= grid_spacing:
                sell_price = price * (1 - slippage_rate)
                sale_value = position_amount * sell_price
                fee = sale_value * fee_rate
                net_proceeds = sale_value - fee
                
                trade_pnl = net_proceeds - total_invested
                balance += trade_pnl
                
                trades += 1
                if trade_pnl > 0:
                    wins += 1
                    gross_profit += trade_pnl
                else:
                    losses += 1
                    gross_loss += abs(trade_pnl)
                    
                total_bars_in_trade += current_trade_bars
                current_trade_bars = 0
                
                position_amount = 0.0
                total_invested = 0.0
                dca_layer = 0
                
            elif pnl_pct <= -grid_spacing and dca_layer < MAX_DCA_LAYERS:
                if rsi < RSI_DCA_SKIP_LOW or rsi > RSI_DCA_SKIP_HIGH:
                    buy_size = min(max_position_size, balance)
                    if buy_size > 10:
                        buy_price = price * (1 + slippage_rate)
                        fee = buy_size * fee_rate
                        actual_invest = buy_size - fee
                        amount = actual_invest / buy_price
                        
                        position_amount += amount
                        total_invested += buy_size
                        balance -= buy_size
                        dca_layer += 1
        
        else:
            if price > ema and rsi < RSI_ENTRY_GATE:
                buy_size = min(max_position_size, balance)
                if buy_size > 10:
                    buy_price = price * (1 + slippage_rate)
                    fee = buy_size * fee_rate
                    actual_invest = buy_size - fee
                    amount = actual_invest / buy_price
                    
                    position_amount += amount
                    total_invested += buy_size
                    balance -= buy_size
                    dca_layer = 0
                    current_trade_bars = 1
                    
        current_equity = balance + (position_amount * price)
        if current_equity > peak_balance:
            peak_balance = current_equity
        drawdown = (peak_balance - current_equity) / peak_balance * 100
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    if position_amount > 0:
        sell_price = df.iloc[-1]['close'] * (1 - slippage_rate)
        sale_value = position_amount * sell_price
        fee = sale_value * fee_rate
        net_proceeds = sale_value - fee
        trade_pnl = net_proceeds - total_invested
        balance += trade_pnl
        trades += 1
        if trade_pnl > 0:
            wins += 1
            gross_profit += trade_pnl
        else:
            losses += 1
            gross_loss += abs(trade_pnl)
            
        total_bars_in_trade += current_trade_bars

    total_return_pct = ((balance - initial_balance) / initial_balance) * 100
    win_rate = (wins / trades) if trades > 0 else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)
    
    interval_hours = 1.0
    if interval == '1m': interval_hours = 1/60
    elif interval == '5m': interval_hours = 5/60
    elif interval == '15m': interval_hours = 15/60
    elif interval == '30m': interval_hours = 30/60
    elif interval == '1h': interval_hours = 1.0
    elif interval == '4h': interval_hours = 4.0
    elif interval == '1d': interval_hours = 24.0
    
    avg_trade_duration = (total_bars_in_trade / trades * interval_hours) if trades > 0 else 0.0
    
    return {
        "strategy": "VA-DCA Hybrid",
        "start_date": str(df.index[0]),
        "end_date": str(df.index[-1]),
        "initial_balance": initial_balance,
        "final_balance": round(balance, 2),
        "total_return_pct": round(total_return_pct, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 2),
        "total_trades": trades,
        "avg_trade_duration_hours": round(avg_trade_duration, 1),
        "is_mock": False
    }
