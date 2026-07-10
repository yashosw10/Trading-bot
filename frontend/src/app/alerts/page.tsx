"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Bell } from "lucide-react";
import AlertsPanel from "@/components/dashboard/AlertsPanel";

export default function AlertsPage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Bell className="w-6 h-6 text-blue-500" />
          </div>
          Price Alerts
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Set up custom price triggers. You will be notified instantly when thresholds are met.
        </p>
      </div>

      <AlertsPanel />
    </DashboardLayout>
  );
}
