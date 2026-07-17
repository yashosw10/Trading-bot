"use client";

import { Bell, Search, Menu, RefreshCw, Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import KillSwitchButton from "./KillSwitchButton";
import BotControls from "./BotControls";
import NotificationDropdown from "./NotificationDropdown";

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

      {/* Search Bar removed to keep UI clean and avoid non-functional elements */}
      <div className="hidden md:flex flex-1 max-w-md pointer-events-auto">
        {/* Spacer to keep layout balanced if needed, or just leave empty */}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3 ml-auto pointer-events-auto">
        
        <BotControls />
        <KillSwitchButton />

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
        
        <NotificationDropdown />

        <div className="w-10 h-10 rounded-xl liquid-glass overflow-hidden ml-2 flex items-center justify-center font-medium bg-gradient-to-br from-blue-500 to-purple-500 text-white cursor-pointer">
          TB
        </div>
      </div>
    </header>
  );
}
