export const QUERY_KEYS = {
  balances: ['balances'] as const,
  positions: ['positions'] as const,
  totalProfit: (currency: string) => ['totalProfit', currency] as const,
  invested: ['invested'] as const,
  trades: ['trades'] as const,
  config: ['config'] as const,
};
