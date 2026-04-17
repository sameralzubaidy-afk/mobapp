/**
 * FILE: supabase/functions/get-payment-method/index.ts
 * MODULE-11 TASK SUB-017: Get Payment Method Details
 * 
 * Edge Function to retrieve saved payment method details from Stripe.
 * Returns formatted payment method info (last 4 digits, brand, expiry).
 * 
 * Response:
 * - payment_method: { id, brand, last4, exp_month, exp_year } | null
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const user_id = user.id;

    console.log('[get-payment-method] Fetching payment method for user:', user_id);

    // Fetch from canonical subscriptions table first, then fallback to legacy user_subscriptions.
    let paymentMethodId: string | null = null;

    const { data: subscriptionRow, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('stripe_payment_method_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (subscriptionError) {
      console.warn('[get-payment-method] subscriptions lookup failed, falling back:', subscriptionError.message);
    }

    if (subscriptionRow?.stripe_payment_method_id) {
      paymentMethodId = subscriptionRow.stripe_payment_method_id;
    }

    if (!paymentMethodId) {
      const { data: legacyRow, error: legacyError } = await supabaseClient
        .from('user_subscriptions')
        .select('stripe_payment_method_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (legacyError) {
        console.warn('[get-payment-method] user_subscriptions fallback lookup failed:', legacyError.message);
      }

      paymentMethodId = legacyRow?.stripe_payment_method_id ?? null;
    }

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ payment_method: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Fetch payment method from Stripe
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      const result = {
        payment_method: {
          id: paymentMethod.id,
          brand: paymentMethod.card?.brand || 'unknown',
          last4: paymentMethod.card?.last4 || '****',
          exp_month: paymentMethod.card?.exp_month || 0,
          exp_year: paymentMethod.card?.exp_year || 0,
        },
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (stripeError: any) {
      console.error('[get-payment-method] Stripe error:', stripeError);

      // Payment method might be deleted/detached, return null
      return new Response(
        JSON.stringify({ payment_method: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }
  } catch (error: any) {
    console.error('[get-payment-method] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
