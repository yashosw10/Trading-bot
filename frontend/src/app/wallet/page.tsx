"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import FundManagement from "@/components/dashboard/FundManagement";
import type { Currency } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Wallet as WalletIcon, PieChart as PieChartIcon } from "lucide-react";

export default function WalletPage() {
  const [currencyPref, setCurrencyPref] = useState<Currency>("USD");

  const { data: positions, isLoading } = useQuery({
    queryKey: QUERY_KEYS.positions,
    queryFn: api.getPositions
  });

  const chartData = positions ? Object.entries(positions).map(([symbol, pos]: [string, any]) => {
    const priceKey = `average_price_${currencyPref.toLowerCase()}`;
    const value = pos.amount * (pos[priceKey] || pos.average_price_usd);
    return {
      name: symbol,
      value: value
    };
  }).filter(item => item.value > 0) : [];

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <WalletIcon className="w-6 h-6 text-blue-500" />
            </div>
            Wallet
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your fiat balances and analyze portfolio distribution.
          </p>
        </div>
        
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

      <div className="space-y-6">
        <PortfolioSummary currency={currencyPref} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FundManagement defaultCurrency={currencyPref} />
          
          <div className="liquid-glass-card p-6 flex flex-col min-h-[400px]">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                <PieChartIcon className="w-4 h-4" />
              </span>
              Asset Distribution
            </h3>
            
            <div className="flex-1 flex items-center justify-center">
              {isLoading ? (
                <div className="w-48 h-48 rounded-full glass-skeleton" />
              ) : chartData.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400 text-sm">No assets found.</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="rgba(255,255,255,0.1)"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(28, 28, 30, 0.8)', 
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
