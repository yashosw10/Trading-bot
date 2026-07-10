"use client";

import { Activity, LayoutDashboard, Settings, History, Wallet, TrendingUp, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Positions", href: "/positions", icon: Activity },
    { name: "History", href: "/history", icon: History },
    { name: "Performance", href: "/performance", icon: TrendingUp },
    { name: "Alerts", href: "/alerts", icon: Bell },
    { name: "Wallet", href: "/wallet", icon: Wallet },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 m-4 mr-0 liquid-glass-card z-20 sticky top-4 h-[calc(100vh-2rem)]">
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          TradingBot
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname === '/' && item.href === '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                isActive 
                  ? "bg-black/5 dark:bg-white/10 font-medium" 
                  : "hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 text-sm">
          <p className="font-medium">System Status</p>
          <div className="flex items-center gap-2 mt-2 text-green-600 dark:text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Connected
          </div>
        </div>
      </div>
    </aside>
  );
}
