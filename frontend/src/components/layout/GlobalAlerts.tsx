"use client";

import { useEffect } from "react";
import { useGlobalStore } from "@/store/globalStore";
import { AlertTriangle, BellRing } from "lucide-react";
import { useAlertsStore } from "@/store/alertsStore";
import toast from "react-hot-toast";
import { api, WS_URL } from "@/lib/api";
import { wsManager } from "@/lib/ws";

// Helper for price alert toasts
const alertToast = (msg: string) => {
  toast.custom((t) => (
    <div className={`max-w-md w-full bg-white dark:bg-[#151518] shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/5 ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <BellRing className="h-10 w-10 text-blue-500 rounded-full bg-blue-500/10 p-2" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Price Alert Triggered
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {msg}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200 dark:border-white/10">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-white/5 focus:outline-none"
        >
          Close
        </button>
      </div>
    </div>
  ), { duration: 5000 });
};

export default function GlobalAlerts() {
  const { bannerMessage, setBannerMessage } = useGlobalStore();

  useEffect(() => {
    const unsubscribe = wsManager.subscribe((data) => {
      if (data.type === "alert" && data.level === "critical" && data.message?.includes("loss limit")) {
        setBannerMessage(data.message);
      }
      
      // Check price alerts
      if (data.type === "ticker" || data.symbol) {
        const price = parseFloat(data.price_usd);
        if (!isNaN(price) && data.symbol) {
          const { alerts, markTriggered } = useAlertsStore.getState();
          alerts.forEach(alert => {
            if (!alert.triggered && alert.symbol === data.symbol) {
              let msg = "";
              if (alert.condition === 'above' && price > alert.threshold) {
                msg = `Price Alert: ${alert.symbol} went above $${alert.threshold}!`;
              } else if (alert.condition === 'below' && price < alert.threshold) {
                msg = `Price Alert: ${alert.symbol} went below $${alert.threshold}!`;
              }
              
              if (msg) {
                markTriggered(alert.id, msg);
                alertToast(msg);
                
                const canPush = 'Notification' in window && 
                                (location.protocol === 'https:' || location.hostname === 'localhost');
                
                if (canPush && Notification.permission === 'granted') {
                  new Notification('Price Alert', { body: msg, icon: '/favicon.ico' });
                }
              }
            }
          });
        }
      }
    });

    return unsubscribe;
  }, [setBannerMessage]);

  if (!bannerMessage) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 backdrop-blur-md text-white px-4 py-3 flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(239,68,68,0.4)] pointer-events-auto cursor-pointer" onClick={() => setBannerMessage(null)}>
      <AlertTriangle className="w-5 h-5 animate-pulse" />
      <span className="font-bold text-sm md:text-base tracking-wide uppercase">
        {bannerMessage}
      </span>
    </div>
  );
}
