/**
 * Edge Function: Create Stripe Connect Account
 * Creates a Stripe Express connected account for seller payouts
 * File: supabase/functions/create-stripe-connect-account/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

// Inline request validation schema
interface CreateStripeConnectAccountRequest {
  userId: string;
}

interface CreateStripeConnectAccountResponse {
  success: boolean;
  methodId?: string;
  stripeAccountId?: string;
  error?: string;
}

// Initialize Stripe
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
console.log('[create-stripe-connect-account] INIT: Stripe key status:', stripeKey ? `set (${stripeKey.substring(0, 20)}...)` : 'MISSING');

const stripe = new Stripe(stripeKey || '', {
  apiVersion: '2023-10-16'
});

// Initialize Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
console.log('[create-stripe-connect-account] INIT: Supabase URL status:', supabaseUrl ? 'set' : 'MISSING');
console.log('[create-stripe-connect-account] INIT: Supabase Service Key status:', supabaseServiceKey ? 'set' : 'MISSING');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[create-stripe-connect-account] CRITICAL: Missing Supabase environment variables');
  console.error('  SUPABASE_URL:', supabaseUrl ? 'present' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'present' : 'MISSING');
}

// DT-121 (2026-09-06): fixed plausible legal identity pre-filled ONLY when the
// Stripe key is a TEST key (sk_test_...).
//
// QA Task-36 (F-5) showed that when no legal identity is pre-filled, the hosted
// Express onboarding asks the seller to enter one, and an implausible or
// display-style name (e.g. the whole profile display name) fails Stripe's
// name+SSN precheck and forces government-ID document verification — an
// unreachable terminal gate for test-mode drives. In TEST mode we pre-fill a
// clean, plausible individual so the hosted flow sails through Stripe's test
// verification without documents. In LIVE mode no `individual` is pre-filled:
// real sellers enter their real legal identity inside the hosted flow.
const TEST_CONNECT_LEGAL_IDENTITY = {
  first_name: 'Test',
  last_name: 'User',
  dob: { day: 1, month: 1, year: 1990 },
  address: {
    line1: '123 Test St',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94102',
    country: 'US',
  },
} as const;
const isTestMode = (stripeKey || '').startsWith('sk_test_');

serve(async (req: Request): Promise<Response> => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    console.log('[create-stripe-connect-account] AUTH: Auth header present:', !!authHeader);
    if (!authHeader) {
      console.error('[create-stripe-connect-account] AUTH: Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log('[create-stripe-connect-account] AUTH: Creating Supabase client');
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    console.log('[create-stripe-connect-account] AUTH: Verifying user from token');
    const token = authHeader.replace('Bearer ', '');
    console.log('[create-stripe-connect-account] AUTH: Token prefix:', token.substring(0, 15) + '...');
    
    if (token === 'undefined' || token === 'null' || !token) {
      console.error('[create-stripe-connect-account] AUTH: Token is invalid string:', token);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError) {
      console.error('[create-stripe-connect-account] AUTH: Auth error:', authError.message);
    }
    if (!user) {
      console.error('[create-stripe-connect-account] AUTH: No user found in token');
    }
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: `Unauthorized: ${authError?.message || 'No user'}` }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    console.log('[create-stripe-connect-account] AUTH: User authenticated:', user.id, 'email:', user.email);

    // Parse and validate request
    let body;
    console.log('[create-stripe-connect-account] REQ: Parsing request body');
    try {
      body = await req.json();
      console.log('[create-stripe-connect-account] REQ: Body parsed successfully, keys:', Object.keys(body));
    } catch (parseError: any) {
      console.error('[create-stripe-connect-account] REQ: Failed to parse JSON:', parseError.message);
      return new Response(
        JSON.stringify({ success: false, error: `Invalid JSON: ${parseError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    
    // Basic validation
    if (!body.userId || typeof body.userId !== 'string') {
      console.error('[create-stripe-connect-account] REQ: Invalid userId:', body.userId);
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { userId } = body as CreateStripeConnectAccountRequest;
    console.log('[create-stripe-connect-account] REQ: userId from body:', userId);
    console.log('[create-stripe-connect-account] REQ: user.id from token:', user.id);
    console.log('[create-stripe-connect-account] REQ: Match:', userId === user.id);

    // Verify user matches authenticated user
    if (userId !== user.id) {
      console.error('[create-stripe-connect-account] SECURITY: User ID mismatch - attempted to access another user');
      return new Response(
        JSON.stringify({ success: false, error: 'User ID mismatch' }),
        { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Check if user already has a Stripe Connect account
    console.log('[create-stripe-connect-account] DB: Checking for existing Stripe Connect method');
    const { data: existingMethod, error: selectError } = await supabase
      .from('seller_payout_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('method_type', 'stripe_connect')
      .maybeSingle();

    if (selectError) {
      console.error('[create-stripe-connect-account] DB: Select error:', selectError.message);
      return new Response(
        JSON.stringify({ success: false, error: `Database error (select): ${selectError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (existingMethod && existingMethod.stripe_account_id) {
      console.log('[create-stripe-connect-account] DB: Found existing method:', existingMethod.id, 'stripe_account_id:', existingMethod.stripe_account_id);
      // Return existing account
      const response: CreateStripeConnectAccountResponse = {
        success: true,
        methodId: existingMethod.id,
        stripeAccountId: existingMethod.stripe_account_id
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    console.log('[create-stripe-connect-account] DB: No existing method found, will create new one');

    // Get user email for Stripe account (optional - use auth email as fallback)
    const userEmail = user.email || `user-${userId}@kids-marketplace.local`;
    console.log('[create-stripe-connect-account] STRIPE: Email to use:', userEmail);
    console.log('[create-stripe-connect-account] STRIPE: Stripe key available:', !!stripeKey);

    // Create Stripe Express account
    let account;
    console.log('[create-stripe-connect-account] STRIPE: Calling stripe.accounts.create()');
    try {
      console.log('[create-stripe-connect-account] STRIPE: Creating account with:', {
        type: 'express',
        country: 'US',
        email: userEmail,
        business_type: 'individual'
      });
      account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: userEmail,
        capabilities: {
          transfers: { requested: true },
          // R4 (2026-08-09): Direct charges require card_payments on the
          // connected account (seller becomes merchant of record; Stripe debits
          // the seller first on disputes). Additive — existing accounts unchanged.
          card_payments: { requested: true }
        },
        business_type: 'individual',
        ...(isTestMode
          ? { individual: TEST_CONNECT_LEGAL_IDENTITY }
          : {}),
        metadata: {
          user_id: userId,
          platform: 'kids_marketplace'
        }
      });
      console.log('[create-stripe-connect-account] STRIPE: Account created successfully:', account.id);
    } catch (stripeError: any) {
      console.error('[create-stripe-connect-account] STRIPE: Error creating account');
      console.error('  Error type:', stripeError.constructor?.name);
      console.error('  Error message:', stripeError.message);
      console.error('  Error code:', stripeError.code);
      console.error('  Error status:', stripeError.status);
      console.error('  Full error:', JSON.stringify(stripeError, null, 2));
      return new Response(
        JSON.stringify({ success: false, error: `Stripe API error: ${stripeError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Create or update payout method record
    if (existingMethod) {
      console.log(`[create-stripe-connect-account] DB: Updating existing payout method ${existingMethod.id}`);
      const { data: updatedMethod, error: updateError } = await supabase
        .from('seller_payout_methods')
        .update({
          stripe_account_id: account.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMethod.id)
        .select()
        .single();

      if (updateError) {
        console.error('[create-stripe-connect-account] DB: Update error:', updateError.message);
        console.error('  Error details:', JSON.stringify(updateError, null, 2));
        return new Response(
          JSON.stringify({ success: false, error: `Database error: ${updateError.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      console.log(`[create-stripe-connect-account] DB: Successfully updated method ${updatedMethod.id}`);
      const response: CreateStripeConnectAccountResponse = {
        success: true,
        methodId: updatedMethod.id,
        stripeAccountId: account.id
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } else {
      console.log(`[create-stripe-connect-account] DB: Creating new payout method for user ${userId}`);
      console.log('[create-stripe-connect-account] DB: Method data:', {
        user_id: userId,
        method_type: 'stripe_connect',
        stripe_account_id: account.id,
        is_primary: false,
        is_verified: false,
        stripe_onboarding_complete: false,
        stripe_payouts_enabled: false
      });
      const { data: newMethod, error: insertError } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: userId,
          method_type: 'stripe_connect',
          stripe_account_id: account.id,
          is_primary: false,
          is_verified: false,
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false,
          stripe_charges_enabled: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('[create-stripe-connect-account] DB: Insert error:', insertError.message);
        console.error('  Error details:', JSON.stringify(insertError, null, 2));
        console.error('  Hint:', insertError.hint);
        console.error('  Code:', insertError.code);
        return new Response(
          JSON.stringify({ success: false, error: `Database error: ${insertError.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      console.log(`[create-stripe-connect-account] DB: Successfully created method ${newMethod.id}`);
      const response: CreateStripeConnectAccountResponse = {
        success: true,
        methodId: newMethod.id,
        stripeAccountId: account.id
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  } catch (error: any) {
    console.error('[create-stripe-connect-account] UNHANDLED ERROR CAUGHT');
    console.error('  Error type:', error?.constructor?.name);
    console.error('  Error message:', error?.message);
    console.error('  Error stack:', error?.stack);
    console.error('  Full error object:', JSON.stringify(error, null, 2));
    const errorMessage = error?.message || error?.toString() || 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
