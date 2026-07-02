export interface AddFundsPayload {
  currency: string;
  amount: number;
  clear_history: boolean;
}

export interface AddFundsResponse {
  status: string;
  message: string;
}
