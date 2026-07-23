"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

export default function PerSymbolBreakdown() {
  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const chartData = useMemo(() => {
    if (!trades) return [];
    
    const pnlBySymbol = trades.reduce((acc, trade) => {
      if (trade.side === 'sell') {
        acc[trade.symbol] = (acc[trade.symbol] || 0) + trade.pnl_fiat;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(pnlBySymbol)
      .map(([symbol, pnl]) => ({ symbol, pnl }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  if (isLoading) {
    return (
      <div className="liquid-glass-card p-6 min-h-[350px] animate-pulse">
        <div className="h-64 bg-black/5 dark:bg-white/5 rounded-xl"></div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="liquid-glass-card p-6 min-h-[350px] flex flex-col items-center justify-center text-neutral-500">
        <PieChartIcon className="w-8 h-8 opacity-20 mb-3" />
        <p>No trades available for breakdown.</p>
      </div>
    );
  }

  return (
    <div className="liquid-glass-card p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <PieChartIcon className="w-24 h-24 text-neutral-900 dark:text-white" />
      </div>

      <div className="mb-6 relative z-10">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-indigo-500" />
          Per-Symbol Breakdown
        </h3>
        <p className="text-sm text-neutral-500">Realized PnL grouped by asset.</p>
      </div>

      <div className="h-64 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="symbol" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#888' }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
              tick={{ fontSize: 12, fill: '#888' }}
              dx={-10}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="bg-white/40 dark:bg-black/60 border border-white/20 dark:border-white/10 p-3 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md">
                      <p className="font-bold text-sm text-neutral-900 dark:text-white">{payload[0].payload.symbol}</p>
                      <p className={`text-sm font-bold ${val >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {val >= 0 ? '+' : ''}${val.toFixed(2)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
