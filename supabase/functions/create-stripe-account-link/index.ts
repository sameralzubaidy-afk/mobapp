/**
 * Edge Function: Create Stripe Account Link
 * Generates an onboarding link for Stripe Express accounts
 * File: supabase/functions/create-stripe-account-link/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

// Inline request/response types
interface CreateStripeAccountLinkRequest {
  userId: string;
  methodId: string;
  returnUrl: string;
  refreshUrl: string;
}

interface CreateStripeAccountLinkResponse {
  success: boolean;
  url?: string;
  error?: string;
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16'
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    console.log('[create-stripe-account-link] AUTH: Auth header present:', !!authHeader);
    if (!authHeader) {
      console.error('[create-stripe-account-link] AUTH: Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log('[create-stripe-account-link] AUTH: Creating Supabase client');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[create-stripe-account-link] AUTH: Verifying user from token');
    const token = authHeader.replace('Bearer ', '');
    if (token === 'undefined' || token === 'null' || !token) {
      console.error('[create-stripe-account-link] AUTH: Token is invalid string:', token);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[create-stripe-account-link] AUTH: Auth error:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ success: false, error: `Unauthorized: ${authError?.message || 'No user'}` }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    console.log('[create-stripe-account-link] AUTH: User authenticated:', user.id);

    // Parse and validate request
    const body = await req.json();
    console.log('[create-stripe-account-link] REQ: Body parsed');
    
    // Basic validation
    if (!body.userId || !body.methodId || !body.returnUrl || !body.refreshUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { userId, methodId, returnUrl, refreshUrl } = body as CreateStripeAccountLinkRequest;
    console.log('[create-stripe-account-link] REQ: userId:', userId, 'methodId:', methodId);
    console.log('[create-stripe-account-link] REQ: returnUrl:', returnUrl);
    console.log('[create-stripe-account-link] REQ: refreshUrl:', refreshUrl);

    // Verify user matches authenticated user
    if (userId !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID mismatch' }),
        { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Get payout method
    const { data: method, error: methodError } = await supabase
      .from('seller_payout_methods')
      .select('*')
      .eq('id', methodId)
      .eq('user_id', userId)
      .eq('method_type', 'stripe_connect')
      .single();

    if (methodError || !method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payout method not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (!method.stripe_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe account not created' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Create account link
    console.log('[create-stripe-account-link] STRIPE: Creating account link for:', method.stripe_account_id);
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: method.stripe_account_id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      });
      console.log('[create-stripe-account-link] STRIPE: Account link created:', accountLink.url);
    } catch (stripeError: any) {
      console.error('[create-stripe-account-link] STRIPE: Error creating account link:', stripeError.message);
      console.error('  Full error:', JSON.stringify(stripeError, null, 2));
      return new Response(
        JSON.stringify({ success: false, error: `Stripe error: ${stripeError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const response: CreateStripeAccountLinkResponse = {
      success: true,
      url: accountLink.url
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    console.error('Error creating Stripe account link:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
