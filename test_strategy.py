import pytest
import asyncio
from unittest.mock import AsyncMock, patch
import json

from strategy import StrategyEngine, SymbolState
from models import TradeSignal

@pytest.mark.asyncio
async def test_staggered_panic_sell_sells_all_positions():
    data_queue = asyncio.Queue()
    order_queue = asyncio.Queue()
    engine = StrategyEngine(data_queue, order_queue)
    
    mock_positions = [
        {'symbol': 'BTC/USDT', 'amount': 0.5, 'average_price_usd': 60000.0},
        {'symbol': 'ETH/USDT', 'amount': 10.0, 'average_price_usd': 3000.0}
    ]
    
    with patch('database.get_bot_config', new_callable=AsyncMock) as mock_config:
        mock_config.return_value = {'mode': 'paper'}
        with patch('database.get_all_positions', new_callable=AsyncMock) as mock_get_pos:
            mock_get_pos.return_value = mock_positions
            with patch('database.get_fx_rate', new_callable=AsyncMock) as mock_fx:
                mock_fx.return_value = 1.0
                with patch('asyncio.sleep', new_callable=AsyncMock): # Skip the wait
                    # Mock _persist_state to do nothing
                    engine._persist_state = AsyncMock()
                    
                    await engine._staggered_panic_sell()
                    
    # Negative assertion logic: We assert exactly 2 calls were placed in the queue
    assert order_queue.qsize() == 2
    
    # Verify the contents
    signal1, _ = await order_queue.get()
    assert signal1.symbol == 'BTC/USDT'
    assert signal1.side == 'sell'
    assert signal1.amount == 0.5
    
    signal2, _ = await order_queue.get()
    assert signal2.symbol == 'ETH/USDT'
    assert signal2.side == 'sell'
    assert signal2.amount == 10.0
    
    # Assert nothing else was queued
    assert order_queue.empty()

@pytest.mark.asyncio
async def test_dca_gate_rejects_neutral_rsi():
    data_queue = asyncio.Queue()
    order_queue = asyncio.Queue()
    engine = StrategyEngine(data_queue, order_queue)
    
    symbol = "BTC/USDT"
    engine.states[symbol] = SymbolState()
    
    with patch.object(engine, '_indicators', return_value=(60000.0, 50.0)):
        result = engine._passes_dca_gate(symbol)
        
        # Negative path assertion: Ensure it strictly returns False (blocks the trade)
        assert result is False

@pytest.mark.asyncio
async def test_state_serialization_round_trip():
    state = SymbolState()
    state.dca_layer = 3
    state.avg_entry = 60000.12345
    state.reentry_until = 123456789.0
    state.position_amount = 0.55
    
    serialized = json.dumps(state.to_dict())
    
    new_state = SymbolState()
    new_state.from_dict(json.loads(serialized))
    
    assert new_state.dca_layer == 3
    assert new_state.avg_entry == 60000.12345
    assert new_state.reentry_until == 123456789.0
    assert new_state.position_amount == 0.55
