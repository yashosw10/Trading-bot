import os
import subprocess
from loguru import logger
import threading

_exe_path = os.path.join(os.path.dirname(__file__), 'quant_engine_cpp', 'quant_math.exe')
_process = None
_lock = threading.Lock()

if os.path.exists(_exe_path):
    try:
        # Spawn the 32-bit C++ engine as a totally separate microservice!
        _process = subprocess.Popen(
            [_exe_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        logger.info("✅ C++ Quant Strategy Microservice spawned successfully.")
    except Exception as e:
        logger.error(f"❌ Failed to spawn C++ Quant Math Microservice: {e}")
else:
    logger.warning("⚠️ C++ Quant Math Microservice not found. Please compile it using `quant_engine_cpp/build.ps1`.")

def get_quant_signal(prices: list[float], window_size: int = 20) -> dict:
    """
    Calls the ultra-fast C++ Strategy microservice.
    Returns:
        dict: {"signal": "BUY"|"SELL"|"HOLD", "confidence": float, "z_score": float, "kelly_fraction": float}
    """
    length = len(prices)
    if length < window_size:
        return {"signal": "HOLD", "confidence": 0.0, "z_score": 0.0, "kelly_fraction": 0.0}
        
    if _process:
        with _lock:
            try:
                # Send prices array to C++ engine
                payload = " ".join(map(str, prices)) + "\n"
                _process.stdin.write(payload)
                _process.stdin.flush()
                
                # Receive computed structured response (SIGNAL CONFIDENCE Z_SCORE)
                response = _process.stdout.readline()
                if response:
                    parts = response.strip().split()
                    if len(parts) >= 4:
                        return {
                            "signal": parts[0],
                            "confidence": float(parts[1]),
                            "z_score": float(parts[2]),
                            "kelly_fraction": float(parts[3])
                        }
            except Exception as e:
                logger.error(f"Microservice IPC error: {e}")
                
    return {"signal": "HOLD", "confidence": 0.0, "z_score": 0.0, "kelly_fraction": 0.0}
