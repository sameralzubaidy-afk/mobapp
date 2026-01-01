/**
 * Payout Service - Mobile app service for seller payout management
 * File: p2p-kids-marketplace/src/services/payoutService.ts
 */

import { supabase } from '../config/supabase';
import {
  SellerPayoutMethod,
  SellerPayout,
  CreateStripeConnectAccountRequest,
  CreateStripeConnectAccountResponse,
  CreateStripeAccountLinkRequest,
  CreateStripeAccountLinkResponse,
  AddPayoutMethodRequest,
  AddPayoutMethodResponse,
  PayoutMethodType
} from '../types/payouts';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/**
 * Get all payout methods for a user
 */
export async function getPayoutMethods(userId: string): Promise<SellerPayoutMethod[]> {
  const { data, error } = await supabase
    .from('seller_payout_methods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payout methods:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get primary payout method for a user
 */
export async function getPrimaryPayoutMethod(userId: string): Promise<SellerPayoutMethod | null> {
  const { data, error } = await supabase
    .from('seller_payout_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching primary payout method:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create Stripe Connect account
 */
export async function createStripeConnectAccount(
  userId: string
): Promise<CreateStripeConnectAccountResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const request: CreateStripeConnectAccountRequest = { userId };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-connect-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create Stripe Connect account');
  }

  return await response.json();
}

/**
 * Create Stripe account onboarding link
 */
export async function createStripeAccountLink(
  userId: string,
  methodId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<CreateStripeAccountLinkResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const request: CreateStripeAccountLinkRequest = {
    userId,
    methodId,
    returnUrl,
    refreshUrl
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-account-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create account link');
  }

  return await response.json();
}

/**
 * Add PayPal payout method
 */
export async function addPayPalMethod(
  userId: string,
  email: string
): Promise<AddPayoutMethodResponse> {
  const { data, error } = await supabase
    .from('seller_payout_methods')
    .insert({
      user_id: userId,
      method_type: 'paypal',
      paypal_email: email,
      is_primary: false,
      is_verified: false,
      stripe_onboarding_complete: false,
      stripe_payouts_enabled: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding PayPal method:', error);
    return { success: false, error: error.message };
  }

  return { success: true, methodId: data.id };
}

/**
 * Add Venmo payout method
 */
export async function addVenmoMethod(
  userId: string,
  handle?: string,
  phoneE164?: string
): Promise<AddPayoutMethodResponse> {
  if (!handle && !phoneE164) {
    return { success: false, error: 'Either handle or phone is required' };
  }

  const { data, error } = await supabase
    .from('seller_payout_methods')
    .insert({
      user_id: userId,
      method_type: 'venmo',
      venmo_handle: handle,
      venmo_phone_e164: phoneE164,
      is_primary: false,
      is_verified: false,
      stripe_onboarding_complete: false,
      stripe_payouts_enabled: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding Venmo method:', error);
    return { success: false, error: error.message };
  }

  return { success: true, methodId: data.id };
}

/**
 * Set payout method as primary
 */
export async function setPrimaryPayoutMethod(
  userId: string,
  methodId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify method is verified
  const { data: method, error: fetchError } = await supabase
    .from('seller_payout_methods')
    .select('*')
    .eq('id', methodId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !method) {
    return { success: false, error: 'Payout method not found' };
  }

  if (!method.is_verified) {
    return { success: false, error: 'Payout method must be verified before setting as primary' };
  }

  // Use RPC to atomically update primary method
  const { error } = await supabase.rpc('set_primary_payout_method', {
    p_user_id: userId,
    p_method_id: methodId
  });

  if (error) {
    console.error('Error setting primary payout method:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete payout method
 */
export async function deletePayoutMethod(
  methodId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('seller_payout_methods')
    .delete()
    .eq('id', methodId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting payout method:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get seller payouts
 */
export async function getSellerPayouts(
  userId: string,
  limit: number = 20
): Promise<SellerPayout[]> {
  const { data, error } = await supabase
    .from('seller_payouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching seller payouts:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get payout method display name
 */
export function getPayoutMethodDisplayName(method: SellerPayoutMethod): string {
  switch (method.method_type) {
    case 'stripe_connect':
      return 'Stripe (Bank Transfer)';
    case 'paypal':
      return `PayPal (${method.paypal_email})`;
    case 'venmo':
      return `Venmo (${method.venmo_handle || method.venmo_phone_e164})`;
    case 'bank_ach':
      return `Bank Account (...${method.bank_account_last4})`;
    default:
      return 'Unknown';
  }
}

/**
 * Get payout method status label
 */
export function getPayoutMethodStatusLabel(method: SellerPayoutMethod): string {
  if (method.is_verified) {
    return 'Verified';
  } else if (method.method_type === 'stripe_connect' && method.stripe_account_id) {
    if (method.stripe_onboarding_complete) {
      return 'Pending Verification';
    } else {
      return 'Setup Incomplete';
    }
  } else {
    return 'Not Verified';
  }
}
