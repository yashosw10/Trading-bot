"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Play, Pause, Zap } from "lucide-react";
import toast from "react-hot-toast";

export default function BotControls() {
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const pauseMutation = useMutation({
    mutationFn: api.pauseBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success("Bot paused. No new positions will be opened.");
    }
  });

  const resumeMutation = useMutation({
    mutationFn: api.resumeBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success("Bot resumed.");
    }
  });

  const toggleModeMutation = useMutation({
    mutationFn: (newMode: string) => api.updateConfig({ ...config, mode: newMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success("Trading mode updated.");
    }
  });

  if (!config) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Paper/Live Toggle */}
      <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl">
        <button
          onClick={() => toggleModeMutation.mutate('paper')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            config.mode === 'paper'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          PAPER
        </button>
        <button
          onClick={() => toggleModeMutation.mutate('live')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
            config.mode === 'live'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Zap className="w-3 h-3" /> LIVE
        </button>
      </div>

      {/* Pause/Resume Toggle */}
      {config.is_panic_selling ? (
        <button
          disabled
          className="p-2.5 rounded-xl liquid-glass-button text-red-500 animate-pulse"
          title="Panic Selling..."
        >
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </button>
      ) : (config.is_paused || config.bot_halted) ? (
        <button
          onClick={() => resumeMutation.mutate()}
          className="p-2.5 rounded-xl liquid-glass-button text-neutral-600 dark:text-neutral-300 hover:text-green-500 dark:hover:text-green-400"
          title="Resume Bot"
        >
          <Play className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={() => pauseMutation.mutate()}
          className="p-2.5 rounded-xl liquid-glass-button text-neutral-600 dark:text-neutral-300 hover:text-amber-500 dark:hover:text-amber-400"
          title="Pause Bot"
        >
          <Pause className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
