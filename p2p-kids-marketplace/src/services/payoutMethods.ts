/**
 * Payout Methods Service
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-003 (Seller Payout Setup UI)
 * 
 * Service layer for managing seller payout methods (Stripe Connect, PayPal, Venmo)
 */

import { supabase } from '../config/supabase';
import type {
  SellerPayoutMethod,
  CreatePayoutMethodRequest,
  UpdatePayoutMethodRequest,
  ListPayoutMethodsResponse,
  PayoutMethodValidation,
  PayoutEligibilityCheck,
  PayoutMethodDisplay,
} from '../types/payout.types';

// =============================================================================
// Constants
// =============================================================================

const PAYOUT_METHODS_TABLE = 'seller_payout_methods';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// =============================================================================
// Stripe Connect Status Sync (Fallback)
// =============================================================================

/**
 * Sync Stripe Connect status from Stripe -> DB.
 * This is a fallback for when `account.updated` webhooks are delayed or misconfigured.
 */
export async function syncStripeConnectStatus(methodId?: string): Promise<void> {
  if (!SUPABASE_URL) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-stripe-connect-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(methodId ? { methodId } : {}),
  });

  if (!res.ok) {
    let message = 'Failed to sync Stripe status';
    try {
      const body = await res.json();
      message = body?.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

// =============================================================================
// Fetch Functions
// =============================================================================

/**
 * List all payout methods for the current user
 */
export async function listPayoutMethods(): Promise<ListPayoutMethodsResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: methods, error } = await supabase
    .from(PAYOUT_METHODS_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch payout methods: ${error.message}`);
  }

  const primaryMethod = methods?.find(m => m.is_primary) || null;
  const hasVerifiedMethod = methods?.some(m => m.is_verified) || false;

  return {
    methods: methods || [],
    primary_method: primaryMethod,
    has_verified_method: hasVerifiedMethod,
  };
}

/**
 * Get a specific payout method by ID
 */
export async function getPayoutMethod(methodId: string): Promise<SellerPayoutMethod> {
  const { data: method, error } = await supabase
    .from(PAYOUT_METHODS_TABLE)
    .select('*')
    .eq('id', methodId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch payout method: ${error.message}`);
  }

  return method;
}

/**
 * Check if user can receive payouts (has verified primary method)
 */
export async function checkPayoutEligibility(): Promise<PayoutEligibilityCheck> {
  const response = await listPayoutMethods();
  const { primary_method, has_verified_method } = response;

  const canReceivePayouts = !!(primary_method && primary_method.is_verified);

  let blockingReason: string | null = null;
  if (!has_verified_method) {
    blockingReason = 'No verified payout method configured';
  } else if (!primary_method) {
    blockingReason = 'No primary payout method selected';
  }

  return {
    can_receive_payouts: canReceivePayouts,
    has_verified_method,
    primary_method,
    blocking_reason: blockingReason,
  };
}

// =============================================================================
// Create/Update Functions
// =============================================================================

/**
 * Create a new payout method
 */
export async function createPayoutMethod(
  request: CreatePayoutMethodRequest
): Promise<SellerPayoutMethod> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Validate input
  const validation = validatePayoutMethodInput(request);
  if (!validation.is_valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // If setting as primary, unset any existing primary method
  if (request.set_as_primary) {
    await unsetPrimaryMethod(user.id);
  }

  const newMethod: Partial<SellerPayoutMethod> = {
    user_id: user.id,
    method_type: request.method_type,
    is_primary: request.set_as_primary || false,
    is_verified: false, // Will be verified later via manual DB update or email confirmation
    stripe_account_id: request.stripe_account_id || null,
    paypal_email: request.paypal_email || null,
    venmo_handle: request.venmo_handle || null,
    venmo_phone_e164: request.venmo_phone_e164 || null,
    stripe_onboarding_complete: false,
    stripe_payouts_enabled: false,
  };

  const { data: method, error } = await supabase
    .from(PAYOUT_METHODS_TABLE)
    .insert(newMethod)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payout method: ${error.message}`);
  }

  return method;
}

/**
 * Update an existing payout method
 */
export async function updatePayoutMethod(
  request: UpdatePayoutMethodRequest
): Promise<SellerPayoutMethod> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Verify ownership
  const existingMethod = await getPayoutMethod(request.method_id);
  if (existingMethod.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot update another user\'s payout method');
  }

  // If setting as primary, unset any existing primary method
  if (request.is_primary) {
    await unsetPrimaryMethod(user.id, request.method_id);
  }

  const updates: Partial<SellerPayoutMethod> = {
    updated_at: new Date().toISOString(),
  };

  if (request.is_primary !== undefined) updates.is_primary = request.is_primary;
  if (request.is_verified !== undefined) updates.is_verified = request.is_verified;
  if (request.stripe_onboarding_complete !== undefined) {
    updates.stripe_onboarding_complete = request.stripe_onboarding_complete;
  }
  if (request.stripe_payouts_enabled !== undefined) {
    updates.stripe_payouts_enabled = request.stripe_payouts_enabled;
  }
  if (request.paypal_email !== undefined) updates.paypal_email = request.paypal_email;
  if (request.venmo_handle !== undefined) updates.venmo_handle = request.venmo_handle;
  if (request.venmo_phone_e164 !== undefined) updates.venmo_phone_e164 = request.venmo_phone_e164;

  const { data: method, error } = await supabase
    .from(PAYOUT_METHODS_TABLE)
    .update(updates)
    .eq('id', request.method_id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update payout method: ${error.message}`);
  }

  return method;
}

/**
 * Delete a payout method
 */
export async function deletePayoutMethod(methodId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Verify ownership
  const existingMethod = await getPayoutMethod(methodId);
  if (existingMethod.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot delete another user\'s payout method');
  }

  // Prevent deleting primary method without confirmation
  if (existingMethod.is_primary) {
    throw new Error('Cannot delete primary payout method. Please set another method as primary first.');
  }

  const { error } = await supabase
    .from(PAYOUT_METHODS_TABLE)
    .delete()
    .eq('id', methodId);

  if (error) {
    throw new Error(`Failed to delete payout method: ${error.message}`);
  }
}

/**
 * Set a payout method as primary
 */
export async function setPrimaryPayoutMethod(methodId: string): Promise<SellerPayoutMethod> {
  return updatePayoutMethod({
    method_id: methodId,
    is_primary: true,
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Unset all primary methods for a user (internal helper)
 */
async function unsetPrimaryMethod(userId: string, exceptMethodId?: string): Promise<void> {
  let query = supabase
    .from(PAYOUT_METHODS_TABLE)
    .update({ is_primary: false })
    .eq('user_id', userId)
    .eq('is_primary', true);

  if (exceptMethodId) {
    query = query.neq('id', exceptMethodId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to unset primary method: ${error.message}`);
  }
}

/**
 * Validate payout method input
 */
function validatePayoutMethodInput(request: CreatePayoutMethodRequest): PayoutMethodValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check method-specific required fields
  switch (request.method_type) {
    case 'stripe_connect':
      // Stripe account ID is optional at creation (will be set after onboarding)
      if (!request.stripe_account_id) {
        warnings.push('Stripe account onboarding will be required');
      }
      break;

    case 'paypal':
      if (!request.paypal_email) {
        errors.push('PayPal email is required');
      } else if (!isValidEmail(request.paypal_email)) {
        errors.push('Invalid PayPal email format');
      }
      break;

    case 'venmo':
      if (!request.venmo_handle && !request.venmo_phone_e164) {
        errors.push('Venmo handle or phone number is required');
      }
      
      // Validate venmo_phone_e164 if provided
      if (request.venmo_phone_e164 && !isValidE164Phone(request.venmo_phone_e164)) {
        errors.push('Invalid phone number format (must be E.164)');
      }
      
      // Check if venmo_handle looks like a phone number (all digits, possibly with formatting)
      // If so, it must be in E.164 format
      if (request.venmo_handle) {
        const handleValue = request.venmo_handle.trim();
        
        // If handle looks like a phone number (contains mostly digits)
        // Remove common formatting characters to check
        const digitsOnly = handleValue.replace(/[\s\-\(\)\.]/g, '');
        const hasLetters = /[a-zA-Z]/.test(handleValue);
        
        // If it's mostly/all digits and doesn't start with @, treat it as a phone number
        if (!hasLetters && !handleValue.startsWith('@') && /^\d+$/.test(digitsOnly)) {
          // Must be E.164 format: starts with +, followed by country code and number
          if (!isValidE164Phone(handleValue)) {
            errors.push('Phone number must be in E.164 format (e.g., +15551234567)');
          }
        }
        
        // If it starts with @ and has digits after, it's a valid Venmo handle
        // If it starts with @ but has no username, invalid
        if (handleValue.startsWith('@') && handleValue.length < 2) {
          errors.push('Invalid Venmo handle format');
        }
      }
      break;

    case 'bank_ach':
      warnings.push('Bank ACH payouts are not yet supported (Post-MVP)');
      break;

    default:
      errors.push(`Unknown payout method type: ${request.method_type}`);
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * PayPal email validation
 * 
 * PayPal requirements:
 * 1. Must be a valid RFC 5322 email format
 * 2. Cannot use test/example/disposable domains
 * 3. Domain must have valid TLD (2+ characters)
 * 4. No spaces, must have @ and domain with extension
 * 
 * Security: Block known test/disposable domains to prevent invalid payout attempts
 */
function isValidEmail(email: string): boolean {
  // Basic format check: must have local@domain.tld structure
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }

  // Extract domain from email
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  // Block test/example/disposable domains
  const blockedDomains = [
    // Test/Example domains (RFC 2606)
    'test.com',
    'example.com',
    'example.org',
    'example.net',
    'test.org',
    'test.net',
    'invalid.com',
    'localhost',
    
    // Common disposable email providers
    'tempmail.com',
    'guerrillamail.com',
    'mailinator.com',
    '10minutemail.com',
    'throwaway.email',
    'temp-mail.org',
    'maildrop.cc',
    'yopmail.com',
  ];

  if (blockedDomains.includes(domain)) {
    return false;
  }

  // Domain must have at least one dot and valid TLD (2+ chars)
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return false;
  }

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return false;
  }

  // TLD must be alphabetic (no numbers-only TLDs like "123")
  if (!/^[a-z]{2,}$/i.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Basic E.164 phone validation
 */
function isValidE164Phone(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Format payout method for display in UI
 */
export function formatPayoutMethodDisplay(method: SellerPayoutMethod): PayoutMethodDisplay {
  let label = '';
  let statusMessage = '';

  switch (method.method_type) {
    case 'stripe_connect':
      if (method.stripe_account_id) {
        const last4 = method.stripe_account_id.slice(-4);
        label = `Stripe (acct_****${last4})`;
      } else {
        label = 'Stripe Connect';
      }
      
      if (method.is_verified && method.stripe_payouts_enabled) {
        statusMessage = 'Verified & Active';
      } else if (method.stripe_onboarding_complete) {
        statusMessage = 'Onboarding complete, pending verification';
      } else {
        statusMessage = 'Onboarding required';
      }
      break;

    case 'paypal':
      label = `PayPal (${method.paypal_email})`;
      statusMessage = method.is_verified ? 'Verified' : 'Verification pending';
      break;

    case 'venmo':
      const venmoId = method.venmo_handle || method.venmo_phone_e164 || 'Unknown';
      label = `Venmo (${venmoId})`;
      statusMessage = method.is_verified ? 'Verified' : 'Verification pending';
      break;

    case 'bank_ach':
      if (method.bank_account_last4) {
        label = `Bank Account (****${method.bank_account_last4})`;
      } else {
        label = 'Bank Account';
      }
      statusMessage = method.is_verified ? 'Verified' : 'Verification required';
      break;

    default:
      label = 'Unknown Method';
      statusMessage = 'Unknown';
  }

  return {
    id: method.id,
    label,
    method_type: method.method_type,
    is_primary: method.is_primary,
    is_verified: method.is_verified,
    status_message: statusMessage,
  };
}
