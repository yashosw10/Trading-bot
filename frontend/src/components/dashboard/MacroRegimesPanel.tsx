"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Activity, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";

export default function MacroRegimesPanel() {
  const queryClient = useQueryClient();
  
  const { data: macroRegimes, isLoading, error } = useQuery({
    queryKey: ["macroRegimes"],
    queryFn: api.getMacroRegimes,
    refetchInterval: 30000,
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshMacroRegimes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["macroRegimes"] });
    }
  });

  if (isLoading) {
    return (
      <div className="liquid-glass-card p-6 h-[400px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-neutral-500">Analyzing Macro Trends...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="liquid-glass-card p-6 h-[400px] flex items-center justify-center">
        <span className="text-red-500/80">Failed to load macro regimes.</span>
      </div>
    );
  }

  const regimes = macroRegimes || {};
  const symbols = Object.keys(regimes).sort();

  return (
    <div className="liquid-glass-card p-6 relative overflow-hidden group">
      <div className="glass-shimmer-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight">Macro Trend Analysis</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400"></p>
          </div>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white disabled:opacity-50 relative z-10"
          title="Refresh Regimes"
        >
          <RefreshCw className={`w-5 h-5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/5 text-sm text-neutral-500 dark:text-neutral-400">
              <th className="pb-3 font-medium">Asset</th>
              <th className="pb-3 font-medium">Current Price</th>
              <th className="pb-3 font-medium">70-Day SMA</th>
              <th className="pb-3 font-medium">Macro Regime</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {symbols.map((symbol) => {
              const data = regimes[symbol];
              const isBull = data.regime === "bull";
              
              const priceFormat = data.price < 10 ? 4 : 2;
              const formattedPrice = data.price ? `$${data.price.toFixed(priceFormat)}` : "N/A";
              const formattedSma = data.sma_70d ? `$${data.sma_70d.toFixed(priceFormat)}` : "N/A";

              return (
                <tr key={symbol} className="border-b border-black/10 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 font-medium text-neutral-900 dark:text-white">{symbol}</td>
                  <td className="py-4 text-neutral-800 dark:text-neutral-200">{formattedPrice}</td>
                  <td className="py-4 text-neutral-600 dark:text-neutral-400">{formattedSma}</td>
                  <td className="py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                      isBull 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                    }`}>
                      {isBull ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {data.regime.toUpperCase()}
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {symbols.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutral-500">
                  No coins are currently active. Update your settings to add coins.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
