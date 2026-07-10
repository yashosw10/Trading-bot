import { useState, useEffect } from 'react';
import { WS_URL } from '@/lib/api';

export interface LivePriceData {
  symbol: string;
  price_usd: number;
  change_24h: number;
  sparkline: number[];
}

export function useLivePrice(symbol: string) {
  const [data, setData] = useState<LivePriceData | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ticker' && msg.symbol === symbol) {
          setData({
            symbol: msg.symbol,
            price_usd: msg.price_usd,
            change_24h: msg.price_change_percent,
            sparkline: msg.sparkline || []
          });
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol]);

  return data;
}
