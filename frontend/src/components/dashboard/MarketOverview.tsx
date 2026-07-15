"use client";

import { useLivePrice } from "@/hooks/useLivePrice";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface CoinRowProps {
  symbol: string;
  isActive: boolean;
  onClick: () => void;
}

function CoinRow({ symbol, isActive, onClick }: CoinRowProps) {
  const liveData = useLivePrice(symbol);

  const price = liveData?.price_usd || 0;
  const change = liveData?.change_24h || 0;
  const isPositive = change >= 0;
  
  const sparklineData = liveData?.sparkline?.map((val, i) => ({ val, index: i })) || [];
  const minSpark = sparklineData.length ? Math.min(...sparklineData.map(d => d.val)) : 0;
  const maxSpark = sparklineData.length ? Math.max(...sparklineData.map(d => d.val)) : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
        isActive 
          ? 'bg-blue-500/10 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
          : 'bg-black/5 dark:bg-white/5 border border-transparent hover:bg-black/10 dark:hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
          isActive ? 'bg-blue-500 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
        }`}>
          {symbol.split('/')[0].substring(0, 3)}
        </div>
        <div className="text-left">
          <p className={`font-bold text-sm ${isActive ? 'text-blue-500' : 'text-neutral-900 dark:text-white'}`}>
            {symbol.split('/')[0]}
          </p>
          <p className="text-xs text-neutral-500">USDT</p>
        </div>
      </div>

      <div className="w-20 h-8 opacity-60">
        {sparklineData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <YAxis domain={[minSpark, maxSpark]} hide />
              <Line 
                type="monotone" 
                dataKey="val" 
                stroke={isPositive ? '#22c55e' : '#ef4444'} 
                strokeWidth={1.5} 
                dot={false} 
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="h-[1.5px] w-full bg-neutral-300 dark:bg-neutral-700 rounded" />
          </div>
        )}
      </div>

      <div className="text-right">
        <p className="font-mono font-bold text-sm text-neutral-900 dark:text-white">
          {price > 0 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '---'}
        </p>
        <p className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change).toFixed(2)}%
        </p>
      </div>
    </button>
  );
}

export default function MarketOverview({ activeCoin, onSelect }: { activeCoin: string, onSelect: (coin: string) => void }) {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });
  const coins = config?.symbols || [];

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Markets
        </h3>
      </div>
      <div className="p-3 space-y-2">
        {coins.map((coin: string) => (
          <CoinRow 
            key={coin} 
            symbol={coin} 
            isActive={activeCoin === coin} 
            onClick={() => onSelect(coin)} 
          />
        ))}
      </div>
    </div>
  );
}
