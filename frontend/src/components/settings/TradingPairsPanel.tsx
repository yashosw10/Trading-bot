"use client";

import { Coins, Save, Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function TradingPairsPanel() {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const [symbols, setSymbols] = useState<string[]>([]);
  const [newSymbol, setNewSymbol] = useState("");

  useEffect(() => {
    if (config?.symbols) {
      setSymbols(config.symbols);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = newSymbol.trim().toUpperCase();
    if (symbol && !symbols.includes(symbol)) {
      const updated = [...symbols, symbol];
      setSymbols(updated);
      setNewSymbol("");
      mutation.mutate({ symbols: updated });
    }
  };

  const handleRemove = (symbolToRemove: string) => {
    const updated = symbols.filter(s => s !== symbolToRemove);
    setSymbols(updated);
    mutation.mutate({ symbols: updated });
  };

  if (isLoading) {
    return <div className="liquid-glass-card p-6 h-64 glass-skeleton rounded-2xl" />;
  }

  return (
    <div className="liquid-glass-card p-6 border border-blue-500/10">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Coins className="w-5 h-5 text-blue-500" />
        Trading Pairs
      </h3>
      
      <p className="text-sm text-neutral-500 mb-4">
        Add or remove cryptocurrency pairs for the bot to trade (e.g. BTC/USDT).
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {symbols.map(symbol => (
          <div key={symbol} className="flex items-center gap-2 bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded-lg text-sm font-semibold">
            {symbol}
            <button 
              onClick={() => handleRemove(symbol)}
              className="hover:bg-blue-500/20 p-0.5 rounded-md transition-colors"
              title={`Remove ${symbol}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="e.g. ZEC/USDT"
          className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500/50 uppercase"
        />
        <button 
          type="submit" 
          disabled={!newSymbol.trim() || mutation.isPending}
          className="liquid-glass-button bg-blue-500/10 text-blue-500 px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {mutation.isPending ? <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Pair
        </button>
      </form>
    </div>
  );
}
