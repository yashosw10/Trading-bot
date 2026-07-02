export interface Trade {
  symbol: string;
  side: string;
  fiat_currency: string;
  amount: number;
  price: number;
  fee: number;
  pnl_fiat: number;
  pnl_percent: number;
  timestamp: string;
}

export type TradesResponse = Trade[];
