"use client";

import { Sliders, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function StrategyTuningPanel() {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const [formData, setFormData] = useState<any>({
    auto_tune_enabled: false,
    base_order: 100.0,
    volume_multiplier: 1.35,
    max_dca_layers: 4,
    per_trade_stop_pct: 8.0,
    rsi_entry_gate: 40.0,
    grid_tight: 3.0,
    grid_wide: 5.0,
    tp_tranche_1_pct: 40.0,
    tp_tranche_2_pct: 35.0,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        auto_tune_enabled: config.auto_tune_enabled ?? false,
        base_order: config.base_order ?? 100.0,
        volume_multiplier: config.volume_multiplier ?? 1.35,
        max_dca_layers: config.max_dca_layers ?? 4,
        per_trade_stop_pct: config.per_trade_stop_pct ?? 8.0,
        rsi_entry_gate: config.rsi_entry_gate ?? 40.0,
        grid_tight: config.grid_tight ?? 3.0,
        grid_wide: config.grid_wide ?? 5.0,
        tp_tranche_1_pct: config.tp_tranche_1_pct ?? 40.0,
        tp_tranche_2_pct: config.tp_tranche_2_pct ?? 35.0,
      });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="liquid-glass-card p-6 h-64 glass-skeleton rounded-2xl" />;
  }

  return (
    <div className="liquid-glass-card p-6 border border-blue-500/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-500" />
          Strategy Tuning
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Auto-Tune AI
          </span>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, auto_tune_enabled: !formData.auto_tune_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.auto_tune_enabled ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.auto_tune_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Base Order Size (USDT)</label>
            <input
              type="number"
              step="1"
              min="10"
              value={formData.base_order ?? ""}
              onChange={(e) => setFormData({ ...formData, base_order: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">DCA Volume Multiplier</label>
            <input
              type="number"
              step="0.01"
              min="1.0"
              value={formData.volume_multiplier ?? ""}
              onChange={(e) => setFormData({ ...formData, volume_multiplier: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Max DCA Layers</label>
            <input
              type="number"
              step="1"
              min="0"
              max="15"
              value={formData.max_dca_layers ?? ""}
              onChange={(e) => setFormData({ ...formData, max_dca_layers: e.target.value === "" ? "" : parseInt(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">RSI Entry Gate</label>
            <input
              type="number"
              step="1"
              min="10"
              max="90"
              disabled={formData.auto_tune_enabled}
              value={formData.rsi_entry_gate ?? ""}
              onChange={(e) => setFormData({ ...formData, rsi_entry_gate: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className={`w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 ${formData.auto_tune_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Tight Grid (%)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              disabled={formData.auto_tune_enabled}
              value={formData.grid_tight ?? ""}
              onChange={(e) => setFormData({ ...formData, grid_tight: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className={`w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 ${formData.auto_tune_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Wide Grid (%)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              disabled={formData.auto_tune_enabled}
              value={formData.grid_wide ?? ""}
              onChange={(e) => setFormData({ ...formData, grid_wide: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className={`w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 ${formData.auto_tune_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">TP Tranche 1 (%)</label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              disabled={formData.auto_tune_enabled}
              value={formData.tp_tranche_1_pct ?? ""}
              onChange={(e) => setFormData({ ...formData, tp_tranche_1_pct: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className={`w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 ${formData.auto_tune_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">TP Tranche 2 (%)</label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              disabled={formData.auto_tune_enabled}
              value={formData.tp_tranche_2_pct ?? ""}
              onChange={(e) => setFormData({ ...formData, tp_tranche_2_pct: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className={`w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 ${formData.auto_tune_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Per-Trade Stop Loss (%)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={formData.per_trade_stop_pct ?? ""}
              onChange={(e) => setFormData({ ...formData, per_trade_stop_pct: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="mt-4">
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? "Saving..." : "Save Strategy"}
          </button>
        </div>
      </form>
    </div>
  );
}
