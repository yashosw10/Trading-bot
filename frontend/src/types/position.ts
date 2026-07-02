export interface PositionData {
  amount: number;
  average_price_usd: number;
}

export interface PositionsResponse {
  "BTC/USDT": PositionData;
}
