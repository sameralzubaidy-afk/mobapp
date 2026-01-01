/**
 * Seller Balance Service
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * 
 * Service for managing seller balance, earnings, and withdrawal requests
 */

import { supabase } from '../config/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// =============================================================================
// Types
// =============================================================================

export interface SellerBalance {
  user_id: string;
  available_balance_cents: number;
  pending_balance_cents: number;
  lifetime_earnings_cents: number;
  total_trades_completed: number;
  total_trades_pending: number;
  last_payout_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerPayout {
  id: string;
  user_id: string;
  trade_id: string | null;
  payout_method_id: string | null;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  payout_fee_cents: number;
  net_amount_cents: number;
  status: 'requires_action' | 'pending' | 'processing' | 'completed' | 'failed';
  provider: string | null;
  provider_reference_id: string | null;
  idempotency_key: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WithdrawalRequest {
  amount_cents: number;
}

export interface WithdrawalResponse {
  success: boolean;
  payout_id?: string;
  amount_cents?: number;
  payout_fee_cents?: number;
  net_amount_cents?: number;
  method_type?: string;
  status?: string;
  message?: string;
  error?: string;
  action_required?: 'add_payout_method' | 'verify_payout_method';
  available?: number;
  requested?: number;
  minimum_required?: number;
}

export type ProcessPayPalPayoutResponse = {
  success: boolean;
  payoutId?: string;
  batchId?: string;
  status?: string;
  error?: string;
};

export interface BalanceDisplay {
  available: string;
  pending: string;
  lifetime: string;
  available_cents: number;
  pending_cents: number;
  lifetime_cents: number;
}

// =============================================================================
// Balance Queries
// =============================================================================

/**
 * Get seller balance for the authenticated user
 */
export async function getSellerBalance(): Promise<SellerBalance | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('seller_balance')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // If no balance record exists yet, return default balance
    if (error.code === 'PGRST116') {
      return {
        user_id: user.id,
        available_balance_cents: 0,
        pending_balance_cents: 0,
        lifetime_earnings_cents: 0,
        total_trades_completed: 0,
        total_trades_pending: 0,
        last_payout_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw error;
  }

  return data;
}

/**
 * Format balance for display (converts cents to dollars)
 */
export function formatBalanceForDisplay(balance: SellerBalance | null): BalanceDisplay {
  if (!balance) {
    return {
      available: '$0.00',
      pending: '$0.00',
      lifetime: '$0.00',
      available_cents: 0,
      pending_cents: 0,
      lifetime_cents: 0,
    };
  }

  return {
    available: formatCentsToDollars(balance.available_balance_cents),
    pending: formatCentsToDollars(balance.pending_balance_cents),
    lifetime: formatCentsToDollars(balance.lifetime_earnings_cents),
    available_cents: balance.available_balance_cents,
    pending_cents: balance.pending_balance_cents,
    lifetime_cents: balance.lifetime_earnings_cents,
  };
}

/**
 * Format cents to dollar string (e.g., 12345 -> "$123.45")
 */
export function formatCentsToDollars(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Calculate payout fee based on method type and amount
 */
export function calculatePayoutFee(methodType: string, amountCents: number): number {
  if (amountCents <= 0) return 0;

  switch (methodType) {
    case 'stripe_connect':
      // Stripe: $0.25 + 0.25%
      return Math.round(amountCents * 0.0025) + 25;
    
    case 'paypal':
    case 'venmo':
      // PayPal/Venmo: 2% capped at $20
      return Math.min(Math.round(amountCents * 0.02), 2000);
    
    case 'bank_ach':
      // Bank ACH: $0.25 flat (placeholder)
      return 25;
    
    default:
      return 0;
  }
}

// =============================================================================
// Payout History
// =============================================================================

/**
 * Get recent payouts for the authenticated user
 */
export async function getRecentPayouts(limit: number = 10): Promise<SellerPayout[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('seller_payouts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Get payout by ID
 */
export async function getPayoutById(payoutId: string): Promise<SellerPayout | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('seller_payouts')
    .select('*')
    .eq('id', payoutId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Format payout status for display
 */
export function formatPayoutStatus(status: string): { label: string; color: string } {
  switch (status) {
    case 'requires_action':
      return { label: 'Action Required', color: '#FFA500' };
    case 'pending':
      return { label: 'Pending', color: '#999' };
    case 'processing':
      return { label: 'Processing', color: '#007AFF' };
    case 'completed':
      return { label: 'Completed', color: '#28a745' };
    case 'failed':
      return { label: 'Failed', color: '#dc3545' };
    default:
      return { label: 'Unknown', color: '#666' };
  }
}

// =============================================================================
// Withdrawal Request
// =============================================================================

/**
 * Get minimum withdrawal amount from admin config
 */
async function getMinimumWithdrawalAmount(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'minimum_withdrawal_amount_cents')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn('Failed to fetch minimum withdrawal config, using default: 500 cents');
      return 500; // Default: $5.00
    }

    const minAmount = parseInt(data.value, 10);
    return isNaN(minAmount) ? 500 : minAmount;
  } catch (error) {
    console.error('Error fetching minimum withdrawal amount:', error);
    return 500; // Default: $5.00
  }
}

/**
 * Request a manual payout/withdrawal
 */
export async function requestWithdrawal(amountCents: number): Promise<WithdrawalResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Validate amount
  if (amountCents <= 0) {
    return {
      success: false,
      error: 'Withdrawal amount must be greater than $0.00',
    };
  }

  // Fetch minimum withdrawal amount from admin config
  const minimumCents = await getMinimumWithdrawalAmount();
  
  // If minimum is 0, skip the minimum check (effectively disabled)
  if (minimumCents > 0 && amountCents < minimumCents) {
    const minDollars = formatCentsToDollars(minimumCents);
    return {
      success: false,
      error: `Minimum withdrawal amount is ${minDollars}`,
      minimum_required: minimumCents,
    };
  }

  // Call RPC function
  const { data, error } = await supabase.rpc('request_seller_payout', {
    p_user_id: user.id,
    p_amount_cents: amountCents,
  });

  if (error) {
    throw error;
  }

  return data as WithdrawalResponse;
}

/**
 * Request withdrawal of full available balance
 */
export async function requestFullWithdrawal(): Promise<WithdrawalResponse> {
  const balance = await getSellerBalance();
  
  if (!balance || balance.available_balance_cents <= 0) {
    return {
      success: false,
      error: 'No available balance to withdraw',
    };
  }

  return requestWithdrawal(balance.available_balance_cents);
}

/**
 * Submit an existing pending payout to PayPal (also used for Venmo payouts).
 * This triggers real PayPal processing + real PayPal webhooks.
 */
export async function submitPayPalPayout(payoutId: string, idempotencyKey?: string): Promise<ProcessPayPalPayoutResponse> {
  if (!SUPABASE_URL) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/process-paypal-payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ payoutId, ...(idempotencyKey ? { idempotencyKey } : {}) }),
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.error || `Failed to submit payout (HTTP ${res.status})`;
    return { success: false, error: message };
  }

  return payload as ProcessPayPalPayoutResponse;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if user can withdraw (has balance and verified payout method)
 */
export async function canUserWithdraw(): Promise<{
  can_withdraw: boolean;
  reason?: string;
  available_balance_cents: number;
}> {
  const balance = await getSellerBalance();
  
  if (!balance || balance.available_balance_cents <= 0) {
    return {
      can_withdraw: false,
      reason: 'No available balance',
      available_balance_cents: 0,
    };
  }

  // Check if user has a verified primary payout method
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      can_withdraw: false,
      reason: 'Not authenticated',
      available_balance_cents: balance.available_balance_cents,
    };
  }

  const { data: primaryMethod } = await supabase
    .from('seller_payout_methods')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .eq('is_verified', true)
    .single();

  if (!primaryMethod) {
    return {
      can_withdraw: false,
      reason: 'No verified payout method configured',
      available_balance_cents: balance.available_balance_cents,
    };
  }

  return {
    can_withdraw: true,
    available_balance_cents: balance.available_balance_cents,
  };
}
