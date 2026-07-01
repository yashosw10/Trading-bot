"use client";

import React, { useEffect, useState, useRef } from "react";

// --- Types ---
type Ticker   = { symbol: string; price_usd: number; price_inr: number; price_eur: number; price_change_percent: number; timestamp: string };
type Trade    = { symbol: string; side: string; amount: number; price: number; fiat_currency: string; timestamp: string; fee: number; pnl_fiat: number; pnl_percent: number };
type Balances = { USD: number; INR: number; EUR: number };

const SYM   = { USD: "$", INR: "₹", EUR: "€" } as const;
const FIELD  = { USD: "price_usd", INR: "price_inr", EUR: "price_eur" } as const;

// --- Mock Data Fallbacks (for previewing without the backend) ---
const MOCK_BALANCES = { USD: 12500.50, INR: 1037500, EUR: 11500 };
const MOCK_INVESTED = { USD: 4500.25, INR: 373500, EUR: 4140 };
const MOCK_TICKERS: Record<string, Ticker> = {
  "BTC/USD": { symbol: "BTC/USD", price_usd: 64230.50, price_inr: 5331131, price_eur: 59092, price_change_percent: 2.45, timestamp: new Date().toISOString() },
  "ETH/USD": { symbol: "ETH/USD", price_usd: 3450.75, price_inr: 286412, price_eur: 3174, price_change_percent: -1.2, timestamp: new Date().toISOString() },
  "SOL/USD": { symbol: "SOL/USD", price_usd: 145.20, price_inr: 12051, price_eur: 133, price_change_percent: 8.7, timestamp: new Date().toISOString() },
  "AVAX/USD": { symbol: "AVAX/USD", price_usd: 35.40, price_inr: 2938, price_eur: 32.5, price_change_percent: 4.1, timestamp: new Date().toISOString() },
};
const MOCK_TRADES: Trade[] = [
  { symbol: "SOL/USD", side: "buy", amount: 15, price: 135.00, fiat_currency: "USD", timestamp: new Date().toISOString(), fee: 0.5, pnl_fiat: 0, pnl_percent: 0 },
  { symbol: "BTC/USD", side: "sell", amount: 0.05, price: 65000, fiat_currency: "USD", timestamp: new Date(Date.now() - 3600000).toISOString(), fee: 1.2, pnl_fiat: 150.5, pnl_percent: 4.2 },
  { symbol: "ETH/USD", side: "buy", amount: 2.5, price: 3400, fiat_currency: "USD", timestamp: new Date(Date.now() - 7200000).toISOString(), fee: 2.0, pnl_fiat: 0, pnl_percent: 0 },
];

// --- Embedded Dark Aurora Glassmorphism CSS ---
const glassStyles = `
  :root {
    --cyan: #00f2fe;
    --cyan-deep: #4facfe;
    --yellow: #f6d365;
    --yellow-deep: #fda085;
    --green: #00f260;
    --red: #ff0844;

    --text-primary: #ffffff;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    
    --glass-bg: rgba(17, 25, 40, 0.6);
    --glass-border: rgba(255, 255, 255, 0.12);
    --glass-highlight: rgba(255, 255, 255, 0.05);
  }

  body, html {
    background-color: #050810;
    color: var(--text-primary);
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 0;
    min-height: 100vh;
  }

  /* 1. Dark Aurora Vibrant Background */
  .vibrant-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1; 
    background-color: #050810;
    background-image: 
      radial-gradient(circle at 15% 40%, rgba(0, 242, 254, 0.15) 0%, transparent 40%),
      radial-gradient(circle at 85% 30%, rgba(79, 172, 254, 0.15) 0%, transparent 40%),
      radial-gradient(circle at 50% 80%, rgba(138, 43, 226, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 80% 90%, rgba(246, 211, 101, 0.1) 0%, transparent 40%);
    pointer-events: none;
    filter: blur(40px);
  }

  /* 2. Enhanced Glass Panel */
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: 24px;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
    z-index: 10; 
    position: relative;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, background 0.3s ease;
  }

  .glass-panel:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4);
    background: rgba(25, 35, 55, 0.65);
  }

  /* 3. Glass Navbar */
  .glass-navbar {
    background: rgba(10, 15, 25, 0.75);
    backdrop-filter: blur(24px) saturate(200%);
    -webkit-backdrop-filter: blur(24px) saturate(200%);
    border-bottom: 1px solid var(--glass-border);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
    z-index: 50; 
    position: relative;
  }

  /* Accents */
  .accent-cyan { border-top: 2px solid var(--cyan); }
  .accent-yellow { border-top: 2px solid var(--yellow); }
  .accent-green { border-top: 2px solid var(--green); }
  .accent-red { border-top: 2px solid var(--red); }

  /* Tables */
  .glass-panel table { width: 100%; border-collapse: collapse; }
  .glass-panel thead tr {
    background: var(--glass-highlight);
    border-bottom: 1px solid var(--glass-border);
  }
  .glass-panel th {
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 16px 20px;
  }
  .glass-panel td {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
    font-size: 0.85rem;
  }
  .table-row-hover:hover td {
    background: rgba(255, 255, 255, 0.03);
    transition: background 0.2s ease;
  }

  /* Modals */
  .modal-backdrop {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    z-index: 100; 
  }

  /* Buttons & Inputs */
  .btn-cyan {
    background: linear-gradient(135deg, var(--cyan-deep), var(--cyan));
    color: #000;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 242, 254, 0.3);
    transition: all 0.2s ease;
    z-index: 20;
  }
  .btn-cyan:hover {
    box-shadow: 0 6px 20px rgba(0, 242, 254, 0.5);
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .glass-input {
    width: 100%; 
    padding: 12px 14px; 
    border-radius: 12px; 
    margin-bottom: 16px;
    border: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.2); 
    color: var(--text-primary);
    font-size: 0.9rem; 
    outline: none;
    transition: border 0.2s;
  }
  .glass-input:focus {
    border-color: var(--cyan);
  }

  .glass-select {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--glass-border);
    color: var(--text-primary);
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    padding: 6px 12px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .glass-select option {
    background: #0f172a;
    color: white;
  }

  /* Badges */
  .badge-buy {
    background: rgba(0, 242, 96, 0.1);
    color: var(--green);
    border: 1px solid rgba(0, 242, 96, 0.3);
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 4px 10px;
  }
  .badge-sell {
    background: rgba(255, 8, 68, 0.1);
    color: var(--red);
    border: 1px solid rgba(255, 8, 68, 0.3);
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 4px 10px;
  }

  @keyframes floatUp {
    0%   { opacity:0; transform: translateY(10px); }
    100% { opacity:1; transform: translateY(0); }
  }
  .float-up { animation: floatUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
`;

export default function App() {
  const [balances, setBalances]     = useState<Balances>(MOCK_BALANCES);
  const [totalProfit, setTotalProfit]  = useState(345.50);
  const [invested, setInvested]     = useState<Balances>(MOCK_INVESTED);
  const [trades, setTrades]       = useState<Trade[]>(MOCK_TRADES);
  const [tickers, setTickers]      = useState<Record<string, Ticker>>(MOCK_TICKERS);
  const [currency, setCurrency]     = useState<"USD"|"INR"|"EUR">("USD");
  const [showModal, setShowModal]    = useState(false);
  const [fundAmt, setFundAmt]      = useState("");
  const [clearHist, setClearHist]    = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchAll = async (cur = currency) => {
    try {
      const [b, p, inv] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/balances").then(r => r.json()),
        fetch(`http://127.0.0.1:8000/api/total-profit?currency=${cur}`).then(r => r.json()),
        fetch("http://127.0.0.1:8000/api/invested").then(r => r.json()),
      ]);
      setBalances(b);
      setTotalProfit(p.total_profit);
      setInvested(inv);
    } catch { 
      // Fallback to mock data if backend isn't running
      console.log("Backend not found, using mock data for presentation.");
    }
  };

  useEffect(() => { fetchAll(currency); }, [currency]);

  useEffect(() => {
    (async () => {
      try {
        await fetchAll();
        const t = await fetch("http://127.0.0.1:8000/api/trades").then(r => r.json());
        setTrades(t);
      } catch {
        // Fallback handled in initial state
      }
    })();

    const connect = () => {
      try {
        const ws = new WebSocket("ws://127.0.0.1:8000/ws");
        wsRef.current = ws;
        ws.onmessage = ({ data }) => {
          const d = JSON.parse(data);
          if (d.type === "ticker")  setTickers(p => ({ ...p, [d.symbol]: d }));
          if (d.type === "trade") { setTrades(p => [d, ...p]); fetchAll(); }
        };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch (e) {
        console.log("WebSocket failed, running in static mode.");
      }
    };
    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  const addFunds = async () => {
    if (!fundAmt || isNaN(+fundAmt)) return;
    try {
        await fetch("http://127.0.0.1:8000/api/add-funds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, amount: +fundAmt, clear_history: clearHist }),
        });
        await fetchAll();
        if (clearHist) setTrades(await fetch("http://127.0.0.1:8000/api/trades").then(r => r.json()));
    } catch {
        // Mock update
        setBalances(prev => ({...prev, [currency]: prev[currency] + Number(fundAmt)}));
        if(clearHist) setTrades([]);
    }
    setShowModal(false); setFundAmt("");
  };

  const fmt  = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtIST = (iso: string) => iso
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "numeric" }).format(new Date(iso))
    : "";

  const sorted = Object.values(tickers).sort((a, b) => b.price_usd - a.price_usd);
  const s      = SYM[currency];
  const pf     = FIELD[currency];

  return (
    <>
      <style>{glassStyles}</style>
      <div className="min-h-screen pb-16">
        
        {/* 1. Dark Aurora Background System */}
        <div className="vibrant-background"></div>

        {/* 2. Glass Navbar */}
        <nav className="glass-navbar px-6 py-4 sticky top-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              width: 36, height: 36, borderRadius: "12px",
              background: "linear-gradient(135deg, var(--cyan), var(--cyan-deep))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0, 242, 254, 0.4)",
              color: "#000", fontWeight: 900, fontSize: 18,
            }}>P</div>
            <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Paper<span style={{ color: "var(--cyan)" }}>Market</span><span style={{ color: "var(--yellow)" }}>Cap</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {["Dashboard", "Markets", "Portfolio"].map(l => (
              <button key={l} style={{
                background: "none", border: "none", cursor: "pointer",
                color: l === "Dashboard" ? "var(--cyan)" : "var(--text-secondary)", 
                fontWeight: 600, fontSize: "0.9rem",
                padding: "6px 12px", borderRadius: 8, transition: "color 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = l === "Dashboard" ? "var(--cyan)" : "var(--text-secondary)")}
              >{l}</button>
            ))}

            <div style={{ width: 1, height: 24, background: "var(--glass-border)", margin: "0 8px" }} />

            <select
              className="glass-select"
              value={currency}
              onChange={e => setCurrency(e.target.value as any)}
            >
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
            </select>

            <button className="btn-cyan" style={{ padding: "8px 20px", fontSize: "0.85rem" }} onClick={() => setShowModal(true)}>
              Manage Funds
            </button>
          </div>
        </nav>

        {/* 3. Modal Layer */}
        {showModal && (
          <div className="modal-backdrop" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="glass-panel float-up" style={{ padding: 40, width: 420, borderTop: "2px solid var(--cyan)" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Add Virtual Funds</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 28 }}>Inject capital into your paper trading wallet.</p>

              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Amount ({currency})
              </label>
              <input
                className="glass-input"
                type="number"
                value={fundAmt}
                onChange={e => setFundAmt(e.target.value)}
                placeholder="e.g. 50000"
              />

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, cursor: "pointer" }}>
                <input type="checkbox" checked={clearHist}
                  onChange={e => setClearHist(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--cyan)" }} />
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Wipe Portfolio & Trade History</span>
              </label>

              <div style={{ display: "flex", gap: 16 }}>
                <button onClick={() => setShowModal(false)} style={{
                  flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer",
                  border: "1px solid var(--glass-border)",
                  background: "rgba(255,255,255,0.05)", color: "var(--text-primary)",
                  fontWeight: 600, fontSize: "0.9rem", transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                >Cancel</button>
                <button className="btn-cyan" onClick={addFunds} style={{ flex: 1, padding: "12px", fontSize: "0.9rem" }}>
                  Inject Capital
                </button>
              </div>
            </div>
          </div>
        )}

        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 24px 0", position: "relative", zIndex: 10 }}>

          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 32, letterSpacing: "-0.02em" }}>
            Portfolio <span style={{ color: "var(--cyan)" }}>Overview</span>
          </h1>

          {/* 4. Glass Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 48 }}>
            
            <div className="glass-panel accent-cyan" style={{ padding: "36px 32px" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--cyan)", marginBottom: 16 }}>
                Total Balance ({currency})
              </p>
              <p style={{ fontSize: "2.8rem", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1 }}>
                {s}{fmt(balances[currency])}
              </p>
            </div>

            <div className="glass-panel accent-yellow" style={{ padding: "36px 32px" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--yellow)", marginBottom: 16 }}>
                Currently Invested ({currency})
              </p>
              <p style={{ fontSize: "2.8rem", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1 }}>
                {s}{fmt(invested[currency] ?? 0)}
              </p>
            </div>

            <div className={`glass-panel ${totalProfit >= 0 ? "accent-green" : "accent-red"}`} style={{ padding: "36px 32px" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: totalProfit >= 0 ? "var(--green)" : "var(--red)", marginBottom: 16 }}>
                Realized Profit ({currency})
              </p>
              <p style={{ fontSize: "2.8rem", fontWeight: 900, color: totalProfit >= 0 ? "var(--text-primary)" : "var(--red)", lineHeight: 1 }}>
                {totalProfit >= 0 ? "+" : ""}{s}{fmt(totalProfit)}
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, letterSpacing: "-0.01em" }}>
            Live <span style={{ color: "var(--cyan)" }}>Markets</span>
          </h2>
          
          <div className="glass-panel" style={{ marginBottom: 48, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Asset</th>
                    <th style={{ textAlign: "right" }}>Price ({currency})</th>
                    <th style={{ textAlign: "right" }}>24h Change</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                      Awaiting market data streams...
                    </td></tr>
                  )}
                  {sorted.map((t) => (
                    <tr key={t.symbol} className="table-row-hover">
                      <td style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem" }}>
                        {t.symbol.split('/')[0]} <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>/{t.symbol.split('/')[1]}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text-primary)", fontSize: "1rem" }}>
                        {s}{(t[pf as keyof Ticker] as number)?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "---"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: t.price_change_percent >= 0 ? "var(--green)" : "var(--red)" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: t.price_change_percent >= 0 ? "rgba(0, 242, 96, 0.1)" : "rgba(255, 8, 68, 0.1)", padding: "4px 8px", borderRadius: 6 }}>
                          {t.price_change_percent >= 0 ? "▲" : "▼"} {Math.abs(t.price_change_percent).toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button style={{ background: "rgba(255,255,255,0.1)", border: "1px solid var(--glass-border)", color: "white", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Trade</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, letterSpacing: "-0.01em" }}>
            Algorithmic <span style={{ color: "var(--yellow)" }}>History</span>
          </h2>
          
          <div className="glass-panel" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Time</th>
                    <th style={{ textAlign: "left" }}>Pair</th>
                    <th style={{ textAlign: "left" }}>Type</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "right" }}>Value ({currency})</th>
                    <th style={{ textAlign: "right" }}>Price</th>
                    <th style={{ textAlign: "right" }}>PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                      No trades executed yet. Waiting for signals...
                    </td></tr>
                  ) : (
                    trades.map((tr, i) => {
                      const tSym = SYM[tr.fiat_currency as keyof typeof SYM] ?? "$";
                      const vUSD = tr.amount * tr.price;
                      const vActive = currency === "INR" ? vUSD * 83 : currency === "EUR" ? vUSD * 0.92 : vUSD;
                      
                      return (
                        <tr key={i} className="table-row-hover float-up" style={{ animationDelay: `${i * 0.05}s` }}>
                          <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtIST(tr.timestamp)}</td>
                          <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{tr.symbol}</td>
                          <td><span className={tr.side === "buy" ? "badge-buy" : "badge-sell"}>{tr.side.toUpperCase()}</span></td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{tr.amount.toFixed(4)}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{s}{fmt(vActive)}</td>
                          <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-secondary)" }}>{tSym}{tr.price?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            {tr.side === "buy" ? (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            ) : (
                              <span style={{ color: tr.pnl_fiat >= 0 ? "var(--green)" : "var(--red)" }}>
                                {tr.pnl_fiat >= 0 ? "+" : ""}{tr.pnl_percent?.toFixed(2) ?? "0.00"}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}