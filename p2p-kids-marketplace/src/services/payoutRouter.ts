/**
 * Payout Router Service - Orchestrates seller payout dispatch logic
 * File: p2p-kids-marketplace/src/services/payoutRouter.ts
 * 
 * PURPOSE:
 * - Route seller payouts to appropriate providers (Stripe/PayPal/Venmo)
 * - Check admin config for auto-payout behavior
 * - Handle manual withdrawal requests
 */

import { supabase } from '../config/supabase';
import { SellerPayout, PayoutMethodType } from '../types/payouts';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/**
 * Admin payout configuration interface
 */
export interface AdminPayoutConfig {
  enable_automatic_seller_payout: boolean;
  minimum_withdrawal_amount_cents: number;
  stripe_payout_fee_fixed_cents: number;
  stripe_payout_fee_percentage: number;
  paypal_payout_fee_percentage: number;
  paypal_payout_fee_cap_cents: number;
}

/**
 * Payout router result interface
 */
export interface PayoutRouterResult {
  success: boolean;
  payoutId?: string;
  status?: string;
  autoPayoutEnabled?: boolean;
  hasVerifiedMethod?: boolean;
  provider?: string;
  error?: string;
  message?: string;
}

/**
 * Get admin payout configuration
 */
export async function getAdminPayoutConfig(): Promise<AdminPayoutConfig> {
  const { data, error } = await supabase
    .rpc('get_admin_payout_config')
    .single();

  if (error) {
    console.error('[payoutRouter] Error fetching admin config:', error);
    // Return defaults if config fetch fails
    return {
      enable_automatic_seller_payout: false,
      minimum_withdrawal_amount_cents: 500,
      stripe_payout_fee_fixed_cents: 25,
      stripe_payout_fee_percentage: 0.25,
      paypal_payout_fee_percentage: 2.0,
      paypal_payout_fee_cap_cents: 2000
    };
  }

  return data;
}

/**
 * Calculate payout fee based on method type and amount
 */
export function calculatePayoutFeeCents(
  methodType: PayoutMethodType,
  amountCents: number
): number {
  if (amountCents <= 0) return 0;

  switch (methodType) {
    case 'stripe_connect':
      // 0.25% + $0.25
      return Math.round(amountCents * 0.0025) + 25;
    
    case 'paypal':
    case 'venmo':
      // 2% capped at $20
      return Math.min(Math.round(amountCents * 0.02), 2000);
    
    case 'bank_ach':
      // Flat $0.25 (Post-MVP)
      return 25;
    
    default:
      return 0;
  }
}

/**
 * Compute net payout amount
 */
export function computeNetPayoutCents(
  grossCents: number,
  platformFeeCents: number,
  payoutFeeCents: number
): number {
  return Math.max(0, grossCents - platformFeeCents - payoutFeeCents);
}

/**
 * Request manual payout withdrawal (when auto-payout is disabled)
 * This dispatches a pending payout to the provider
 */
export async function requestPayoutWithdrawal(
  payoutId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Fetch the payout record
    const { data: payout, error: fetchError } = await supabase
      .from('seller_payouts')
      .select('*, payout_method:seller_payout_methods(*)')
      .eq('id', payoutId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !payout) {
      return { success: false, error: 'Payout not found' };
    }

    // Verify payout is in pending status
    if (payout.status !== 'pending') {
      return { 
        success: false, 
        error: `Cannot withdraw payout with status: ${payout.status}. Expected: pending` 
      };
    }

    // Verify user has a verified payout method
    if (!payout.payout_method || !payout.payout_method.is_verified) {
      return { 
        success: false, 
        error: 'Please set up and verify a payout method before requesting withdrawal' 
      };
    }

    // Route to appropriate provider
    const methodType = payout.payout_method.method_type;

    if (methodType === 'stripe_connect') {
      // Stripe payouts are handled automatically via Stripe Connect
      // Just mark as processing (Stripe will handle the transfer)
      const { error: updateError } = await supabase
        .from('seller_payouts')
        .update({
          status: 'processing',
          initiated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', payoutId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } else if (methodType === 'paypal' || methodType === 'venmo') {
      // Call PayPal payout edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/process-paypal-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ payoutId })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to process PayPal payout' };
      }

      return { success: true };
    } else {
      return { success: false, error: `Unsupported payout method: ${methodType}` };
    }
  } catch (error: any) {
    console.error('[payoutRouter] requestPayoutWithdrawal error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if seller has pending payouts available for withdrawal
 */
export async function getPendingPayoutsBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('seller_payouts')
    .select('net_amount_cents')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('[payoutRouter] Error fetching pending payouts:', error);
    return 0;
  }

  if (!data || data.length === 0) {
    return 0;
  }

  return data.reduce((sum, payout) => sum + (payout.net_amount_cents || 0), 0);
}

/**
 * Get payout status display message for users
 */
export function getPayoutStatusMessage(status: string): string {
  switch (status) {
    case 'requires_action':
      return 'Please set up a payout method to receive your earnings';
    case 'pending':
      return 'Available to withdraw';
    case 'processing':
      return 'Processing - funds will arrive within 2-5 business days';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed - please contact support';
    default:
      return 'Unknown status';
  }
}

/**
 * Format amount in cents to display format
 */
export function formatPayoutAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
