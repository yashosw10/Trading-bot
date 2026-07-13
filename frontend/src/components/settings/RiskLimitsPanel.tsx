"use client";

import { ShieldAlert, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function RiskLimitsPanel() {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const [formData, setFormData] = useState({
    daily_loss_limit: 5.0,
    max_drawdown_pct: 15.0,
    max_position_size: 100.0,
    max_open_positions: 3,
    telegram_bot_token: "",
    telegram_chat_id: ""
  });

  useEffect(() => {
    if (config) {
      setFormData({
        daily_loss_limit: config.daily_loss_limit ?? 5.0,
        max_drawdown_pct: config.max_drawdown_pct ?? 15.0,
        max_position_size: config.max_position_size ?? 100.0,
        max_open_positions: config.max_open_positions ?? 3,
        telegram_bot_token: config.telegram_bot_token ?? "",
        telegram_chat_id: config.telegram_chat_id ?? ""
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
    <div className="liquid-glass-card p-6 border border-red-500/10">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-red-500" />
        Risk Limits
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Daily Loss Limit (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.daily_loss_limit}
              onChange={(e) => setFormData({ ...formData, daily_loss_limit: parseFloat(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Max Drawdown (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.max_drawdown_pct}
              onChange={(e) => setFormData({ ...formData, max_drawdown_pct: parseFloat(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Max Position Size (USDT)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.max_position_size}
              onChange={(e) => setFormData({ ...formData, max_position_size: parseFloat(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Max Open Positions</label>
            <input
              type="number"
              step="1"
              min="1"
              max="10"
              value={formData.max_open_positions}
              onChange={(e) => setFormData({ ...formData, max_open_positions: parseInt(e.target.value) })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Telegram Bot Token</label>
            <input
              type="password"
              value={formData.telegram_bot_token}
              onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Telegram Chat ID</label>
            <input
              type="text"
              value={formData.telegram_chat_id}
              onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? "Saving..." : "Save Config"}
          </button>
          
          <button 
            type="button" 
            onClick={async () => {
              try {
                const res = await api.testTelegram();
                if (res.status === 'success') toast.success(res.message);
                else toast.error(res.message);
              } catch (e: any) {
                toast.error(e.message || "Failed to test telegram");
              }
            }}
            className="flex-1 liquid-glass-button bg-purple-500/10 text-purple-600 dark:text-purple-400 py-3 font-semibold hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            Test Alert
          </button>
        </div>
      </form>
    </div>
  );
}
