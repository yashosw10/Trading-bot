export const API_BASE_URL = '/api/proxy';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws';

export const ENDPOINTS = {
  BALANCES: `${API_BASE_URL}/balances`,
  POSITIONS: `${API_BASE_URL}/positions`,
  TOTAL_PROFIT: (currency: string) => `${API_BASE_URL}/total-profit?currency=${currency}`,
  INVESTED: `${API_BASE_URL}/invested`,
  TRADES: `${API_BASE_URL}/trades`,
  ADD_FUNDS: `${API_BASE_URL}/add-funds`,
};
