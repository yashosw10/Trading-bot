import aiosqlite
import asyncio
from loguru import logger

DB_FILE = 'paper_trading.db'

async def init_db():
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS wallet (
                currency TEXT PRIMARY KEY,
                balance REAL
            )
        ''')
        
        await db.execute('''
            CREATE TABLE IF NOT EXISTS positions (
                symbol TEXT PRIMARY KEY,
                amount REAL,
                average_price_usd REAL,
                average_price_inr REAL,
                average_price_eur REAL
            )
        ''')
        
        await db.execute('''
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT,
                side TEXT,
                fiat_currency TEXT,
                amount REAL,
                price REAL,
                fee REAL,
                pnl_fiat REAL DEFAULT 0.0,
                pnl_percent REAL DEFAULT 0.0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Migration: Add pnl_fiat, pnl_percent, mfe, mae if they don't exist
        try:
            await db.execute('ALTER TABLE trades ADD COLUMN pnl_fiat REAL DEFAULT 0.0')
            await db.execute('ALTER TABLE trades ADD COLUMN pnl_percent REAL DEFAULT 0.0')
        except Exception:
            pass
            
        try:
            await db.execute('ALTER TABLE trades ADD COLUMN mfe REAL DEFAULT 0.0')
            await db.execute('ALTER TABLE trades ADD COLUMN mae REAL DEFAULT 0.0')
        except Exception:
            pass
            
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
        await db.execute('INSERT OR IGNORE INTO bot_config (id) VALUES (1)')
        
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
        
        try:
            await db.execute('ALTER TABLE bot_config ADD COLUMN is_paused BOOLEAN DEFAULT 0')
        except Exception:
            pass
            
        # Initialize virtual balances if not exists
        await db.execute('INSERT OR IGNORE INTO wallet (currency, balance) VALUES ("USD", 10000.0)')
        await db.execute('INSERT OR IGNORE INTO wallet (currency, balance) VALUES ("INR", 830000.0)') # ~10k USD
        await db.execute('INSERT OR IGNORE INTO wallet (currency, balance) VALUES ("EUR", 9200.0)')   # ~10k USD
        
        await db.commit()
    logger.info("Database initialized with default balances and bot_config.")

async def get_balance(currency: str) -> float:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT balance FROM wallet WHERE currency = ?', (currency,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0.0

async def set_balance(currency: str, amount: float):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('INSERT OR REPLACE INTO wallet (currency, balance) VALUES (?, ?)', (currency, amount))
        await db.commit()

async def add_balance(currency: str, amount: float):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('''
            INSERT INTO wallet (currency, balance) VALUES (?, ?)
            ON CONFLICT(currency) DO UPDATE SET balance = balance + excluded.balance
        ''', (currency, amount))
        await db.commit()

async def get_total_profit(fiat_currency: str) -> float:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT SUM(pnl_fiat) FROM trades WHERE fiat_currency = ?', (fiat_currency,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row and row[0] else 0.0

async def clear_history():
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('DELETE FROM trades')
        await db.execute('DELETE FROM positions')
        await db.commit()

async def get_position(symbol: str) -> dict:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT amount, average_price_usd, average_price_inr, average_price_eur FROM positions WHERE symbol = ?', (symbol,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "amount": row[0],
                    "average_price_usd": row[1],
                    "average_price_inr": row[2],
                    "average_price_eur": row[3]
                }
            return None

async def execute_trade(symbol: str, side: str, fiat_currency: str, amount: float, price: float, fee: float, pnl_fiat: float = 0.0, pnl_percent: float = 0.0, mfe: float = 0.0, mae: float = 0.0):
    total_cost = (amount * price) + fee if side == 'buy' else (amount * price) - fee
    
    async with aiosqlite.connect(DB_FILE) as db:
        if side == 'buy':
            async with db.execute('SELECT balance FROM wallet WHERE currency = ?', (fiat_currency,)) as cursor:
                row = await cursor.fetchone()
                balance = row[0] if row else 0.0
            if balance < total_cost:
                logger.warning(f"Insufficient {fiat_currency} balance for {side} {amount} {symbol}")
                return False
        
        if side == 'sell':
            async with db.execute('SELECT amount FROM positions WHERE symbol = ?', (symbol,)) as cursor:
                row = await cursor.fetchone()
                pos_amount = row[0] if row else 0.0
            if pos_amount < amount:
                logger.warning(f"Insufficient {symbol} amount for {side}")
                return False

        if side == 'buy':
            await db.execute('UPDATE wallet SET balance = balance - ? WHERE currency = ?', (total_cost, fiat_currency))
        else:
            await db.execute('UPDATE wallet SET balance = balance + ? WHERE currency = ?', (total_cost, fiat_currency))

        pos = await get_position(symbol)
        new_amount = 0.0
        avg_usd, avg_inr, avg_eur = 0.0, 0.0, 0.0
        
        if pos:
            current_amount = pos['amount']
            avg_usd, avg_inr, avg_eur = pos['average_price_usd'], pos['average_price_inr'], pos['average_price_eur']
            
            if side == 'buy':
                new_amount = current_amount + amount
                new_avg = ((current_amount * pos[f'average_price_{fiat_currency.lower()}']) + (amount * price)) / new_amount
                if fiat_currency == 'USD': avg_usd = new_avg
                elif fiat_currency == 'INR': avg_inr = new_avg
                elif fiat_currency == 'EUR': avg_eur = new_avg
            else:
                new_amount = current_amount - amount
                if new_amount <= 0.000001:  
                    new_amount, avg_usd, avg_inr, avg_eur = 0.0, 0.0, 0.0, 0.0
            
            await db.execute('''
                UPDATE positions 
                SET amount = ?, average_price_usd = ?, average_price_inr = ?, average_price_eur = ? 
                WHERE symbol = ?
            ''', (new_amount, avg_usd, avg_inr, avg_eur, symbol))
        else:
            if side == 'buy':
                new_amount = amount
                if fiat_currency == 'USD': avg_usd = price
                elif fiat_currency == 'INR': avg_inr = price
                elif fiat_currency == 'EUR': avg_eur = price
                await db.execute('''
                    INSERT INTO positions (symbol, amount, average_price_usd, average_price_inr, average_price_eur)
                    VALUES (?, ?, ?, ?, ?)
                ''', (symbol, new_amount, avg_usd, avg_inr, avg_eur))

        await db.execute('''
            INSERT INTO trades (symbol, side, fiat_currency, amount, price, fee, pnl_fiat, pnl_percent, mfe, mae)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (symbol, side, fiat_currency, amount, price, fee, pnl_fiat, pnl_percent, mfe, mae))
        
        await db.commit()
        return True

async def get_bot_config() -> dict:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT daily_loss_limit, max_drawdown_pct, max_position_size, max_open_positions, mode, is_paused, updated_at FROM bot_config WHERE id = 1') as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "daily_loss_limit": row[0],
                    "max_drawdown_pct": row[1],
                    "max_position_size": row[2],
                    "max_open_positions": row[3],
                    "mode": row[4],
                    "is_paused": bool(row[5]),
                    "updated_at": row[6]
                }
            return {}

async def update_bot_config(config: dict) -> bool:
    async with aiosqlite.connect(DB_FILE) as db:
        set_clauses = []
        values = []
        for k, v in config.items():
            if k in ['daily_loss_limit', 'max_drawdown_pct', 'max_position_size', 'max_open_positions', 'mode', 'is_paused']:
                set_clauses.append(f"{k} = ?")
                values.append(v)
        if not set_clauses:
            return False
        
        set_clauses.append("updated_at = datetime('now')")
        query = f"UPDATE bot_config SET {', '.join(set_clauses)} WHERE id = 1"
        await db.execute(query, tuple(values))
        await db.commit()
        return True
