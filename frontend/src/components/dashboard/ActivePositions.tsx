"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { Briefcase, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ActivePositions() {
  const { data: positions, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.positions,
    queryFn: api.getPositions
  });

  const btcPos = positions?.["BTC/USDT"];
  const hasPosition = btcPos && btcPos.amount > 0;

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-neutral-500" />
          Active Positions
        </h3>
        {hasPosition && (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
            1 Open
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
        ) : !hasPosition ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
            <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 opacity-50" />
            </div>
            No active positions currently held.
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Symbol</p>
              <p className="font-bold flex items-center gap-1">
                BTC/USDT <ArrowUpRight className="w-4 h-4 text-blue-500" />
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Amount</p>
              <p className="font-bold">{btcPos.amount.toFixed(6)} <span className="text-xs font-normal text-neutral-500">BTC</span></p>
            </div>
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Avg Price</p>
              <p className="font-bold">${btcPos.average_price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Value (USD Est)</p>
              <p className="font-bold text-amber-600 dark:text-amber-400">
                ${(btcPos.amount * btcPos.average_price_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
