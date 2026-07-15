import aiosqlite
import asyncio
from loguru import logger

DB_FILE = 'paper_trading.db'

async def init_db():
    async with aiosqlite.connect(DB_FILE) as db:
        # Migrate old tables if they exist (ignore errors if already migrated)
        try:
            await db.execute('ALTER TABLE wallet RENAME TO wallet_paper')
        except Exception:
            pass
        try:
            await db.execute('ALTER TABLE positions RENAME TO positions_paper')
        except Exception:
            pass
        try:
            await db.execute('ALTER TABLE trades RENAME TO trades_paper')
        except Exception:
            pass
            
        for mode in ['paper', 'live']:
            await db.execute(f'''
                CREATE TABLE IF NOT EXISTS wallet_{mode} (
                    currency TEXT PRIMARY KEY,
                    balance REAL
                )
            ''')
            
            await db.execute(f'''
                CREATE TABLE IF NOT EXISTS positions_{mode} (
                    symbol TEXT PRIMARY KEY,
                    amount REAL,
                    average_price_usd REAL,
                    average_price_inr REAL,
                    average_price_eur REAL
                )
            ''')
            
            await db.execute(f'''
                CREATE TABLE IF NOT EXISTS trades_{mode} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT,
                    side TEXT,
                    fiat_currency TEXT,
                    amount REAL,
                    price REAL,
                    fee REAL,
                    pnl_fiat REAL DEFAULT 0.0,
                    pnl_percent REAL DEFAULT 0.0,
                    mfe REAL DEFAULT 0.0,
                    mae REAL DEFAULT 0.0,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
        await db.execute('''
            CREATE TABLE IF NOT EXISTS bot_config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                daily_loss_limit REAL DEFAULT 5.0,
                max_drawdown_pct REAL DEFAULT 15.0,
                max_position_size REAL DEFAULT 100.0,
                max_open_positions INTEGER DEFAULT 3,
                mode TEXT DEFAULT 'paper',
                is_paused BOOLEAN DEFAULT 0,
                telegram_bot_token TEXT DEFAULT '',
                telegram_chat_id TEXT DEFAULT '',
                trade_alerts_enabled BOOLEAN DEFAULT 1,
                daily_summary_enabled BOOLEAN DEFAULT 0,
                symbols TEXT DEFAULT 'BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,XRP/USDT',
                fee_rate REAL DEFAULT 0.001,
                slippage_rate REAL DEFAULT 0.0005,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        try:
            await db.execute("ALTER TABLE bot_config ADD COLUMN telegram_bot_token TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE bot_config ADD COLUMN telegram_chat_id TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE bot_config ADD COLUMN trade_alerts_enabled BOOLEAN DEFAULT 1")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE bot_config ADD COLUMN daily_summary_enabled BOOLEAN DEFAULT 0")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE bot_config ADD COLUMN symbols TEXT DEFAULT 'BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,XRP/USDT'")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE bot_config ADD COLUMN fee_rate REAL DEFAULT 0.001")
            await db.execute("ALTER TABLE bot_config ADD COLUMN slippage_rate REAL DEFAULT 0.0005")
        except Exception:
            pass
        
        # Insert default config row if empty
        await db.execute('INSERT OR IGNORE INTO bot_config (id) VALUES (1)')
        
        await db.execute('''
            CREATE TABLE IF NOT EXISTS fx_rates (
                currency TEXT PRIMARY KEY,
                rate REAL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Seed with initial rates if empty
        await db.execute('INSERT OR IGNORE INTO fx_rates (currency, rate) VALUES ("INR", 83.0)')
        await db.execute('INSERT OR IGNORE INTO fx_rates (currency, rate) VALUES ("EUR", 0.92)')
        
        await db.execute('''
            CREATE TABLE IF NOT EXISTS backtest_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                strategy TEXT,
                start_date TEXT,
                end_date TEXT,
                initial_balance REAL,
                final_balance REAL,
                total_return_pct REAL,
                max_drawdown_pct REAL,
                win_rate REAL,
                profit_factor REAL DEFAULT 0.0,
                total_trades INTEGER DEFAULT 0,
                avg_trade_duration_hours REAL DEFAULT 0.0,
                is_mock BOOLEAN DEFAULT 0
            )
        ''')
        
        # Seed mock backtest data
        await db.execute('''
            INSERT OR IGNORE INTO backtest_results (
                id, timestamp, strategy, start_date, end_date,
                initial_balance, final_balance, total_return_pct,
                max_drawdown_pct, win_rate, profit_factor,
                total_trades, avg_trade_duration_hours, is_mock
            ) VALUES (
                1, datetime('now'), 'VA-DCA Hybrid (seed data)',
                '2024-01-01', '2024-12-31',
                10000, 13240, 32.4, 12.1, 0.61, 1.85, 142, 12.5, 1
            )
        ''')
        
async def insert_backtest_result(result: dict) -> bool:
    async with aiosqlite.connect(DB_FILE) as db:
        try:
            await db.execute('''
                INSERT INTO backtest_results (
                    strategy, start_date, end_date, initial_balance, final_balance,
                    total_return_pct, max_drawdown_pct, win_rate, profit_factor,
                    total_trades, avg_trade_duration_hours, is_mock
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                result.get('strategy', 'Unknown'),
                result.get('start_date', ''),
                result.get('end_date', ''),
                result.get('initial_balance', 0.0),
                result.get('final_balance', 0.0),
                result.get('total_return_pct', 0.0),
                result.get('max_drawdown_pct', 0.0),
                result.get('win_rate', 0.0),
                result.get('profit_factor', 0.0),
                result.get('total_trades', 0),
                result.get('avg_trade_duration_hours', 0.0),
                int(result.get('is_mock', False))
            ))
            await db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to insert backtest result: {e}")
            return False

        try:
            await db.execute('ALTER TABLE bot_config ADD COLUMN is_paused BOOLEAN DEFAULT 0')
        except Exception:
            pass
            
        # Initialize virtual balances if not exists
        await db.execute('INSERT OR IGNORE INTO wallet_paper (currency, balance) VALUES ("USD", 10000.0)')
        await db.execute('INSERT OR IGNORE INTO wallet_paper (currency, balance) VALUES ("INR", 830000.0)') # ~10k USD
        await db.execute('INSERT OR IGNORE INTO wallet_paper (currency, balance) VALUES ("EUR", 9200.0)')   # ~10k USD
        
        await db.commit()
    logger.info("Database initialized with default balances and bot_config.")

async def get_balance(currency: str, mode: str = 'paper') -> float:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute(f'SELECT balance FROM wallet_{mode} WHERE currency = ?', (currency,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0.0

async def set_balance(currency: str, amount: float, mode: str = 'paper'):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(f'INSERT OR REPLACE INTO wallet_{mode} (currency, balance) VALUES (?, ?)', (currency, amount))
        await db.commit()

async def add_balance(currency: str, amount: float, mode: str = 'paper'):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(f'''
            INSERT INTO wallet_{mode} (currency, balance) VALUES (?, ?)
            ON CONFLICT(currency) DO UPDATE SET balance = balance + excluded.balance
        ''', (currency, amount))
        await db.commit()

async def get_total_profit(fiat_currency: str, mode: str = 'paper') -> float:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute(f'SELECT SUM(pnl_fiat) FROM trades_{mode} WHERE fiat_currency = ?', (fiat_currency,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row and row[0] else 0.0

async def get_24h_pnl(fiat_currency: str, mode: str = 'paper') -> float:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute(f"SELECT SUM(pnl_fiat) FROM trades_{mode} WHERE fiat_currency = ? AND timestamp >= datetime('now', '-1 day')", (fiat_currency,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row and row[0] else 0.0


async def clear_history(mode: str = 'paper'):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(f'DELETE FROM trades_{mode}')
        await db.execute(f'DELETE FROM positions_{mode}')
        await db.commit()

async def get_position(symbol: str, mode: str = 'paper') -> dict:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute(f'SELECT amount, average_price_usd, average_price_inr, average_price_eur FROM positions_{mode} WHERE symbol = ?', (symbol,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "amount": row[0],
                    "average_price_usd": row[1],
                    "average_price_inr": row[2],
                    "average_price_eur": row[3]
                }
            return None

async def get_all_positions(mode: str = 'paper') -> list[dict]:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute(f'SELECT symbol, amount, average_price_usd, average_price_inr, average_price_eur FROM positions_{mode} WHERE amount > 0') as cursor:
            rows = await cursor.fetchall()
            return [{
                "symbol": row[0],
                "amount": row[1],
                "average_price_usd": row[2],
                "average_price_inr": row[3],
                "average_price_eur": row[4]
            } for row in rows]

async def execute_trade(symbol: str, side: str, fiat_currency: str, amount: float, price: float, fee: float, pnl_fiat: float = 0.0, pnl_percent: float = 0.0, mfe: float = 0.0, mae: float = 0.0, mode: str = 'paper'):
    total_cost = (amount * price) + fee if side == 'buy' else (amount * price) - fee
    usd_to_inr = await get_fx_rate("INR")
    usd_to_eur = await get_fx_rate("EUR")
    
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("BEGIN IMMEDIATE"):
            if mode == 'paper':
                if side == 'buy':
                    async with db.execute(f'SELECT balance FROM wallet_{mode} WHERE currency = ?', (fiat_currency,)) as cursor:
                        row = await cursor.fetchone()
                        balance = row[0] if row else 0.0
                    if balance < total_cost:
                        logger.warning(f"Insufficient {fiat_currency} balance for {side} {amount} {symbol}")
                        await db.rollback()
                        return False
            
            if side == 'sell':
                async with db.execute(f'SELECT amount FROM positions_{mode} WHERE symbol = ?', (symbol,)) as cursor:
                    row = await cursor.fetchone()
                    pos_amount = row[0] if row else 0.0
                if pos_amount < amount:
                    logger.warning(f"Insufficient {symbol} amount for {side}")
                    await db.rollback()
                    return False

            if mode == 'paper':
                if side == 'buy':
                    await db.execute(f'UPDATE wallet_{mode} SET balance = balance - ? WHERE currency = ?', (total_cost, fiat_currency))
                else:
                    await db.execute(f'UPDATE wallet_{mode} SET balance = balance + ? WHERE currency = ?', (total_cost, fiat_currency))

            async with db.execute(f'SELECT amount, average_price_usd, average_price_inr, average_price_eur FROM positions_{mode} WHERE symbol = ?', (symbol,)) as cursor:
                pos = await cursor.fetchone()

            new_amount = 0.0
            avg_usd, avg_inr, avg_eur = 0.0, 0.0, 0.0
            
            # Derive standard USD price for the transaction to anchor calculations
            price_usd = price
            if fiat_currency == 'INR':
                price_usd = price / usd_to_inr
            elif fiat_currency == 'EUR':
                price_usd = price / usd_to_eur

            if pos:
                current_amount, pos_avg_usd = pos[0], pos[1]
                
                if side == 'buy':
                    new_amount = current_amount + amount
                    avg_usd = ((current_amount * pos_avg_usd) + (amount * price_usd)) / new_amount
                    avg_inr = avg_usd * usd_to_inr
                    avg_eur = avg_usd * usd_to_eur
                else:
                    new_amount = current_amount - amount
                    if new_amount <= 0.000001:  
                        new_amount, avg_usd, avg_inr, avg_eur = 0.0, 0.0, 0.0, 0.0
                    else:
                        avg_usd, avg_inr, avg_eur = pos[1], pos[2], pos[3]
                
                await db.execute(f'''
                    UPDATE positions_{mode} 
                    SET amount = ?, average_price_usd = ?, average_price_inr = ?, average_price_eur = ? 
                    WHERE symbol = ?
                ''', (new_amount, avg_usd, avg_inr, avg_eur, symbol))
            else:
                if side == 'buy':
                    new_amount = amount
                    avg_usd = price_usd
                    avg_inr = avg_usd * usd_to_inr
                    avg_eur = avg_usd * usd_to_eur
                    await db.execute(f'''
                        INSERT INTO positions_{mode} (symbol, amount, average_price_usd, average_price_inr, average_price_eur)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (symbol, new_amount, avg_usd, avg_inr, avg_eur))

            await db.execute(f'''
                INSERT INTO trades_{mode} (symbol, side, fiat_currency, amount, price, fee, pnl_fiat, pnl_percent, mfe, mae)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (symbol, side, fiat_currency, amount, price, fee, pnl_fiat, pnl_percent, mfe, mae))
            
            await db.commit()
            return True

async def get_bot_config() -> dict:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT daily_loss_limit, max_drawdown_pct, max_position_size, max_open_positions, mode, is_paused, telegram_bot_token, telegram_chat_id, trade_alerts_enabled, daily_summary_enabled, updated_at, symbols, fee_rate, slippage_rate FROM bot_config WHERE id = 1') as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "daily_loss_limit": row[0],
                    "max_drawdown_pct": row[1],
                    "max_position_size": row[2],
                    "max_open_positions": row[3],
                    "mode": row[4],
                    "is_paused": bool(row[5]),
                    "telegram_bot_token": row[6],
                    "telegram_chat_id": row[7],
                    "trade_alerts_enabled": bool(row[8]),
                    "daily_summary_enabled": bool(row[9]),
                    "updated_at": row[10],
                    "symbols": row[11].split(",") if len(row) > 11 and row[11] else ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT"],
                    "fee_rate": row[12] if len(row) > 12 else 0.001,
                    "slippage_rate": row[13] if len(row) > 13 else 0.0005
                }
            return {}

async def update_bot_config(config: dict) -> bool:
    async with aiosqlite.connect(DB_FILE) as db:
        set_clauses = []
        values = []
        allowed_keys = ['daily_loss_limit', 'max_drawdown_pct', 'max_position_size', 'max_open_positions', 'mode', 'is_paused', 'telegram_bot_token', 'telegram_chat_id', 'trade_alerts_enabled', 'daily_summary_enabled', 'symbols', 'fee_rate', 'slippage_rate']
        for k, v in config.items():
            if k in allowed_keys:
                set_clauses.append(f"{k} = ?")
                if k == 'symbols' and isinstance(v, list):
                    values.append(",".join(v))
                else:
                    values.append(v)
        if not set_clauses:
            return False
        
        set_clauses.append("updated_at = datetime('now')")
        query = f"UPDATE bot_config SET {', '.join(set_clauses)} WHERE id = 1"
        await db.execute(query, tuple(values))
        await db.commit()
        return True

async def get_fx_rate(currency: str) -> float:
    if currency == 'USD':
        return 1.0
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT rate FROM fx_rates WHERE currency = ?', (currency,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else (83.0 if currency == 'INR' else 0.92)

async def update_fx_rate(currency: str, rate: float):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('''
            INSERT INTO fx_rates (currency, rate, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(currency) DO UPDATE SET rate = excluded.rate, updated_at = datetime('now')
        ''', (currency, rate))
        await db.commit()
