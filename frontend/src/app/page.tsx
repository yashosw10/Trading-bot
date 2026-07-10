"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import ActivePositions from "@/components/dashboard/ActivePositions";
import RecentTrades from "@/components/dashboard/RecentTrades";
import FundManagement from "@/components/dashboard/FundManagement";
import OhlcvChart from "@/components/dashboard/OhlcvChart";
import OrderBookDepth from "@/components/dashboard/OrderBookDepth";
import MarketOverview from "@/components/dashboard/MarketOverview";
import FeedHealthPanel from "@/components/dashboard/FeedHealthPanel";
import ManualOrder from "@/components/dashboard/ManualOrder";
import type { Currency } from "@/types/api";

export default function Home() {
  const [currencyPref, setCurrencyPref] = useState<Currency>("USD");
  const [activeCoin, setActiveCoin] = useState("BTC/USDT");

  useEffect(() => {
    const saved = sessionStorage.getItem("activeCoin");
    if (saved) setActiveCoin(saved);
  }, []);

  const handleSetCoin = (coin: string) => {
    setActiveCoin(coin);
    sessionStorage.setItem("activeCoin", coin);
  };

  const COINS = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT"];

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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Sidebar: Markets & Health */}
        <div className="space-y-6">
          <MarketOverview activeCoin={activeCoin} onSelect={handleSetCoin} />
          <FeedHealthPanel />
        </div>

        {/* Main Column: Charts & Data */}
        <div className="xl:col-span-2 space-y-6">
          <PortfolioSummary currency={currencyPref} />
          
          <div>
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
              {COINS.map(coin => (
                <button
                  key={coin}
                  onClick={() => handleSetCoin(coin)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${activeCoin === coin 
                      ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                      : 'bg-black/5 dark:bg-white/5 text-neutral-500 hover:bg-black/10 dark:hover:bg-white/10'}`}
                >
                  {coin.replace("/USDT", "")}
                </button>
              ))}
            </div>
            
            <OhlcvChart activeCoin={activeCoin} />
          </div>

          <OrderBookDepth symbol={activeCoin} />

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
