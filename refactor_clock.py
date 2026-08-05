import re

with open('strategy.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace datetime.now(timezone.utc) with self._now()
code = code.replace('datetime.now(timezone.utc)', 'self._now()')

# StrategyEngine class definition starts with 'class StrategyEngine:'
class_def = '''class StrategyEngine:
    def __init__(self, fiat_currency: str = "USDT"):
        self.fiat_currency = fiat_currency'''

new_class_def = '''class StrategyEngine:
    def _now(self):
        """Injectable clock for event-driven backtesting"""
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)

    def __init__(self, fiat_currency: str = "USDT"):
        self.fiat_currency = fiat_currency'''

if class_def in code:
    code = code.replace(class_def, new_class_def)
else:
    print("Could not find exact class def match!")

with open('strategy.py', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done refactoring clock')
