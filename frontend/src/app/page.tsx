"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import ActivePositions from "@/components/dashboard/ActivePositions";
import RecentTrades from "@/components/dashboard/RecentTrades";
import FundManagement from "@/components/dashboard/FundManagement";
import OhlcvChart from "@/components/dashboard/OhlcvChart";
import OrderBookDepth from "@/components/dashboard/OrderBookDepth";
import FeedHealthPanel from "@/components/dashboard/FeedHealthPanel";
import ManualOrder from "@/components/dashboard/ManualOrder";
import type { Currency } from "@/types/api";

export default function Home() {
  const [currencyPref, setCurrencyPref] = useState<Currency>("USD");

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time algorithmic trading dashboard.
          </p>
        </div>
        
        {/* Currency Preference Selector */}
        <div className="liquid-glass-card p-1 flex bg-black/5 dark:bg-white/5 rounded-xl">
          {(["USD", "INR", "EUR"] as Currency[]).map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrencyPref(cur)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currencyPref === cur
                  ? "bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              {cur}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metrics & Charts */}
        <div className="lg:col-span-2 space-y-6">
          <FeedHealthPanel />
          <PortfolioSummary currency={currencyPref} />
          
          <OhlcvChart activeCoin="BTC/USDT" />

          <OrderBookDepth symbol="BTC/USDT" />

          <ActivePositions />
          
          <RecentTrades />
        </div>

        {/* Right Column: Actions */}
        <div className="space-y-6">
          <ManualOrder />
          <FundManagement defaultCurrency={currencyPref} />
        </div>
      </div>
    </DashboardLayout>
  );
}
