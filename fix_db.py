import re

with open('database.py', 'r') as f:
    content = f.read()

# Add safe_mode function
safe_mode_func = '''
def _safe_mode(mode: str) -> str:
    if mode not in ['paper', 'live']:
        raise ValueError(f"Invalid mode: {mode}")
    return mode
'''

# Find the right place to insert it (after imports and logger setup, before init_db)
if '_safe_mode' not in content:
    content = content.replace('async def init_db():', safe_mode_func + '\nasync def init_db():')

# Replace {mode} with {_safe_mode(mode)} in f-strings only for table names
# like wallet_{mode}, positions_{mode}, trades_{mode}
# But let's just do a regex replace for these specific table names
content = re.sub(r'wallet_\{mode\}', r'wallet_{_safe_mode(mode)}', content)
content = re.sub(r'positions_\{mode\}', r'positions_{_safe_mode(mode)}', content)
content = re.sub(r'trades_\{mode\}', r'trades_{_safe_mode(mode)}', content)

with open('database.py', 'w') as f:
    f.write(content)
