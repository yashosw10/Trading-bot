"use client";

import { Bell, Trash2, BellRing, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAlertsStore } from "@/store/alertsStore";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationDropdown() {
  const { alerts, unreadCount, clearUnread, clearAll } = useAlertsStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      clearUnread();
    }
    setIsOpen(!isOpen);
  };

  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleToggle}
        className="p-2.5 rounded-xl liquid-glass-button text-neutral-600 dark:text-neutral-300 relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0f0f13]"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 liquid-glass-card border border-black/5 dark:border-white/5 shadow-2xl z-50 overflow-hidden flex flex-col"
            style={{ maxHeight: "calc(100vh - 100px)" }}
          >
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-neutral-500" />
                <h3 className="font-semibold text-neutral-900 dark:text-white">Notification Log</h3>
              </div>
              {triggeredAlerts.length > 0 && (
                <button 
                  onClick={() => clearAll()}
                  className="text-xs font-semibold text-neutral-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 max-h-96">
              {triggeredAlerts.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
                  <Bell className="w-8 h-8 opacity-20 mb-3" />
                  <p className="text-sm font-medium">No alerts triggered yet</p>
                  <p className="text-xs mt-1">When price alerts hit, they will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {triggeredAlerts.map(alert => (
                    <div key={alert.id} className="p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          alert.condition === 'above' ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {alert.condition === 'above' ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {alert.symbol} {alert.condition} ${alert.threshold}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {alert.message || `Price went ${alert.condition} threshold.`}
                          </p>
                          {alert.timestamp && (
                            <p className="text-[10px] text-neutral-400 mt-1.5 flex items-center gap-1 uppercase font-semibold">
                              <Clock className="w-3 h-3" />
                              {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
