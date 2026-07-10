"use client";

import { useAlertsStore } from "@/store/alertsStore";
import { Plus, Trash2, BellRing, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

export default function AlertsPanel() {
  const { alerts, addAlert, removeAlert } = useAlertsStore();
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [condition, setCondition] = useState<'above'|'below'>("above");
  const [threshold, setThreshold] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threshold) return;
    
    // Lazily request browser notification permissions
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
    
    addAlert({ symbol, condition, threshold: parseFloat(threshold) });
    setThreshold("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Create Alert Form */}
      <div className="liquid-glass-card p-6 h-fit lg:col-span-1 border border-blue-500/10">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-500" />
          Create Alert
        </h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. BTC/USDT"
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 uppercase"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Condition</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setCondition('above')}
                className={`py-2.5 rounded-xl font-medium flex justify-center items-center gap-2 transition-colors ${
                  condition === 'above' 
                    ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' 
                    : 'bg-black/5 dark:bg-white/5 text-neutral-500 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Above
              </button>
              <button
                type="button"
                onClick={() => setCondition('below')}
                className={`py-2.5 rounded-xl font-medium flex justify-center items-center gap-2 transition-colors ${
                  condition === 'below' 
                    ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                    : 'bg-black/5 dark:bg-white/5 text-neutral-500 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Below
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Price Threshold ($)</label>
            <input
              type="number"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0.00"
              required
              className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <button 
            type="submit" 
            className="w-full liquid-glass-button bg-blue-500 text-white py-3 font-semibold mt-4 hover:bg-blue-600 transition-colors"
          >
            Add Alert
          </button>
        </form>
      </div>

      {/* Active Alerts List */}
      <div className="liquid-glass-card p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <BellRing className="w-5 h-5 text-neutral-500" />
          Active Alerts
        </h3>
        
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-500 dark:text-neutral-400">
            <BellRing className="w-8 h-8 opacity-20 mb-3" />
            <p>No active alerts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  alert.triggered 
                    ? 'bg-neutral-100 dark:bg-white/5 border-transparent opacity-60' 
                    : 'bg-white dark:bg-[#151518] border-black/5 dark:border-white/5 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    alert.triggered ? 'bg-neutral-200 dark:bg-neutral-800' : 'bg-blue-500/10'
                  }`}>
                    {alert.condition === 'above' ? (
                      <TrendingUp className={`w-5 h-5 ${alert.triggered ? 'text-neutral-400' : 'text-green-500'}`} />
                    ) : (
                      <TrendingDown className={`w-5 h-5 ${alert.triggered ? 'text-neutral-400' : 'text-red-500'}`} />
                    )}
                  </div>
                  <div>
                    <h4 className={`font-bold ${alert.triggered ? 'text-neutral-500' : 'text-neutral-900 dark:text-white'}`}>
                      {alert.symbol}
                    </h4>
                    <p className="text-sm text-neutral-500">
                      Price goes {alert.condition} <span className="font-semibold text-neutral-900 dark:text-white">${alert.threshold.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {alert.triggered && (
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 bg-neutral-200 dark:bg-neutral-800 px-2 py-1 rounded-md">
                      Triggered
                    </span>
                  )}
                  <button 
                    onClick={() => removeAlert(alert.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
