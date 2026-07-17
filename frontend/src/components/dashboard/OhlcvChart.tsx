"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { BarChart2, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import CustomSelect from "../ui/CustomSelect";
import { useMemo, useState } from "react";

export default function OhlcvChart({ activeCoin = "BTC/USDT" }: { activeCoin?: string }) {
  const [interval, setInterval] = useState("1h");
  const [indicatorType, setIndicatorType] = useState("NONE");
  
  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ['ohlcv', activeCoin, interval],
    queryFn: () => api.getOhlcv(activeCoin, interval)
  });

  const { data: trades } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const { data: indicatorData } = useQuery({
    queryKey: ['indicators', activeCoin, indicatorType, interval],
    queryFn: () => api.getIndicators(activeCoin, indicatorType, interval),
    enabled: indicatorType !== "NONE"
  });

  const chartData = useMemo(() => {
    if (!ohlcv || ohlcv.length === 0) return [];
    let merged = ohlcv.map((d: any) => ({
      ...d,
      time: interval === '1d' 
        ? new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullTime: new Date(d.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }));
    
    if (indicatorData && indicatorData.length > 0 && indicatorType !== "NONE") {
      merged = merged.map((d: any) => {
        const ind = indicatorData.find((i: any) => i.timestamp === d.timestamp);
        return { ...d, ...ind };
      });
    }
    
    return merged;
  }, [ohlcv, indicatorData, indicatorType]);

  const minPrice = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.min(...chartData.map((d: any) => d.low)) * 0.999;
  }, [chartData]);

  const maxPrice = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map((d: any) => d.high)) * 1.001;
  }, [chartData]);

  const hasData = chartData.length > 0;
  
  const timeframes = ['1m', '15m', '1h', '1d'];
  const indicators = ['NONE', 'SMA', 'EMA', 'BOLLINGER', 'RSI', 'MACD'];

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-neutral-500" />
          {activeCoin} Price Chart
        </h3>
        
        <div className="flex items-center gap-2">
          <div className="w-40">
            <CustomSelect 
              value={indicatorType}
              onChange={(val) => setIndicatorType(val)}
              options={indicators.map(ind => ({ label: ind === 'NONE' ? 'Indicators' : ind, value: ind }))}
            />
          </div>

          <div className="flex gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setInterval(tf)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  interval === tf 
                    ? 'bg-white dark:bg-[#1c1c1e] text-neutral-900 dark:text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 h-[400px] w-full">
        {isLoading ? (
          <div className="w-full h-full glass-skeleton rounded-xl" />
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400 text-sm">
            <BarChart2 className="w-8 h-8 opacity-50 mb-3" />
            Not enough data for chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }} 
                dy={10}
              />
              <YAxis 
                yAxisId="price"
                orientation="left"
                domain={[minPrice, maxPrice]}
                width={70}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              />
              <YAxis 
                yAxisId="volume" 
                orientation="right" 
                width={50} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(v) => `${(v/1000).toFixed(1)}K`} 
              />
              {(indicatorType === 'RSI' || indicatorType === 'MACD') && (
                <YAxis 
                  yAxisId="indicator" 
                  orientation="right" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#888' }}
                />
              )}
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(28, 28, 30, 0.9)', 
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                labelStyle={{ color: '#888', marginBottom: '8px' }}
                labelFormatter={(label, payload) => payload && payload.length > 0 ? payload[0].payload.fullTime : label}
                formatter={(value: number, name: string) => {
                  if (name === 'close') return [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`, 'Price'];
                  if (name === 'volume') return [value.toLocaleString(undefined, { maximumFractionDigits: 2 }), 'Volume'];
                  return [value, name];
                }}
              />
              <Bar yAxisId="volume" dataKey="volume" fill="#3b82f6" opacity={0.3} radius={[4,4,0,0]} />
              
              <Line 
                yAxisId="price"
                type="monotone" 
                dataKey="close" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />

              {/* Technical Indicators */}
              {(indicatorType === 'SMA' || indicatorType === 'EMA') && (
                <Line yAxisId="price" type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              )}
              {indicatorType === 'BOLLINGER' && (
                <>
                  <Line yAxisId="price" type="monotone" dataKey="upper" stroke="#8b5cf6" strokeWidth={1} dot={false} opacity={0.5} />
                  <Line yAxisId="price" type="monotone" dataKey="middle" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                  <Line yAxisId="price" type="monotone" dataKey="lower" stroke="#8b5cf6" strokeWidth={1} dot={false} opacity={0.5} />
                </>
              )}
              {indicatorType === 'RSI' && (
                <Line yAxisId="indicator" type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={false} />
              )}
              {indicatorType === 'MACD' && (
                <>
                  <Line yAxisId="indicator" type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line yAxisId="indicator" type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Bar yAxisId="indicator" dataKey="histogram" fill="#22c55e" opacity={0.5} />
                </>
              )}
              
              {trades && trades
                .filter(t => t.symbol === activeCoin)
                .map(t => {
                  const timeStr = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <ReferenceLine
                      key={t.timestamp}
                      x={timeStr}
                      yAxisId="price"
                      stroke={t.side === 'BUY' ? '#22c55e' : '#ef4444'}
                      strokeDasharray="3 3"
                      label={{ 
                        position: 'top',
                        value: t.side === 'BUY' ? '▲ BUY' : '▼ SELL', 
                        fill: t.side === 'BUY' ? '#22c55e' : '#ef4444', 
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}
                    />
                  );
                })
              }
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
