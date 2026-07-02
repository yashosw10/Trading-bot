"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { useMemo } from "react";

export default function PerformanceChart() {
  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    // Trades come sorted DESC by id (newest first). Reverse for chronological chart.
    const chronologicalTrades = [...trades].reverse();
    
    let cumulativePnl = 0;
    return chronologicalTrades.map(trade => {
      cumulativePnl += trade.pnl_fiat;
      return {
        time: new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pnl: Number(cumulativePnl.toFixed(2))
      };
    });
  }, [trades]);

  const hasData = chartData.length > 0;

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-neutral-500" />
          Performance (Cumulative PnL)
        </h3>
      </div>

      <div className="p-6 h-[300px] w-full">
        {isLoading ? (
          <div className="w-full h-full glass-skeleton rounded-xl" />
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400 text-sm">
            <LineChartIcon className="w-8 h-8 opacity-50 mb-3" />
            Not enough trade data for chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(28, 28, 30, 0.8)', 
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPnl)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
