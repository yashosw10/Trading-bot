"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Radio, Server } from "lucide-react";
import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/endpoints";

export default function FeedHealthPanel() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data: health, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    },
    refetchInterval: 5000 // Poll every 5 seconds
  });

  useEffect(() => {
    if (health) setLastUpdated(new Date());
  }, [health]);

  const StatusDot = ({ status }: { status?: string }) => {
    if (!status) return <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-pulse shrink-0" />;
    if (status === 'healthy' || status === 'connected' || status === 'ok') {
      return <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] shrink-0" />;
    }
    return <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse shrink-0" />;
  };

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-500" />
          System Health
        </h3>
        {lastUpdated && (
          <span className="text-xs text-neutral-500 truncate ml-2">
            Last checked: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
        <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1 truncate">Database</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold capitalize truncate">{health?.database?.status || 'Unknown'}</span>
              <StatusDot status={health?.database?.status} />
            </div>
            {health?.database?.latency_ms !== undefined && (
              <p className="text-[10px] text-neutral-400 mt-1 truncate">{health.database.latency_ms}ms latency</p>
            )}
          </div>
        </div>

        <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1 truncate">WebSocket</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold capitalize truncate">{health?.websocket?.status || 'Unknown'}</span>
              <StatusDot status={health?.websocket?.status} />
            </div>
            {health?.websocket?.active_clients !== undefined && (
              <p className="text-[10px] text-neutral-400 mt-1 truncate">{health.websocket.active_clients} clients connected</p>
            )}
          </div>
        </div>

        <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1 truncate">Exchange Feed</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold capitalize truncate">{health?.exchange?.status || 'Unknown'}</span>
              <StatusDot status={health?.exchange?.status} />
            </div>
            {health?.exchange?.latency_ms !== undefined && (
              <p className="text-[10px] text-neutral-400 mt-1 truncate">{health.exchange.latency_ms}ms latency</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
