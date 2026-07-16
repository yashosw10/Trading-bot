import { useState, useEffect } from 'react';
import { wsManager } from '@/lib/ws';

export interface LivePriceData {
  symbol: string;
  price_usd: number;
  change_24h: number;
  sparkline: number[];
}

export function useLivePrice(symbol: string) {
  const [data, setData] = useState<LivePriceData | null>(null);

  useEffect(() => {
    const unsubscribe = wsManager.subscribe((msg) => {
      if (msg.type === 'ticker' && msg.symbol === symbol) {
        setData({
          symbol: msg.symbol,
          price_usd: msg.price_usd,
          change_24h: msg.price_change_percent,
          sparkline: msg.sparkline || []
        });
      }
    });

    return unsubscribe;
  }, [symbol]);

  return data;
}
