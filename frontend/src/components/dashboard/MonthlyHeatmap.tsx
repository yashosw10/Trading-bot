"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { Calendar } from "lucide-react";
import { useMemo } from "react";

export default function MonthlyHeatmap() {
  const { data: trades, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const heatmapData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Group by YYYY-MM
    const monthlyPnL: Record<string, number> = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.timestamp);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyPnL[monthYear]) {
        monthlyPnL[monthYear] = 0;
      }
      // Assuming trade.pnl_percent represents the return.
      // Wait, we can sum the pnl_percent, or sum fiat. Let's sum fiat for simplicity, or we can use pnl_percent.
      // If we use PnL %, sum of PnL % across trades isn't exactly monthly return, but we'll use it as a proxy for the heatmap intensity.
      monthlyPnL[monthYear] += trade.pnl_percent;
    });

    const sortedMonths = Object.keys(monthlyPnL).sort();
    return sortedMonths.map(month => ({
      month,
      return: monthlyPnL[month]
    }));
  }, [trades]);

  const getColor = (value: number) => {
    if (value > 20) return "bg-green-500 text-white";
    if (value > 10) return "bg-green-500/80 text-white";
    if (value > 5) return "bg-green-500/60 text-white";
    if (value > 0) return "bg-green-500/40 text-green-900 dark:text-green-100";
    if (value === 0) return "bg-neutral-200 dark:bg-neutral-800 text-neutral-500";
    if (value > -5) return "bg-red-500/40 text-red-900 dark:text-red-100";
    if (value > -10) return "bg-red-500/60 text-white";
    if (value > -20) return "bg-red-500/80 text-white";
    return "bg-red-500 text-white";
  };

  const formatMonth = (yyyyMM: string) => {
    const [year, month] = yyyyMM.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-neutral-500" />
          Monthly Returns Heatmap
        </h3>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="w-full h-32 glass-skeleton rounded-xl" />
        ) : heatmapData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-500 dark:text-neutral-400 text-sm">
            <Calendar className="w-8 h-8 opacity-50 mb-3" />
            No trading history available.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {heatmapData.map((data) => (
              <div 
                key={data.month} 
                className={`p-4 rounded-xl flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-default shadow-sm ${getColor(data.return)}`}
              >
                <span className="text-xs font-medium opacity-80 mb-1">{formatMonth(data.month)}</span>
                <span className="text-lg font-bold">
                  {data.return > 0 ? '+' : ''}{data.return.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
