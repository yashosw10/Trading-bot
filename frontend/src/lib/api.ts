import { ENDPOINTS, API_BASE_URL } from './endpoints';
import { BalancesResponse, InvestedResponse, TotalProfitResponse } from '../types/portfolio';
import { PositionsResponse } from '../types/position';
import { TradesResponse } from '../types/trade';
import { AddFundsPayload, AddFundsResponse } from '../types/fund';

export const WS_URL = "ws://127.0.0.1:8000/ws";

const fetcher = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorMsg = res.statusText;
    try {
      const errBody = await res.json();
      errorMsg = errBody.detail || errBody.message || errorMsg;
    } catch(e) {}
    throw new Error(errorMsg);
  }
  return res.json();
};

export const api = {
  getBalances: () => fetcher<BalancesResponse>(ENDPOINTS.BALANCES),
  getPositions: () => fetcher<PositionsResponse>(ENDPOINTS.POSITIONS),
  getTotalProfit: (currency: string) => fetcher<TotalProfitResponse>(ENDPOINTS.TOTAL_PROFIT(currency)),
  getInvested: () => fetcher<InvestedResponse>(ENDPOINTS.INVESTED),
  getTrades: () => fetcher<TradesResponse>(ENDPOINTS.TRADES),
  getFxRates: () => fetcher<{INR: number; EUR: number}>(`${API_BASE_URL}/fx-rates`),
  getOhlcv: (symbol: string = 'BTC/USDT', interval: string = '1h') => fetcher<any>(`${API_BASE_URL}/ohlcv?symbol=${symbol}&interval=${interval}`),
  getIndicators: (symbol: string, type: string, interval: string) => fetcher<any>(`${API_BASE_URL}/indicators?symbol=${symbol}&type=${type}&interval=${interval}`),
  getConfig: () => fetcher<any>(`${API_BASE_URL}/config`),
  updateConfig: (config: any) => fetcher<{status: string}>(`${API_BASE_URL}/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  }),
  killBot: () => fetcher<{status: string, message: string}>(`${API_BASE_URL}/bot/kill`, { method: 'POST' }),
  pauseBot: () => fetcher<{status: string, message: string}>(`${API_BASE_URL}/bot/pause`, { method: 'POST' }),
  resumeBot: () => fetcher<{status: string, message: string}>(`${API_BASE_URL}/bot/resume`, { method: 'POST' }),
  
  addFunds: (payload: AddFundsPayload) => fetcher<AddFundsResponse>(ENDPOINTS.ADD_FUNDS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }),
  getLatestBacktest: () => fetcher<any>(`${API_BASE_URL}/backtest/latest`),
  placeOrder: (payload: { symbol: string; side: string; amount: number; type?: string }) => fetcher<any>(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }),
  testTelegram: () => fetcher<{status: string; message: string}>(`${API_BASE_URL}/bot/test-telegram`, {
    method: 'POST'
  })
};
