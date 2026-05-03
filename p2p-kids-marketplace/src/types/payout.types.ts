/**
 * Type definitions for Seller Payouts system
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-001 (Database Schema)
 */

// =============================================================================
// Enums
// =============================================================================

/**
 * Payout method types supported by the platform
 */
export type PayoutMethodType =
  | 'stripe_connect' // Stripe Connect Express accounts
  | 'paypal' // PayPal email payouts
  | 'venmo' // Venmo handle/phone payouts (via PayPal API)
  | 'bank_ach'; // Direct bank deposits (Post-MVP)

/**
 * Payout ledger status values
 */
export type PayoutStatus =
  | 'requires_action' // Seller must set up/verify payout method
  | 'pending' // Created, not yet submitted to provider
  | 'processing' // Submitted to provider, awaiting confirmation
  | 'completed' // Provider confirmed successful payout
  | 'failed'; // Provider reported failure

/**
 * Payment provider identifiers
 */
export type PayoutProvider = 'stripe' | 'paypal' | 'ach';

// =============================================================================
// Database Models
// =============================================================================

/**
 * Seller payout method configuration
 * One user can have multiple methods; exactly one can be primary
 */
export interface SellerPayoutMethod {
  id: string;
  user_id: string;

  // Method configuration
  method_type: PayoutMethodType;
  is_primary: boolean;
  is_verified: boolean;

  // Stripe Connect fields
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_payouts_enabled: boolean;

  // PayPal/Venmo fields
  paypal_email: string | null;
  venmo_handle: string | null;
  venmo_phone_e164: string | null;

  // Bank ACH fields (Post-MVP)
  bank_account_token: string | null;
  bank_account_last4: string | null;
  bank_routing_last4: string | null;
  bank_verification_status: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Seller payout ledger record
 * One record per completed trade (or requires_action placeholder)
 */
export interface SellerPayout {
  id: string;
  user_id: string;
  trade_id: string | null;
  payout_method_id: string | null;

  // Currency
  currency: string; // Default 'usd'

  // Amount breakdown (in cents)
  gross_amount_cents: number;
  platform_fee_cents: number;
  payout_fee_cents: number;
  net_amount_cents: number;

  // Status tracking
  status: PayoutStatus;

  // Provider information
  provider: PayoutProvider | null;
  provider_reference_id: string | null;

  // Idempotency
  idempotency_key: string | null;

  // Timestamps
  initiated_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request to create/add a new payout method
 */
export interface CreatePayoutMethodRequest {
  method_type: PayoutMethodType;

  // Stripe Connect
  stripe_account_id?: string;

  // PayPal
  paypal_email?: string;

  // Venmo
  venmo_handle?: string;
  venmo_phone_e164?: string;

  // Should this be the primary method?
  set_as_primary?: boolean;
}

/**
 * Request to update an existing payout method
 */
export interface UpdatePayoutMethodRequest {
  method_id: string;
  is_primary?: boolean;
  is_verified?: boolean;

  // Update provider-specific fields
  stripe_onboarding_complete?: boolean;
  stripe_payouts_enabled?: boolean;
  paypal_email?: string;
  venmo_handle?: string;
  venmo_phone_e164?: string;
}

/**
 * Response when listing user's payout methods
 */
export interface ListPayoutMethodsResponse {
  methods: SellerPayoutMethod[];
  primary_method: SellerPayoutMethod | null;
  has_verified_method: boolean;
}

/**
 * Request to trigger payout for a completed trade
 */
export interface TriggerPayoutRequest {
  trade_id: string;
  payout_method_id?: string; // Optional override; defaults to primary
}

/**
 * Response after triggering payout
 */
export interface TriggerPayoutResponse {
  payout_id: string;
  status: PayoutStatus;
  net_amount_cents: number;
  provider: PayoutProvider | null;
  message: string;
}

/**
 * Request to list seller's payout history
 */
export interface ListPayoutsRequest {
  user_id?: string; // Admin can specify; regular users get their own
  status_filter?: PayoutStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Response when listing payouts
 */
export interface ListPayoutsResponse {
  payouts: SellerPayout[];
  total_count: number;
  total_earnings_cents: number;
  pending_earnings_cents: number;
}

// =============================================================================
// Display/UI Helper Types
// =============================================================================

/**
 * User-friendly display data for payout method
 */
export interface PayoutMethodDisplay {
  id: string;
  label: string; // e.g., "Stripe (acct_****5678)", "PayPal (user@example.com)"
  method_type: PayoutMethodType;
  is_primary: boolean;
  is_verified: boolean;
  status_message: string; // e.g., "Verified", "Onboarding incomplete"
}

/**
 * User-friendly display data for payout
 */
export interface PayoutDisplay {
  id: string;
  date: string;
  trade_id: string | null;
  status: PayoutStatus;
  status_label: string; // e.g., "Completed", "Processing"
  net_amount_display: string; // e.g., "$45.00"
  payout_fee_display: string; // e.g., "$0.50"
  method_label: string; // e.g., "Stripe", "PayPal"
  failure_reason: string | null;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for payout method creation
 */
export interface PayoutMethodValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check if user can receive payouts (has verified method)
 */
export interface PayoutEligibilityCheck {
  can_receive_payouts: boolean;
  has_verified_method: boolean;
  primary_method: SellerPayoutMethod | null;
  blocking_reason: string | null;
}
