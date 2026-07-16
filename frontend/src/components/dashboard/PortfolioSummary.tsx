"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import type { Currency } from "@/types/api";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, PieChart, Activity } from "lucide-react";
import { useMemo } from "react";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

export default function PortfolioSummary({ currency }: { currency: Currency }) {
  const { data: balances, isLoading: loadingBalances, isError: errB } = useQuery({
    queryKey: QUERY_KEYS.balances,
    queryFn: api.getBalances
  });

  const { data: invested, isLoading: loadingInvested, isError: errI } = useQuery({
    queryKey: QUERY_KEYS.invested,
    queryFn: api.getInvested
  });

  const { data: profit, isLoading: loadingProfit, isError: errP } = useQuery({
    queryKey: QUERY_KEYS.totalProfit(currency),
    queryFn: () => api.getTotalProfit(currency)
  });

  const { data: trades, isLoading: loadingTrades, isError: errT } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const { data: fxRates } = useQuery({
    queryKey: ['fxRates'],
    queryFn: api.getFxRates
  });

  const { dailyPnL, weeklyPnL, monthlyPnL } = useMemo(() => {
    if (!trades) return { dailyPnL: 0, weeklyPnL: 0, monthlyPnL: 0 };
    
    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    let dPnL = 0;
    let wPnL = 0;
    let mPnL = 0;

    // We filter by side === 'sell' because PnL is realized and timestamp corresponds to closed_at
    const sellTrades = trades.filter(t => t.side === 'sell');

    sellTrades.forEach(t => {
      const closedAt = new Date(t.timestamp);
      // convert fiat PnL to current selected currency
      const usd_to_inr = fxRates?.INR ?? 83.0;
      const usd_to_eur = fxRates?.EUR ?? 0.92;
      let pnl = t.pnl_fiat;
      if (currency === 'INR') pnl *= usd_to_inr;
      else if (currency === 'EUR') pnl *= usd_to_eur;

      if (closedAt >= dayStart) dPnL += pnl;
      if (closedAt >= weekStart) wPnL += pnl;
      if (closedAt >= monthStart) mPnL += pnl;
    });

    return { dailyPnL: dPnL, weeklyPnL: wPnL, monthlyPnL: mPnL };
  }, [trades, currency, fxRates]);

  const isLoading = loadingBalances || loadingInvested || loadingProfit;
  const isError = errB || errI || errP;

  if (isError) {
    return (
      <div className="liquid-glass-card p-6 border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center text-center">
        <Activity className="w-8 h-8 text-red-500 mb-2" />
        <h3 className="text-red-500 font-medium">Connection Error</h3>
        <p className="text-sm text-red-400/80">Cannot connect to the Trading Bot API.</p>
      </div>
    );
  }

  const formatMoney = (val: number | undefined) => 
    val !== undefined ? `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---';

  const balanceVal = balances?.[currency] || 0;
  const investedVal = invested?.[currency] || 0;
  const profitVal = profit?.total_profit || 0;
  


  const totalValue = balanceVal + investedVal;

  const isProfit = profitVal >= 0;

  const metrics = [
    {
      label: "Available Balance",
      value: formatMoney(balanceVal),
      icon: Wallet,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      label: "Total Invested",
      value: formatMoney(investedVal),
      icon: PieChart,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      label: "Total Profit",
      value: formatMoney(profitVal),
      icon: isProfit ? TrendingUp : TrendingDown,
      color: isProfit ? "text-green-500" : "text-red-500",
      bg: isProfit ? "bg-green-500/10" : "bg-red-500/10",
      isProfitVal: true
    },

    {
      label: "Portfolio Value",
      value: formatMoney(totalValue),
      icon: Activity,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`liquid-glass-card p-5 flex flex-col relative overflow-hidden group ${
            m.isProfitVal && isProfit ? 'shadow-[0_0_24px_rgba(34,197,94,0.15)]' : ''
          } ${m.isProfitVal && !isProfit ? 'shadow-[0_0_24px_rgba(239,68,68,0.15)]' : ''}`}
        >
          {/* Specular highlight on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="flex justify-between items-start mb-4 relative">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{m.label}</p>
            <div className={`p-2 rounded-xl ${m.bg}`}>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
          </div>

          {isLoading ? (
            <div className="h-8 w-24 rounded-lg glass-skeleton mt-auto relative" />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight relative mt-auto text-neutral-900 dark:text-neutral-50">
              {m.value}
            </h2>
          )}
        </motion.div>
      ))}

      {/* Aggregate Time-bucketed PnL */}
      <div className="md:col-span-2 xl:col-span-5 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <PnLPill label="Daily PnL" value={dailyPnL} currency={currency} isLoading={loadingTrades} />
        <PnLPill label="Weekly PnL" value={weeklyPnL} currency={currency} isLoading={loadingTrades} />
        <PnLPill label="Monthly PnL" value={monthlyPnL} currency={currency} isLoading={loadingTrades} />
      </div>
    </div>
  );
}

function PnLPill({ label, value, currency, isLoading }: { label: string, value: number, currency: string, isLoading: boolean }) {
  if (isLoading) {
    return <div className="liquid-glass-card h-12 glass-skeleton rounded-xl border border-black/5 dark:border-white/5" />;
  }
  const isProfit = value >= 0;
  return (
    <div className="liquid-glass-card p-4 rounded-xl border border-black/5 dark:border-white/5 flex items-center justify-between">
      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className={`text-base font-bold font-mono ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
        {isProfit ? '+' : ''}{currency} {Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
