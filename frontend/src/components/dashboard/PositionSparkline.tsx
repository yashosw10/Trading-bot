"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AreaChart, Area, ResponsiveContainer, ReferenceLine, YAxis, Tooltip } from "recharts";
import { useMemo } from "react";

interface PositionSparklineProps {
  symbol: string;
  entryPrice: number;
}

export default function PositionSparkline({ symbol, entryPrice }: PositionSparklineProps) {
  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ['ohlcv', symbol, '15m', 48],
    queryFn: () => api.getOhlcv(symbol, '15m', 48),
    refetchInterval: 60000 // Refetch every minute
  });

  const chartData = useMemo(() => {
    if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length === 0) return [];
    
    // CoinDCX OHLCV format: { open, high, low, close, volume, time }
    // Sort ascending by time
    const sorted = [...ohlcv].sort((a, b) => a.time - b.time);
    
    return sorted.map(candle => ({
      time: new Date(candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: candle.close
    }));
  }, [ohlcv]);

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : entryPrice;
  const isProfit = currentPrice >= entryPrice;

  if (isLoading) {
    return <div className="w-full h-16 glass-skeleton rounded-lg opacity-50 mt-4" />;
  }

  if (chartData.length === 0) {
    return null;
  }

  const minPrice = Math.min(...chartData.map(d => d.price), entryPrice) * 0.999;
  const maxPrice = Math.max(...chartData.map(d => d.price), entryPrice) * 1.001;

  // Offset logic to color area green above entry and red below
  const gradientOffset = () => {
    if (maxPrice <= entryPrice) return 0;
    if (minPrice >= entryPrice) return 1;
    return (maxPrice - entryPrice) / (maxPrice - minPrice);
  };

  const off = gradientOffset();

  return (
    <div className="w-full h-24 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`splitColor-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset={off} stopColor="#ef4444" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <YAxis domain={[minPrice, maxPrice]} hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(28, 28, 30, 0.9)', 
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '12px'
            }}
            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
            labelStyle={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}
            formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Price']}
          />
          <ReferenceLine y={entryPrice} stroke="#888" strokeDasharray="3 3" opacity={0.5} />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={isProfit ? "#22c55e" : "#ef4444"} 
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#splitColor-${symbol})`} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
