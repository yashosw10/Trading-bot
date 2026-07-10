"use client";

import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Layers } from "lucide-react";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { WS_URL } from "@/lib/api";

const OrderBookDepthComponent = ({ symbol = "BTC/USDT" }: { symbol?: string }) => {
  const [bids, setBids] = useState<{ price: number; qty: number }[]>([]);
  const [asks, setAsks] = useState<{ price: number; qty: number }[]>([]);
  const [midPrice, setMidPrice] = useState(65000);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    setBids([]);
    setAsks([]);
    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", channel: "orderbook", symbol }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "orderbook" && data.symbol === symbol) {
          const now = Date.now();
          if (now - lastUpdateRef.current >= 500) {
            lastUpdateRef.current = now;
            
            const newBids = data.bids.map((b: any) => ({ price: b[0], qty: b[1] }));
            const newAsks = data.asks.map((a: any) => ({ price: a[0], qty: a[1] }));
            
            setBids(newBids);
            setAsks(newAsks);
            
            if (newBids.length > 0 && newAsks.length > 0) {
              setMidPrice((newBids[0].price + newAsks[0].price) / 2);
            }
          }
        }
      } catch (e) {
        // ignore parsing errors
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol]);

  const chartData = useMemo(() => {
    if (!bids.length || !asks.length) return [];

    // Bids sorted descending by price (highest bid first)
    const sortedBids = [...bids].sort((a, b) => b.price - a.price);
    const bidDepth = [];
    let cumQtyB = 0;
    for (const b of sortedBids) {
      cumQtyB += b.qty;
      bidDepth.push({ price: b.price, bidCumQty: cumQtyB, askCumQty: null });
    }
    // Reverse bidDepth so price goes ascending from left to right
    bidDepth.reverse();

    // Asks sorted ascending by price (lowest ask first)
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    const askDepth = [];
    let cumQtyA = 0;
    for (const a of sortedAsks) {
      cumQtyA += a.qty;
      askDepth.push({ price: a.price, bidCumQty: null, askCumQty: cumQtyA });
    }

    return [...bidDepth, ...askDepth];
  }, [bids, asks]);

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-neutral-500" />
          Order Book Depth
        </h3>
      </div>

      <div className="p-6 h-[300px] w-full">
        {chartData.length === 0 ? (
          <div className="w-full h-full glass-skeleton rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAsk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="price" 
                type="number" 
                domain={['dataMin', 'dataMax']} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(val) => val.toFixed(1)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(28, 28, 30, 0.8)', 
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff'
                }}
                labelFormatter={(label) => `Price: $${Number(label).toFixed(2)}`}
              />
              <ReferenceLine x={midPrice} stroke="#ffffff" strokeDasharray="3 3" opacity={0.5} />
              
              <Area 
                type="step" 
                dataKey="bidCumQty" 
                stroke="#22c55e" 
                fill="url(#colorBid)" 
                strokeWidth={2} 
                animationDuration={500}
              />
              <Area 
                type="step" 
                dataKey="askCumQty" 
                stroke="#ef4444" 
                fill="url(#colorAsk)" 
                strokeWidth={2} 
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default React.memo(OrderBookDepthComponent);
