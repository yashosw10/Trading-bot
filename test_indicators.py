import urllib.request, json
req = urllib.request.Request('http://localhost:8000/api/indicators?symbol=BTC/USDT&type=RSI&interval=1m')
req.add_header('X-API-Key', 'liquidglass-secure-token-9988')
try:
    data = json.loads(urllib.request.urlopen(req).read())
    print("RSI Data Length:", len(data))
    if data:
        print("Last 3 RSI values:")
        for d in data[-3:]:
            print(d)
except Exception as e:
    print("Error:", e)
