"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { History } from "lucide-react";
import { motion } from "framer-motion";

export default function RecentTrades() {
  const { data: trades, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const hasTrades = trades && trades.length > 0;

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-neutral-500" />
          Recent Trades
        </h3>
      </div>

      <div className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="h-10 w-full rounded-lg glass-skeleton" />
            <div className="h-10 w-full rounded-lg glass-skeleton" />
            <div className="h-10 w-full rounded-lg glass-skeleton" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <div className="text-sm text-red-500 bg-red-500/10 p-4 rounded-xl">
              Failed to load recent trades.
            </div>
          </div>
        ) : !hasTrades ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400 text-sm">
            <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
              <History className="w-6 h-6 opacity-50" />
            </div>
            No trades executed yet.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/5 dark:bg-white/5 text-xs uppercase tracking-wider text-neutral-500 font-semibold">
                <th className="p-4 whitespace-nowrap">Time</th>
                <th className="p-4">Symbol</th>
                <th className="p-4">Side</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Price</th>
                <th className="p-4">Fee</th>
                <th className="p-4 whitespace-nowrap text-right">PnL (Fiat)</th>
                <th className="p-4 pr-6 whitespace-nowrap text-right">PnL %</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, i) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.5) }}
                  key={trade.timestamp + i} 
                  className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-sm"
                >
                  <td className="p-4 whitespace-nowrap text-neutral-500">
                    {new Date(trade.timestamp).toLocaleString(undefined, { 
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    }).replace(',', '')}
                  </td>
                  <td className="p-4 font-medium">{trade.symbol}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      trade.side.toLowerCase() === 'buy' 
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs">{trade.amount.toFixed(6)}</td>
                  <td className="p-4 font-mono text-xs">${trade.price.toFixed(2)}</td>
                  <td className="p-4 font-mono text-xs text-neutral-500">{trade.fee.toFixed(2)}</td>
                  <td className={`p-4 whitespace-nowrap text-right font-bold ${
                    trade.pnl_fiat > 0 ? 'text-green-500' : trade.pnl_fiat < 0 ? 'text-red-500' : 'text-neutral-500'
                  }`}>
                    {trade.pnl_fiat > 0 ? '+' : ''}{trade.pnl_fiat.toFixed(2)}
                  </td>
                  <td className={`p-4 pr-6 whitespace-nowrap text-right font-bold ${
                    trade.pnl_percent > 0 ? 'text-green-500' : trade.pnl_percent < 0 ? 'text-red-500' : 'text-neutral-500'
                  }`}>
                    {trade.pnl_percent > 0 ? '+' : ''}{trade.pnl_percent.toFixed(2)}%
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
