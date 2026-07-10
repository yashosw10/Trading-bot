"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";

const INITIAL_BALANCE = 10000; // Assuming $10,000 initial USD for the demo/paper

export default function EquityCurve() {
  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    // Sort trades by timestamp ascending
    const chronologicalTrades = [...trades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const equityCurve = [];
    let currentBalance = INITIAL_BALANCE;
    
    for (const trade of chronologicalTrades) {
      currentBalance += trade.pnl_fiat;
      equityCurve.push({
        time: new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        balance: Number(currentBalance.toFixed(2))
      });
    }
    
    return equityCurve;
  }, [trades]);

  const hasData = chartData.length > 0;

  // Compute min/max to size the chart properly, allowing breathing room
  const minBalance = useMemo(() => {
    if (!chartData.length) return INITIAL_BALANCE;
    return Math.min(...chartData.map(d => d.balance), INITIAL_BALANCE) * 0.99;
  }, [chartData]);

  const maxBalance = useMemo(() => {
    if (!chartData.length) return INITIAL_BALANCE;
    return Math.max(...chartData.map(d => d.balance), INITIAL_BALANCE) * 1.01;
  }, [chartData]);

  // Compute the offset to transition from green to red correctly
  const gradientOffset = () => {
    const dataMax = Math.max(...chartData.map(i => i.balance), INITIAL_BALANCE);
    const dataMin = Math.min(...chartData.map(i => i.balance), INITIAL_BALANCE);

    if (dataMax <= INITIAL_BALANCE) return 0;
    if (dataMin >= INITIAL_BALANCE) return 1;

    return (dataMax - INITIAL_BALANCE) / (dataMax - dataMin);
  };

  const off = hasData ? gradientOffset() : 1;

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-neutral-500" />
          Equity Curve
        </h3>
      </div>

      <div className="p-6 h-[350px] w-full">
        {isLoading ? (
          <div className="w-full h-full glass-skeleton rounded-xl" />
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400 text-sm">
            <TrendingUp className="w-8 h-8 opacity-50 mb-3" />
            Not enough trade data for chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={off} stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset={off} stopColor="#ef4444" stopOpacity={0.3} />
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
                domain={[minBalance, maxBalance]}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
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
              <ReferenceLine y={INITIAL_BALANCE} stroke="#888" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Starting Balance', fill: '#888', fontSize: 10 }} />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#splitColor)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
