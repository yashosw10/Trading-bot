"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";

export default function DailyPnLChart() {
  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    const dailyPnL: Record<string, number> = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.timestamp);
      // Group by YYYY-MM-DD
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!dailyPnL[dateString]) {
        dailyPnL[dateString] = 0;
      }
      dailyPnL[dateString] += trade.pnl_fiat || 0;
    });

    // Convert to array and sort by date
    const sortedDates = Object.keys(dailyPnL).sort();
    return sortedDates.map(date => ({
      date,
      pnl: dailyPnL[date]
    }));
  }, [trades]);

  if (isLoading) {
    return (
      <div className="glass-panel p-6 h-[400px] animate-pulse flex flex-col">
        <div className="h-6 w-48 bg-black/10 dark:bg-white/10 rounded mb-8"></div>
        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-xl"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pnl = payload[0].value;
      const isPositive = pnl >= 0;
      return (
        <div className="bg-white/40 dark:bg-black/60 backdrop-blur-md border border-white/20 dark:border-white/10 p-3 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
          <p className="text-neutral-500 text-sm mb-1">{label}</p>
          <p className={`font-bold text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}${pnl.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel p-6 h-[400px] flex flex-col group relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 group-hover:bg-blue-500/10 transition-colors duration-500"></div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Daily PnL</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-neutral-200 dark:text-neutral-800" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#888888', fontSize: 12 }}
                tickFormatter={(val) => val.slice(5)} // Show MM-DD
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#888888', fontSize: 12 }}
                tickFormatter={(val) => `$${val}`}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <ReferenceLine y={0} stroke="#888888" strokeDasharray="3 3" />
              <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500">
            No daily PnL data available yet.
          </div>
        )}
      </div>
    </div>
  );
}
