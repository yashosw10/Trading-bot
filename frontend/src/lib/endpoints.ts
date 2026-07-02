export const API_BASE_URL = 'http://127.0.0.1:8000/api';

export const ENDPOINTS = {
  BALANCES: `${API_BASE_URL}/balances`,
  POSITIONS: `${API_BASE_URL}/positions`,
  TOTAL_PROFIT: (currency: string) => `${API_BASE_URL}/total-profit?currency=${currency}`,
  INVESTED: `${API_BASE_URL}/invested`,
  TRADES: `${API_BASE_URL}/trades`,
  ADD_FUNDS: `${API_BASE_URL}/add-funds`,
};
