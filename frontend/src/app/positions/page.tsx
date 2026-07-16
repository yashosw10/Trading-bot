"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Activity, Briefcase, TrendingUp, TrendingDown, Clock, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, WS_URL } from "@/lib/api";
import { wsManager } from "@/lib/ws";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { motion } from "framer-motion";

export default function PositionsPage() {
  const { data: positions, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.positions,
    queryFn: api.getPositions
  });

  // Store live prices mapped by symbol
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => {
    wsManager.sendMessage({ action: "subscribe", channel: "prices" });
    setConnectionState("connected");

    const unsubscribe = wsManager.subscribe((data) => {
      if (data.type === "ticker" || data.symbol) {
        if (data.price_usd === undefined) {
          console.warn('[WS] price_usd missing on prices payload', data);
        } else {
          setLivePrices(prev => ({
            ...prev,
            [data.symbol]: parseFloat(data.price_usd)
          }));
        }
      }
    });

    return unsubscribe;
  }, []);

  const openPositions = positions 
    ? Object.entries(positions).map(([symbol, data]) => ({ symbol, ...data })).filter(p => p.amount > 0)
    : [];

  const totalUnrealisedPnL = openPositions.reduce((sum, pos) => {
    const currentPrice = livePrices[pos.symbol] || pos.average_price_usd;
    return sum + ((currentPrice - pos.average_price_usd) * pos.amount);
  }, 0);
  const isTotalProfit = totalUnrealisedPnL >= 0;

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-500" />
            </div>
            Active Positions
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Monitor your open positions with live market prices and real-time PnL.
          </p>
        </div>

        {openPositions.length > 0 && (
          <div className="liquid-glass-card px-6 py-4 rounded-2xl flex items-center gap-6">
             <div>
               <p className="text-xs text-neutral-500 font-medium mb-1">Total Unrealised PnL</p>
               <div className={`text-xl font-bold flex items-center gap-1 ${connectionState === "disconnected" ? "text-neutral-500" : isTotalProfit ? "text-green-500" : "text-red-500"}`}>
                 {connectionState === "disconnected" ? "—" : (
                   <>
                     {isTotalProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                     {isTotalProfit ? '+' : ''}{totalUnrealisedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </>
                 )}
               </div>
             </div>
             <div className="h-10 w-px bg-black/10 dark:bg-white/10" />
             <div className="flex flex-col items-start justify-center">
               <p className="text-xs text-neutral-500 font-medium mb-1">Feed Status</p>
               <div className="flex items-center gap-1.5">
                 <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-500 animate-pulse' : connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                 <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                   {connectionState}
                 </span>
               </div>
             </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 w-full rounded-2xl glass-skeleton" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red-500 bg-red-500/10 p-6 rounded-2xl liquid-glass-card flex items-center gap-3">
          <Activity className="w-6 h-6" />
          <p>Failed to load positions snapshot. Ensure backend is running.</p>
        </div>
      ) : openPositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-500 dark:text-neutral-400 liquid-glass-card">
          <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">No Active Positions</h3>
          <p className="text-sm">You do not currently hold any assets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {openPositions.map((pos, i) => {
            const currentPrice = livePrices[pos.symbol] || pos.average_price_usd; // Fallback to entry if no live tick yet
            const unrealisedPnl = (currentPrice - pos.average_price_usd) * pos.amount;
            const pnlPercent = (unrealisedPnl / (pos.average_price_usd * pos.amount)) * 100;
            const isProfit = unrealisedPnl >= 0;

            return (
              <motion.div
                key={pos.symbol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`liquid-glass-card p-6 relative overflow-hidden group transition-all duration-300 ${
                  connectionState === 'disconnected' ? 'opacity-80' : isProfit ? 'shadow-[0_0_30px_rgba(34,197,94,0.05)]' : 'shadow-[0_0_30px_rgba(239,68,68,0.05)]'
                }`}
              >
                {/* Realtime pulse indicator */}
                <div className="absolute top-6 right-6 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Live</span>
                  <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-500'}`} />
                </div>

                <h2 className="text-2xl font-bold tracking-tight mb-6">{pos.symbol}</h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5">
                    <p className="text-xs font-medium text-neutral-500 mb-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Quantity
                    </p>
                    <p className="font-mono font-semibold">{pos.amount.toFixed(6)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5">
                    <p className="text-xs font-medium text-neutral-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Entry Price
                    </p>
                    <p className="font-mono font-semibold">${pos.average_price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-black/10 dark:border-white/10 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 mb-1">Current Price</p>
                    <p className="font-mono text-lg font-bold">
                      {connectionState === 'disconnected' ? "—" : `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-500 mb-1">Unrealised PnL</p>
                    <div className={`flex items-center justify-end gap-1 font-bold ${connectionState === 'disconnected' ? 'text-neutral-500' : isProfit ? 'text-green-500' : 'text-red-500'}`}>
                      {connectionState === 'disconnected' ? "—" : (
                        <>
                          {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {isProfit ? '+' : ''}{unrealisedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
