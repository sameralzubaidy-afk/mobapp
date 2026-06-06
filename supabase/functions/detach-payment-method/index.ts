/**
 * FILE: supabase/functions/detach-payment-method/index.ts
 * MODULE-15.1.2: Detach Payment Method
 *
 * Edge Function to detach a user's saved payment method from Stripe
 * and clear the stripe_payment_method_id from the database.
 *
 * This is called when a user wants to remove their saved card.
 *
 * Response:
 * - success: boolean
 * - message: string
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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

    const userId = user.id;
    console.log('[detach-payment-method] Processing for user:', userId);

    // Get the current payment method ID from subscriptions table
    let paymentMethodId: string | null = null;

    const { data: subscriptionRow, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('stripe_payment_method_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscriptionError) {
      console.warn('[detach-payment-method] subscriptions lookup failed:', subscriptionError.message);
    }

    if (subscriptionRow?.stripe_payment_method_id) {
      paymentMethodId = subscriptionRow.stripe_payment_method_id;
    }

    // Fallback to user_subscriptions
    if (!paymentMethodId) {
      const { data: legacyRow, error: legacyError } = await supabaseClient
        .from('user_subscriptions')
        .select('stripe_payment_method_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (legacyError) {
        console.warn('[detach-payment-method] user_subscriptions fallback lookup failed:', legacyError.message);
      }

      paymentMethodId = legacyRow?.stripe_payment_method_id ?? null;
    }

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No payment method found to remove' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }


    // Detach from Stripe
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
      console.log('[detach-payment-method] Detached payment method from Stripe:', paymentMethodId);
    } catch (stripeError: any) {
      // If the payment method is already detached or doesn't exist, continue with DB cleanup
      console.warn('[detach-payment-method] Stripe detach warning (continuing):', stripeError.message);
    }

    // Clear stripe_payment_method_id from both tables
    const clearPromises: Promise<unknown>[] = [];

    clearPromises.push(
      supabaseClient
        .from('subscriptions')
        .update({ stripe_payment_method_id: null })
        .eq('user_id', userId)
    );

    clearPromises.push(
      supabaseClient
        .from('user_subscriptions')
        .update({ stripe_payment_method_id: null })
        .eq('user_id', userId)
    );

    const results = await Promise.all(clearPromises);
    for (const result of results) {
      if ((result as any).error) {
        console.warn('[detach-payment-method] DB update warning:', (result as any).error.message);
      }
    }

    console.log('[detach-payment-method] Payment method removed successfully for user:', userId);

    return new Response(
      JSON.stringify({ success: true, message: 'Payment method removed successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('[detach-payment-method] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
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
