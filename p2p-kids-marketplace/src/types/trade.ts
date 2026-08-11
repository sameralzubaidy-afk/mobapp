// filepath: p2p-kids-marketplace/src/types/trade.ts

/**
 * TradeStatus represents the lifecycle of a trade in V2 (D-30).
 * - pending: Legacy — old trades created before D-30.
 * - payment_failed: Payment failed, buyer can retry.
 * - in_progress: Trade active (pre-auth held or captured). Default starting state.
 * - completed: Trade finished successfully, SP earned.
 * - cancelled: Trade cancelled by buyer, seller, or system.
 *
 * Note: 'payment_processing' was removed in D-30. Accept is handled inline
 * by transactions-update Edge Function — status stays 'in_progress'.
 */
export type TradeStatus =
  | 'pending'
  | 'payment_failed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** D-26: dispute_status values matching DB CHECK constraint */
export type DisputeStatus = 'none' | 'reported' | 'under_review' | 'resolved';

/** D-26: dispute_resolution values matching DB CHECK constraint */
export type DisputeResolution = 'completed' | 'refunded';

/** TFV2-018: payout_status values */
export type PayoutStatus = 'pending' | 'requires_action' | 'processing' | 'paid' | 'failed';

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
  sp_amount: number; // SP portion in points
  cash_amount_cents: number; // Cash portion in cents
  platform_fee_cents: number; // Total platform fee in cents
  cash_currency: string; // e.g., 'usd'

  // Fees & Snapshots
  buyer_subscription_status: string | null; // 'free', 'trial', 'active', etc.
  buyer_transaction_fee_cents: number; // $0.99 or $2.99 in cents
  seller_transaction_fee_cents: number; // Platform commission deducted from seller's payout (e.g., 10% of item price)

  // External IDs
  stripe_payment_intent_id?: string | null;

  // D-30 pre-auth
  authorization_expires_at?: string | null;

  // Dispute and payout status columns (TFV2 DB migration trades_preauth_dispute_payout_columns)
  dispute_status?: 'none' | 'reported' | 'under_review' | 'resolved';
  payout_status?: 'pending' | 'requires_action' | 'processing' | 'paid' | 'failed';

  // Offer and completion timing (TFV2)
  offer_expires_at?: string | null;
  auto_complete_at?: string | null;
  seller_notified_at?: string | null;
  pending_sp_release_at?: string | null;
  sp_reserved_at?: string | null;
  sp_released_at?: string | null;

  // Dispute metadata (TFV2)
  disputed_at?: string | null;
  dispute_reason?: string | null;
  dispute_notes?: string | null;
  dispute_resolution?: DisputeResolution | null;

  // Pricing snapshots (TFV2)
  payment_preference_snapshot?: string | null;
  final_sp_amount?: number | null;
  total_fee_cents?: number | null;
  bundle_size?: number | null;
  sp_category_multiplier?: number | null;
  sp_earned_at_completion?: number | null;

  // Payout metadata (TFV2)
  payout_initiated_at?: string | null;
  payout_completed_at?: string | null;
  payout_failed_reason?: string | null;
  payout_idempotency_key?: string | null;

  // MODULE-15.3-PART3 TAX-001/TAX-003 sales-tax snapshots
  tax_amount_cents?: number | null;
  taxable_amount_cents?: number | null;
  tax_rate_applied?: number | null;
  tax_jurisdiction?: string | null;

  // Links to SP Ledger (MODULE-09)
  sp_debit_ledger_entry_id?: string | null; // Entry for SP spent by buyer
  sp_credit_ledger_entry_id?: string | null; // Entry for SP earned by seller (if applicable)

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  seller_marked_completed_at?: string | null;
  cancellation_reason?: string | null;
  last_status_change_at: string;

  // R15 (2026-08-10) — Trade Extension (one-time, pickup window only)
  extension_status?: 'requested' | 'accepted' | 'denied' | 'auto_denied' | 'reauth_failed' | null;
  extension_requested_by?: string | null;
  extension_requested_at?: string | null;
  extension_request_expires_at?: string | null;
  extension_responded_by?: string | null;
  extension_responded_at?: string | null;
  extension_granted_at?: string | null;
}

/** TFV2-002: Stats per listing for unanswered offer tracking (seller inbox). */
export interface ListingOfferStats {
  listing_id: string;
  unanswered_offer_count: number;
  last_offer_received_at: string | null;
  created_at: string;
  updated_at: string;
}
