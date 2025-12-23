// filepath: p2p-kids-marketplace/src/types/trade.ts

/**
 * TradeStatus represents the lifecycle of a trade in V2.
 * - pending: Trade initiated, awaiting payment.
 * - payment_processing: Payment (Stripe/SP) is in flight.
 * - payment_failed: Payment failed, buyer can retry or cancel.
 * - in_progress: Payment successful, item handoff/shipping expected.
 * - completed: Trade finished successfully, SP earned.
 * - cancelled: Trade cancelled by buyer, seller, or system.
 */
export type TradeStatus =
  | 'pending'
  | 'payment_processing'
  | 'payment_failed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/**
 * Trade interface representing a transaction between buyer and seller.
 * Aligned with V2 schema in 060_trades_v2.sql and 061_sp_ledger_and_trade_rpcs.sql.
 */
export interface Trade {
  id: string;
  listing_id: string; // Changed from item_id to match DB
  buyer_id: string;
  seller_id: string;
  node_id: string | null;
  status: TradeStatus;
  
  // Monetary breakdown
  sp_amount: number;         // SP portion in points
  cash_amount_cents: number; // Cash portion in cents
  platform_fee_cents: number; // Total platform fee in cents
  cash_currency: string;     // e.g., 'usd'
  
  // Fees & Snapshots
  buyer_subscription_status: string | null; // 'free', 'trial', 'active', etc.
  buyer_transaction_fee_cents: number;      // $0.99 or $2.99 in cents
  
  // External IDs
  stripe_payment_intent_id?: string | null;
  
  // Links to SP Ledger (MODULE-09)
  sp_debit_ledger_entry_id?: string | null;  // Entry for SP spent by buyer
  sp_credit_ledger_entry_id?: string | null; // Entry for SP earned by seller (if applicable)
  
  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  last_status_change_at: string;
}
