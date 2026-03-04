// File: p2p-kids-marketplace/src/types/billingHistory.types.ts
// SUB-014: Billing History TypeScript Types

export type BillingStatus = 'succeeded' | 'failed' | 'refunded' | 'pending';

export interface BillingHistory {
  id: string;
  user_id: string;
  subscription_id: string;
  charge_id: string;
  stripe_invoice_id: string | null;
  amount: number; // Amount in cents
  currency: string;
  status: BillingStatus;
  charged_at: string; // ISO 8601 timestamp
  description: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBillingHistoryParams {
  user_id: string;
  subscription_id: string;
  charge_id: string;
  stripe_invoice_id?: string | null;
  amount: number;
  currency?: string;
  status: BillingStatus;
  charged_at?: string;
  description?: string | null;
  error_message?: string | null;
}

export interface BillingHistoryFilters {
  user_id?: string;
  subscription_id?: string;
  status?: BillingStatus;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BillingHistorySummary {
  total_charges: number;
  successful_charges: number;
  failed_charges: number;
  refunded_charges: number;
  total_amount_cents: number; // Total successfully charged
  total_refunded_cents: number; // Total refunded
  most_recent_charge: BillingHistory | null;
}
