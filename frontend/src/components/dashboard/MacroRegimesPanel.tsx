"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";

export default function MacroRegimesPanel() {
  const { data: macroRegimes, isLoading, error } = useQuery({
    queryKey: ["macroRegimes"],
    queryFn: api.getMacroRegimes,
    refetchInterval: 30000,
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
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">Macro Trend Analysis</h3>
            <p className="text-sm text-neutral-400">70-Day SMA Regime Detection (Auto-Tune AI)</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-sm text-neutral-400">
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
                <tr key={symbol} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 font-medium text-white">{symbol}</td>
                  <td className="py-4 text-neutral-200">{formattedPrice}</td>
                  <td className="py-4 text-neutral-400">{formattedSma}</td>
                  <td className="py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                      isBull 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-red-500/10 text-red-400 border-red-500/20"
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
