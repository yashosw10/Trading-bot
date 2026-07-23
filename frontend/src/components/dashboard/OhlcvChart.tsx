"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { BarChart2, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import CustomSelect from "../ui/CustomSelect";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import GlassCard from "@/components/ui/GlassCard";

export default function OhlcvChart({ activeCoin = "BTC/USDT" }: { activeCoin?: string }) {
  const { theme } = useTheme();
  const lineColor = theme === 'dark' ? '#a855f7' : '#111111';
  const volumeColor = theme === 'dark' ? '#6b7280' : '#9ca3af';
  const [timeRange, setTimeRange] = useState("1 Hour");
  const [indicatorType, setIndicatorType] = useState("NONE");
  
  const { queryInterval, queryLimit } = useMemo(() => {
    switch (timeRange) {
      case '15 Min': return { queryInterval: '1m', queryLimit: 15 };
      case '1 Hour': return { queryInterval: '1m', queryLimit: 60 };
      case '1 Day': return { queryInterval: '15m', queryLimit: 96 };
      case '1 Week': return { queryInterval: '1h', queryLimit: 168 };
      default: return { queryInterval: '1m', queryLimit: 60 };
    }
  }, [timeRange]);
  
  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ['ohlcv', activeCoin, timeRange],
    queryFn: () => api.getOhlcv(activeCoin, queryInterval, queryLimit),
    refetchInterval: 30000 // Auto-refresh every 30 seconds for real-time updates
  });

  const { data: trades } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const { data: indicatorData } = useQuery({
    queryKey: ['indicators', activeCoin, indicatorType, queryInterval],
    queryFn: () => api.getIndicators(activeCoin, indicatorType, queryInterval),
    enabled: indicatorType !== "NONE",
    refetchInterval: 30000
  });

  const chartData = useMemo(() => {
    if (!ohlcv || ohlcv.length === 0) return [];
    let merged = ohlcv.map((d: any) => ({
      ...d,
      time: (queryInterval === '1d' || queryInterval === '1h') 
        ? new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  
  const ranges = ['15 Min', '1 Hour', '1 Day', '1 Week'];
  const indicators = ['NONE', 'SMA', 'EMA', 'BOLLINGER', 'RSI', 'MACD'];

  return (
    <GlassCard className="overflow-hidden" isUpdating={isLoading}>
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
            {ranges.map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  timeRange === tr 
                    ? 'bg-white/50 dark:bg-black/50 text-neutral-900 dark:text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {tr}
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
                formatter={(value: any, name: any) => {
                  const valNum = Number(value || 0);
                  if (name === 'close') return [`$${valNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`, 'Price'];
                  if (name === 'volume') return [valNum.toLocaleString(undefined, { maximumFractionDigits: 2 }), 'Volume'];
                  return [value, name];
                }}
              />
              <Bar yAxisId="volume" dataKey="volume" fill={volumeColor} opacity={0.3} radius={[4,4,0,0]} />
              
              <Line 
                yAxisId="price"
                type="monotone" 
                dataKey="close" 
                stroke={lineColor} 
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
              
              {trades && chartData.length > 0 && trades
                .filter(t => t.symbol === activeCoin)
                .map(t => {
                  const isBuy = t.side?.toUpperCase() === 'BUY';
                  const tradeTs = new Date(t.timestamp).getTime();
                  // Snap to closest chartData point to ensure ReferenceLine renders on X-axis tick
                  const closest = chartData.reduce((prev: any, curr: any) => {
                    const prevDiff = Math.abs(new Date(prev.timestamp).getTime() - tradeTs);
                    const currDiff = Math.abs(new Date(curr.timestamp).getTime() - tradeTs);
                    return currDiff < prevDiff ? curr : prev;
                  }, chartData[0]);

                  // Only show marker if within the timeframe of current chart view
                  const minChartTs = new Date(chartData[0].timestamp).getTime();
                  const maxChartTs = new Date(chartData[chartData.length - 1].timestamp).getTime();
                  if (tradeTs < minChartTs - 300000 || tradeTs > maxChartTs + 300000) return null;

                  const priceLabel = t.price ? `@ $${Number(t.price).toFixed(2)}` : '';

                  return (
                    <ReferenceLine
                      key={`${t.timestamp}-${t.side}-${t.price}`}
                      x={closest.time}
                      yAxisId="price"
                      stroke={isBuy ? '#22c55e' : '#ef4444'}
                      strokeDasharray="3 3"
                      label={{ 
                        position: isBuy ? 'insideBottomLeft' : 'top',
                        value: `${isBuy ? '▲ BUY' : '▼ SELL'} ${priceLabel}`.trim(), 
                        fill: isBuy ? '#22c55e' : '#ef4444', 
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
    </GlassCard>
  );
}
