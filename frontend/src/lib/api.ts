import { ENDPOINTS } from './endpoints';
import { BalancesResponse, InvestedResponse, TotalProfitResponse } from '../types/portfolio';
import { PositionsResponse } from '../types/position';
import { TradesResponse } from '../types/trade';
import { AddFundsPayload, AddFundsResponse } from '../types/fund';

const fetcher = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Error fetching ${url}: ${res.statusText}`);
  }
  return res.json();
};

export const api = {
  getBalances: () => fetcher<BalancesResponse>(ENDPOINTS.BALANCES),
  getPositions: () => fetcher<PositionsResponse>(ENDPOINTS.POSITIONS),
  getTotalProfit: (currency: string) => fetcher<TotalProfitResponse>(ENDPOINTS.TOTAL_PROFIT(currency)),
  getInvested: () => fetcher<InvestedResponse>(ENDPOINTS.INVESTED),
  getTrades: () => fetcher<TradesResponse>(ENDPOINTS.TRADES),
  
  addFunds: (payload: AddFundsPayload) => fetcher<AddFundsResponse>(ENDPOINTS.ADD_FUNDS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
};
