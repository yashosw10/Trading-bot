"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { History, Search, Download, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { motion } from "framer-motion";
import EntryExitAnalysis from "@/components/dashboard/EntryExitAnalysis";

export default function HistoryPage() {
  const { data: trades, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.trades,
    queryFn: api.getTrades
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"timestamp" | "pnl_fiat">("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredAndSortedTrades = useMemo(() => {
    if (!trades) return [];
    
    let result = trades.filter(t => 
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.side.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      if (sortField === "timestamp") {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      } else {
        return sortDirection === "asc" ? a.pnl_fiat - b.pnl_fiat : b.pnl_fiat - a.pnl_fiat;
      }
    });

    return result;
  }, [trades, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedTrades.length / itemsPerPage);
  const paginatedTrades = filteredAndSortedTrades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSort = (field: "timestamp" | "pnl_fiat") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const downloadCSV = () => {
    if (!trades || trades.length === 0) return;
    
    const headers = ["Timestamp", "Symbol", "Side", "Amount", "Price", "Fee", "PnL (Fiat)", "PnL (%)"];
    const rows = filteredAndSortedTrades.map(t => [
      new Date(t.timestamp).toISOString(),
      t.symbol,
      t.side,
      t.amount.toString(),
      t.price.toString(),
      t.fee.toString(),
      t.pnl_fiat.toString(),
      t.pnl_percent.toString()
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_history_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <History className="w-6 h-6 text-purple-500" />
            </div>
            Trade History
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Review and export your complete trading activity.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Filter by symbol..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-md transition-all text-sm"
            />
          </div>
          
          <button 
            onClick={downloadCSV}
            disabled={!trades || trades.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl liquid-glass-button text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <EntryExitAnalysis />
      </div>

      <div className="liquid-glass-card overflow-hidden flex flex-col min-h-[600px]">
        <div className="flex-1 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 w-full rounded-lg glass-skeleton" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6">
              <div className="text-sm text-red-500 bg-red-500/10 p-4 rounded-xl">
                Failed to load trade history. Please try again.
              </div>
            </div>
          ) : paginatedTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500 dark:text-neutral-400 text-sm">
              <History className="w-8 h-8 opacity-50 mb-3" />
              No trades match your criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-black/5 dark:border-white/5">
                  <th className="p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => toggleSort("timestamp")}>
                    <div className="flex items-center gap-1">Time <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4">Symbol</th>
                  <th className="p-4">Side</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Fee</th>
                  <th className="p-4 text-right cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => toggleSort("pnl_fiat")}>
                    <div className="flex items-center justify-end gap-1">PnL (Fiat) <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 text-right">PnL %</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrades.map((trade, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.05, 0.3) }}
                    key={trade.timestamp + i} 
                    className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-sm"
                  >
                    <td className="p-4 whitespace-nowrap text-neutral-500">
                      {new Date(trade.timestamp).toLocaleString(undefined, { 
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                      }).replace(',', '')}
                    </td>
                    <td className="p-4 font-bold">{trade.symbol}</td>
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
                    <td className={`p-4 text-right font-bold ${
                      trade.pnl_fiat > 0 ? 'text-green-500' : trade.pnl_fiat < 0 ? 'text-red-500' : 'text-neutral-500'
                    }`}>
                      {trade.pnl_fiat > 0 ? '+' : ''}{trade.pnl_fiat.toFixed(2)}
                    </td>
                    <td className={`p-4 text-right font-bold ${
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02] mt-auto">
            <p className="text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-neutral-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredAndSortedTrades.length)}</span> of <span className="font-medium text-neutral-900 dark:text-white">{filteredAndSortedTrades.length}</span> trades
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white/50 dark:bg-black/50 border border-black/5 dark:border-white/5 disabled:opacity-50 text-neutral-600 dark:text-neutral-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-xs font-medium px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white/50 dark:bg-black/50 border border-black/5 dark:border-white/5 disabled:opacity-50 text-neutral-600 dark:text-neutral-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
