export interface PositionData {
  amount: number;
  average_price_usd: number;
  average_price_inr?: number;
  average_price_eur?: number;
}

export type PositionsResponse = Record<string, PositionData>;
