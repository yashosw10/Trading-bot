import uvicorn
import sys
import msvcrt
import os

if __name__ == "__main__":
    # OS-level instance lock tied to process lifetime
    lock_file = open("bot.lock", "w")
    try:
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        print("Another instance of the Trading Bot is already running. Exiting.")
        sys.exit(1)
        
    # This acts exactly like `python -m uvicorn api:app --reload`
    # but the background bot tasks are now hooked into the FastAPI lifespan!
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
