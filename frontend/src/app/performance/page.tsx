"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { TrendingUp } from "lucide-react";
import EquityCurve from "@/components/dashboard/EquityCurve";
import AnalyticsCards from "@/components/dashboard/AnalyticsCards";
import MonthlyHeatmap from "@/components/dashboard/MonthlyHeatmap";
import DrawdownChart from "@/components/dashboard/DrawdownChart";
import BacktestViewer from "@/components/dashboard/BacktestViewer";
import PerSymbolBreakdown from "@/components/dashboard/PerSymbolBreakdown";
import DailyPnLChart from "@/components/dashboard/DailyPnLChart";

export default function PerformancePage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
          Performance Analytics
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Detailed breakdown of your trading bot's historical performance.
        </p>
      </div>

      <div className="space-y-6">
        <AnalyticsCards />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EquityCurve />
          <DrawdownChart />
        </div>
        <DailyPnLChart />
        <PerSymbolBreakdown />
        <BacktestViewer />
        <MonthlyHeatmap />
      </div>
    </DashboardLayout>
  );
}
