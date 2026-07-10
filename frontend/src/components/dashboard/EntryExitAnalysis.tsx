"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { MoveUpRight, MoveDownRight, LineChart } from "lucide-react";
import React, { useMemo } from "react";

export default function EntryExitAnalysis() {
  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const { avgMfe, avgMae, count } = useMemo(() => {
    if (!trades) return { avgMfe: 0, avgMae: 0, count: 0 };
    
    // MFE and MAE are only meaningful on SELL trades recorded by strategy
    const validTrades = trades.filter(t => t.side === 'sell' && (t.mfe > 0 || t.mae > 0));
    if (validTrades.length === 0) return { avgMfe: 0, avgMae: 0, count: 0 };

    const totalMfe = validTrades.reduce((acc, t) => acc + t.mfe, 0);
    const totalMae = validTrades.reduce((acc, t) => acc + t.mae, 0);

    return {
      avgMfe: totalMfe / validTrades.length,
      avgMae: totalMae / validTrades.length,
      count: validTrades.length
    };
  }, [trades]);

  if (isLoading) {
    return (
      <div className="glass-panel p-6 animate-pulse">
        <div className="h-48 bg-black/5 dark:bg-white/5 rounded-2xl"></div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-center h-48">
        <LineChart className="w-8 h-8 text-neutral-400 mb-2 opacity-50" />
        <h3 className="text-sm font-bold text-neutral-500">No MFE/MAE Data</h3>
        <p className="text-xs text-neutral-400 mt-1">Trades must be closed by strategy to calculate excursion.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <LineChart className="w-24 h-24 text-neutral-900 dark:text-white" />
      </div>

      <div className="relative z-10 mb-6">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Entry / Exit Analysis</h2>
        <p className="text-sm text-neutral-500">Maximum Favorable & Adverse Excursion (MFE / MAE)</p>
      </div>

      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Avg MFE</div>
            <MoveUpRight className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-black text-green-500 font-mono">
            +{avgMfe.toFixed(2)}%
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Avg peak profit seen while open
          </p>
        </div>

        <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Avg MAE</div>
            <MoveDownRight className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-500 font-mono">
            -{avgMae.toFixed(2)}%
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Avg peak loss seen while open
          </p>
        </div>
      </div>
    </div>
  );
}
