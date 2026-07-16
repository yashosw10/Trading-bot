"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { TrendingUp, Target, Activity, AlertTriangle } from "lucide-react";
import { useMemo } from "react";

export default function AnalyticsCards() {
  const { data: config } = useQuery({
    queryKey: QUERY_KEYS.config,
    queryFn: api.getConfig
  });

  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const INITIAL_BALANCE = config?.starting_balance || 10000;

  const stats = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { winRate: 0, rr: 0, sharpe: 0, maxDD: 0, pnl: 0 };
    }

    const chronologicalTrades = [...trades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Basic PnL
    const wins = chronologicalTrades.filter(t => t.pnl_fiat > 0);
    const losses = chronologicalTrades.filter(t => t.pnl_fiat <= 0);
    
    // Win Rate
    const winRate = (wins.length / chronologicalTrades.length) * 100;

    // Average R:R
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl_fiat, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl_fiat, 0) / losses.length) : 0;
    const rr = avgLoss === 0 ? (avgWin > 0 ? Infinity : 0) : avgWin / avgLoss;

    // Build equity curve and group by day for Sharpe
    interface EquityPoint {
      balance: number;
    }
    const equityCurve: EquityPoint[] = [];
    let currentBalance = INITIAL_BALANCE;
    const dailyBalances: Record<string, number[]> = {};

    chronologicalTrades.forEach(trade => {
      currentBalance += trade.pnl_fiat;
      equityCurve.push({ balance: currentBalance });
      
      const day = new Date(trade.timestamp).toISOString().split('T')[0];
      if (!dailyBalances[day]) dailyBalances[day] = [];
      dailyBalances[day].push(currentBalance);
    });

    // Daily returns (using last balance of each day)
    const days = Object.keys(dailyBalances).sort();
    const dailyReturns = [];
    let prevEodBalance = INITIAL_BALANCE;

    for (const day of days) {
      const eodBalance = dailyBalances[day][dailyBalances[day].length - 1];
      const pctReturn = (eodBalance - prevEodBalance) / prevEodBalance;
      dailyReturns.push(pctReturn);
      prevEodBalance = eodBalance;
    }

    let sharpe = 0;
    if (dailyReturns.length > 0) {
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      let varianceSum = dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0);
      
      if (varianceSum === 0 && mean > 0) {
        sharpe = Infinity;
      } else if (varianceSum === 0) {
        sharpe = 0;
      } else {
        const std = Math.sqrt(varianceSum / dailyReturns.length);
        sharpe = (mean / std) * Math.sqrt(365);
      }
    }

    // Max Drawdown
    let peak = INITIAL_BALANCE;
    let maxDD = 0;
    
    equityCurve.forEach(({ balance }) => {
      if (balance > peak) peak = balance;
      const dd = (peak - balance) / peak;
      if (dd > maxDD) maxDD = dd;
    });

    const totalPnl = currentBalance - INITIAL_BALANCE;

    return { 
      winRate, 
      rr, 
      sharpe, 
      maxDD: maxDD * 100,
      pnl: totalPnl 
    };
  }, [trades]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl glass-skeleton" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      icon: Target,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Avg R:R",
      value: stats.rr === Infinity ? "∞" : stats.rr.toFixed(2),
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      title: "Sharpe Ratio",
      value: stats.sharpe === Infinity ? "∞" : stats.sharpe.toFixed(2),
      icon: Activity,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Max Drawdown",
      value: `-${stats.maxDD.toFixed(2)}%`,
      icon: AlertTriangle,
      color: "text-red-500",
      bg: "bg-red-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="liquid-glass-card p-6 flex flex-col items-center justify-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${c.bg}`}>
              <Icon className={`w-6 h-6 ${c.color}`} />
            </div>
            <p className="text-sm font-medium text-neutral-500 mb-1">{c.title}</p>
            <p className={`text-2xl font-bold ${c.title === 'Max Drawdown' ? 'text-red-500' : ''}`}>
              {c.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
