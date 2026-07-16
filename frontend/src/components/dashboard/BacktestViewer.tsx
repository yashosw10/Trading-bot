"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart3, AlertCircle, TrendingUp, TrendingDown, Target, Activity, Clock } from "lucide-react";
import React from "react";

export default function BacktestViewer() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['latest_backtest'],
    queryFn: api.getLatestBacktest,
    retry: false
  });

  if (isLoading) {
    return (
      <div className="glass-panel p-6 animate-pulse space-y-4">
        <div className="h-6 w-48 bg-black/10 dark:bg-white/10 rounded"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-black/5 dark:bg-white/5 rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  // Handle 404 cleanly
  if (error && ((error as any).message?.includes("404") || (error as any).message?.includes("No backtest"))) {
    return (
      <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">No backtest runs yet</h3>
        <p className="text-neutral-500 max-w-md">Run a backtest from the strategy engine to see historical simulation results here.</p>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const isMock = Boolean(data.is_mock);

  return (
    <div className="glass-panel overflow-hidden">
      {isMock && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-500 px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold">
          <AlertCircle className="w-4 h-4" />
          Sample data — no real backtest has been run yet
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <BarChart3 className="text-blue-500" />
              Latest Backtest Results
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {data.strategy} ({data.start_date} to {data.end_date})
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-neutral-500">Initial Balance</div>
            <div className="font-mono font-bold">${data.initial_balance?.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Return" 
            value={`${data.total_return_pct?.toFixed(2)}%`}
            icon={<TrendingUp className="w-5 h-5 text-green-500" />}
            colorClass="text-green-500"
          />
          <StatCard 
            title="Win Rate" 
            value={`${(data.win_rate * 100)?.toFixed(1)}%`}
            icon={<Target className="w-5 h-5 text-blue-500" />}
          />
          <StatCard 
            title="Max Drawdown" 
            value={`${data.max_drawdown_pct?.toFixed(2)}%`}
            icon={<TrendingDown className="w-5 h-5 text-red-500" />}
            colorClass="text-red-500"
          />
          <StatCard 
            title="Profit Factor" 
            value={data.profit_factor?.toFixed(2)}
            icon={<Activity className="w-5 h-5 text-purple-500" />}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-black/5 dark:border-white/5 text-sm">
          <div>
            <span className="text-neutral-500 block text-xs uppercase tracking-wider mb-1">Final Balance</span>
            <span className="font-mono font-bold">${data.final_balance?.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-xs uppercase tracking-wider mb-1">Total Trades</span>
            <span className="font-mono font-bold">{data.total_trades}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-xs uppercase tracking-wider mb-1">Avg Trade Time</span>
            <span className="font-mono font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> {data.avg_trade_duration_hours?.toFixed(1)}h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, colorClass = "text-neutral-900 dark:text-white" }: { title: string, value: string | number, icon: React.ReactNode, colorClass?: string }) {
  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 flex flex-col justify-between">
      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="flex items-end justify-between">
        <div className={`text-2xl font-black font-mono ${colorClass}`}>
          {value}
        </div>
        <div className="p-2 bg-white dark:bg-[#1a1a1f] rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}
