"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Send, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export default function ManualOrder() {
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const orderMutation = useMutation({
    mutationFn: () => api.placeOrder({ symbol, side, amount: parseFloat(amount) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['invested'] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast.success(res.message || "Manual order executed successfully!");
      setAmount("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to execute manual order.");
    }
  });

  const isLive = config?.mode === 'live';
  const isValid = parseFloat(amount) > 0 && symbol.length > 0;

  return (
    <div className="glass-panel p-6 flex flex-col h-full relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Send className="w-24 h-24 text-neutral-900 dark:text-white" />
      </div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Manual Order</h2>
          <p className="text-sm text-neutral-500">Bypass strategy and place a trade directly.</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 relative z-10">
        <div className="grid grid-cols-2 gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setSide("buy")}
            className={`py-2 rounded-lg text-sm font-bold transition-all ${
              side === "buy" ? "bg-green-500 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            BUY
          </button>
          <button
            onClick={() => setSide("sell")}
            className={`py-2 rounded-lg text-sm font-bold transition-all ${
              side === "sell" ? "bg-red-500 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            SELL
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider pl-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-full bg-white/40 dark:bg-black/70 border border-white/20 dark:border-[rgba(100,255,255,0.2)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 uppercase dark:text-white"
            placeholder="BTC/USDT"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider pl-1">Amount (Crypto)</label>
          <input
            type="number"
            step="0.0001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/40 dark:bg-black/70 border border-white/20 dark:border-[rgba(100,255,255,0.2)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:text-white"
            placeholder="0.01"
          />
        </div>
      </div>

      <div className="mt-6 relative z-10">
        <button
          onClick={() => orderMutation.mutate()}
          disabled={!isValid || orderMutation.isPending}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
            ${!isValid || orderMutation.isPending 
              ? 'bg-black/5 dark:bg-white/5 text-neutral-400 cursor-not-allowed' 
              : 'bg-[#224488] hover:bg-blue-800 text-white shadow-[0_0_10px_rgba(34,68,136,0.5)] dark:shadow-[0_0_15px_rgba(34,68,136,0.8)]'
            }`}
        >
          {orderMutation.isPending ? "Executing..." : `EXECUTE ${side.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
