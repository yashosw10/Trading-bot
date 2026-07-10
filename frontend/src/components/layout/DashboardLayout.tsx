"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlertTriangle } from "lucide-react";

function LiveBanner() {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  return (
    <AnimatePresence>
      {config?.mode === 'live' && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-500 px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold z-20"
        >
          <AlertTriangle className="w-4 h-4" />
          LIVE TRADING ACTIVE. REAL FUNDS AT RISK.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden text-neutral-900 dark:text-neutral-100">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <TopNav />
        <LiveBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-24 md:pt-8 z-10 scroll-smooth">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="max-w-[1600px] mx-auto space-y-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
