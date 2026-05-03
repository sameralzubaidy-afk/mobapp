/**
 * Payout Types - Mobile app TypeScript types
 * Mirrors server-side contracts
 * File: p2p-kids-marketplace/src/types/payouts.ts
 */

export type PayoutMethodType = 'stripe_connect' | 'paypal' | 'venmo' | 'bank_ach';

export type PayoutStatus = 'requires_action' | 'pending' | 'processing' | 'completed' | 'failed';

export type PayoutProvider = 'stripe' | 'paypal' | 'ach';

export interface SellerPayoutMethod {
  id: string;
  user_id: string;
  method_type: PayoutMethodType;
  is_primary: boolean;
  is_verified: boolean;

  // Stripe Connect
  stripe_account_id?: string;
  stripe_onboarding_complete: boolean;
  stripe_payouts_enabled: boolean;

  // PayPal/Venmo
  paypal_email?: string;
  venmo_handle?: string;
  venmo_phone_e164?: string;

  // Bank ACH (Post-MVP)
  bank_account_token?: string;
  bank_account_last4?: string;
  bank_routing_last4?: string;
  bank_verification_status?: string;

  created_at: string;
  updated_at: string;
}

export interface SellerPayout {
  id: string;
  user_id: string;
  trade_id?: string | null;
  payout_method_id?: string;
  currency: string;
  gross_amount: number;
  platform_fee: number;
  payout_fee: number;
  net_amount: number;
  // Added cents-based fields to align with server-side types
  gross_amount_cents?: number;
  platform_fee_cents?: number;
  payout_fee_cents?: number;
  net_amount_cents?: number;
  status: PayoutStatus;
  provider?: PayoutProvider;
  provider_reference_id?: string;
  idempotency_key?: string;
  initiated_at?: string;
  completed_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStripeConnectAccountRequest {
  userId: string;
}

export interface CreateStripeConnectAccountResponse {
  success: boolean;
  methodId?: string;
  stripeAccountId?: string;
  error?: string;
}

export interface CreateStripeAccountLinkRequest {
  userId: string;
  methodId: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface CreateStripeAccountLinkResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export interface AddPayoutMethodRequest {
  userId: string;
  methodType: PayoutMethodType;
  paypalEmail?: string;
  venmoHandle?: string;
  venmoPhoneE164?: string;
}

export interface AddPayoutMethodResponse {
  success: boolean;
  methodId?: string;
  error?: string;
}

export interface SetPrimaryPayoutMethodRequest {
  userId: string;
  methodId: string;
}
