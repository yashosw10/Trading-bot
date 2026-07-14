"use client";

import { Bell, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function NotificationSettingsPanel() {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const [formData, setFormData] = useState({
    trade_alerts_enabled: true,
    daily_summary_enabled: false
  });

  useEffect(() => {
    if (config) {
      setFormData({
        trade_alerts_enabled: config.trade_alerts_enabled ?? true,
        daily_summary_enabled: config.daily_summary_enabled ?? false
      });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success("Notification settings saved");
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
    <div className="liquid-glass-card p-6 relative overflow-hidden group">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Bell className="w-5 h-5" />
        Notifications
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
          <div>
            <p className="font-medium">Trade Execution Alerts</p>
            <p className="text-sm text-neutral-500">Receive Telegram alert on filled orders.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, trade_alerts_enabled: !prev.trade_alerts_enabled }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              formData.trade_alerts_enabled ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                formData.trade_alerts_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
          <div>
            <p className="font-medium">Daily Summary</p>
            <p className="text-sm text-neutral-500">Receive a daily PnL report on Telegram at midnight UTC.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, daily_summary_enabled: !prev.daily_summary_enabled }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              formData.daily_summary_enabled ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                formData.daily_summary_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        
        <button 
          type="submit" 
          disabled={mutation.isPending}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm mt-4"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? "Saving..." : "Save Notification Settings"}
        </button>
      </form>
    </div>
  );
}
