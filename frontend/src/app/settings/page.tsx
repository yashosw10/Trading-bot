"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Settings as SettingsIcon, Moon, Sun, User, Bell, Key, AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import RiskLimitsPanel from "@/components/settings/RiskLimitsPanel";
import StrategyTuningPanel from "@/components/settings/StrategyTuningPanel";
import NotificationSettingsPanel from "@/components/settings/NotificationSettingsPanel";
import TradingPairsPanel from "@/components/settings/TradingPairsPanel";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.warn("not yet wired");
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-blue-500" />
          </div>
          Settings
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your account preferences and application settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Details & Appearance */}
        <div className="space-y-6">
          <div className="liquid-glass-card p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-neutral-500" />
              Account Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Email Address</label>
                <input
                  type="email"
                  value="trader@liquidglass.app"
                  readOnly
                  className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-neutral-500 outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Account ID</label>
                <input
                  type="text"
                  value="TB-89412A"
                  readOnly
                  className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-neutral-500 outline-none cursor-not-allowed font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <RiskLimitsPanel />
          <StrategyTuningPanel />

          <div className="liquid-glass-card p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              {mounted ? (theme === "dark" ? <Moon className="w-5 h-5 text-neutral-500" /> : <Sun className="w-5 h-5 text-neutral-500" />) : <Sun className="w-5 h-5 text-neutral-500" />}
              Appearance
            </h3>
            {mounted && (
              <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">Theme Preference</p>
                  <p className="text-sm text-neutral-500">Toggle between light and dark modes.</p>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    theme === "dark" ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      theme === "dark" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notifications & API (Mock) */}
        <div className="space-y-6">
          <NotificationSettingsPanel />
          <TradingPairsPanel />

          <div className="liquid-glass-card p-6 relative overflow-hidden group">
            <div className="absolute top-6 right-6">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-neutral-400">
              <Key className="w-5 h-5" />
              API Connections
            </h3>
            <form onSubmit={handleMockSubmit} className="space-y-4 opacity-60">
              <div>
                <label className="text-sm font-medium text-neutral-500">Binance API Key</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-500">Binance Secret Key</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
                  disabled
                />
              </div>
              <button type="submit" className="w-full liquid-glass-button bg-neutral-500/10 text-neutral-500 py-3 font-semibold mt-4">
                Update Exchange Keys
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
