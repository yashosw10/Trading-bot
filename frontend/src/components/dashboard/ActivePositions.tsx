"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { Briefcase, ArrowUpRight } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { motion } from "framer-motion";
import { useLivePrice } from "@/hooks/useLivePrice";

function PositionRow({ symbol, amount, entryPrice }: { symbol: string, amount: number, entryPrice: number }) {
  const liveData = useLivePrice(symbol);
  const livePrice = liveData?.price_usd || entryPrice; // fallback to entry if loading
  const value = amount * livePrice;
  const pnl = value - (amount * entryPrice);
  const isProfit = pnl >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-black/5 dark:bg-white/5 p-4 rounded-2xl mb-4"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Symbol</p>
        <p className="font-bold flex items-center gap-1">
          {symbol} <ArrowUpRight className="w-4 h-4 text-blue-500" />
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Amount</p>
        <p className="font-bold">{amount.toFixed(6)} <span className="text-xs font-normal text-neutral-500">{symbol.split('/')[0]}</span></p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Avg Entry</p>
        <p className="font-bold">${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Current Value</p>
        <p className="font-bold">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Unrealized PnL</p>
        <p className={`font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
          {isProfit ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </motion.div>
  );
}

export default function ActivePositions() {
  const { data: positions, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.positions,
    queryFn: api.getPositions
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const symbols = config?.symbols || [];
  const activeSymbols = symbols.filter((sym: string) => positions?.[sym] && positions[sym].amount > 0);
  const hasPositions = activeSymbols.length > 0;

  return (
    <GlassCard className="overflow-hidden" isUpdating={isLoading}>
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-neutral-500" />
          Active Positions
        </h3>
        {hasPositions && (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
            {activeSymbols.length} Open
          </span>
        )}
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-20 w-full rounded-xl glass-skeleton" />
          </div>
        ) : isError ? (
          <div className="text-sm text-red-500 bg-red-500/10 p-4 rounded-xl">
            Failed to load positions data.
          </div>
        ) : !hasPositions ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
            <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 opacity-50" />
            </div>
            No active positions currently held.
          </div>
        ) : (
          <div>
            {activeSymbols.map((symbol: string) => {
              const pos = positions?.[symbol];
              if (!pos) return null;
              return (
                <PositionRow 
                  key={symbol}
                  symbol={symbol}
                  amount={pos.amount}
                  entryPrice={pos.average_price_usd}
                />
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
