"use client";

import { Bell, Search, Menu, RefreshCw, Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { QUERY_KEYS } from "@/lib/queryKeys";

export default function TopNav() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500); // UI visual feedback
  };

  return (
    <header className="fixed md:sticky top-0 left-0 right-0 h-16 md:h-20 z-30 px-4 md:px-8 flex items-center justify-between pointer-events-none">
      
      {/* Mobile Menu Button */}
      <div className="md:hidden pointer-events-auto">
        <button className="p-2 rounded-xl liquid-glass-button">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="hidden md:flex flex-1 max-w-md pointer-events-auto">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search symbols or trades..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl liquid-glass focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3 ml-auto pointer-events-auto">
        <button 
          onClick={handleManualRefresh}
          className="p-2.5 rounded-xl liquid-glass-button text-neutral-600 dark:text-neutral-300"
          title="Manual Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>

        {mounted && (
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl liquid-glass-button text-neutral-600 dark:text-neutral-300"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
        
        <button className="p-2.5 rounded-xl liquid-glass-button text-neutral-600 dark:text-neutral-300">
          <Bell className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-xl liquid-glass overflow-hidden ml-2 flex items-center justify-center font-medium bg-gradient-to-br from-blue-500 to-purple-500 text-white cursor-pointer">
          TB
        </div>
      </div>
    </header>
  );
}
