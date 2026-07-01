import asyncio
import signal
from loguru import logger
import database
from streamer import Streamer
from strategy import StrategyEngine
from order_manager import OrderManager
import uvicorn
from api import app, manager

async def main():
    logger.add("bot.log", rotation="10 MB")
    logger.info("Initializing Crypto Paper Trading Bot with FastAPI...")

    # Initialize SQLite database
    await database.init_db()

    # Create shutdown event
    shutdown_event = asyncio.Event()

    # Handle graceful shutdown
    def handle_shutdown():
        logger.warning("Shutdown signal received! Gracefully stopping components...")
        shutdown_event.set()

    # Windows compatible shutdown handling
    loop = asyncio.get_running_loop()
    try:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, handle_shutdown)
    except NotImplementedError:
        pass

    # Create queues
    data_queue = asyncio.Queue()
    order_queue = asyncio.Queue()

    # Create a broadcast callback function
    async def broadcast_ws(msg: str):
        await manager.broadcast(msg)

    # Initialize components
    streamer = Streamer(queue=data_queue, symbol='BTC/USDT', broadcast_cb=broadcast_ws)
    strategy = StrategyEngine(data_queue=data_queue, order_queue=order_queue)
    strategy.fiat_currency = 'USD' 
    order_manager = OrderManager(order_queue=order_queue, broadcast_cb=broadcast_ws)

    # Start FastAPI with Uvicorn
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    api_task = asyncio.create_task(server.serve())

    # Create background tasks
    streamer_task = asyncio.create_task(streamer.start(shutdown_event))
    strategy_task = asyncio.create_task(strategy.start(shutdown_event))
    order_manager_task = asyncio.create_task(order_manager.start(shutdown_event))

    # Fallback shutdown catcher for Windows
    try:
        while not shutdown_event.is_set():
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        handle_shutdown()

    # Tell uvicorn to exit
    server.should_exit = True

    # Cancel tasks to force them to wake up from their wait loops
    for task in [streamer_task, strategy_task, order_manager_task, api_task]:
        if not task.done():
            task.cancel()

    # Wait for tasks to finish their exception handling / finally blocks
    await asyncio.gather(streamer_task, strategy_task, order_manager_task, api_task, return_exceptions=True)
    logger.info("Bot shutdown complete.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
