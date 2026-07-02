export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export type Currency = 'USD' | 'INR' | 'EUR';
