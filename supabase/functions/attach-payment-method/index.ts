/**
 * FILE: supabase/functions/attach-payment-method/index.ts
 * MODULE-15.1.2: Attach Payment Method (without creating subscription)
 *
 * Edge Function to attach a payment method to a Stripe customer
 * and save the stripe_payment_method_id in the database.
 *
 * This is called when a user adds/updates a payment method from the
 * Payment Methods screen. It does NOT create or modify any subscription.
 *
 * Response:
 * - success: boolean
 * - message: string
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
// FIX-Task-34 item 2/3 (F6): write the default card to BOTH Stripe levels a
// renewal consults (see _shared/subscription-payment-method.ts).
// FIX-Task-37 item 2: also retire the card this one replaces.
import {
  retirePreviousPaymentMethod,
  syncStripeDefaultPaymentMethod,
} from '../_shared/subscription-payment-method.ts';

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

    // Parse request body
    const body = await req.json();
    const paymentMethodId: string | undefined = body.payment_method_id;

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'payment_method_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    console.log('[attach-payment-method] Processing for user:', userId);

    // Get the Stripe customer ID from subscriptions table
    let customerId: string | null = null;
    // FIX-Task-34 item 2/3: the subscription id is needed to write the level that
    // a recurring renewal actually consults FIRST (see the sync call below).
    let stripeSubscriptionId: string | null = null;
    // FIX-Task-37 item 2 (2026-09-16): the card this replace SUPERSEDES. Read it
    // BEFORE the column is overwritten below — afterwards the outgoing pm id is
    // unrecoverable from the DB, which is exactly how the orphans accumulated at
    // Stripe while remaining invisible in the app.
    let previousPaymentMethodId: string | null = null;

    const { data: subscriptionRow, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, stripe_payment_method_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscriptionError) {
      console.warn('[attach-payment-method] subscriptions lookup failed:', subscriptionError.message);
    }

    if (subscriptionRow?.stripe_customer_id) {
      customerId = subscriptionRow.stripe_customer_id;
    }
    if (subscriptionRow?.stripe_subscription_id) {
      stripeSubscriptionId = subscriptionRow.stripe_subscription_id;
    }
    if (subscriptionRow?.stripe_payment_method_id) {
      previousPaymentMethodId = subscriptionRow.stripe_payment_method_id;
    }

    // Fallback to user_subscriptions
    if (!customerId) {
      const { data: legacyRow, error: legacyError } = await supabaseClient
        .from('user_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (legacyError) {
        console.warn('[attach-payment-method] user_subscriptions fallback lookup failed:', legacyError.message);
      }

      customerId = legacyRow?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No Stripe customer found. Please try again or contact support.' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Attach payment method to Stripe customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      console.log('[attach-payment-method] Attached payment method to Stripe customer:', customerId);
    } catch (stripeError: any) {
      // If already attached, that's fine - continue
      if (stripeError.code === 'resource_already_exists') {
        console.log('[attach-payment-method] Payment method already attached to customer');
      } else {
        console.error('[attach-payment-method] Stripe attach error:', stripeError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to attach payment method to Stripe customer' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }
    }

    // Set as default payment method on the customer
    // FIX-Task-34 item 2/3 (F6): this used to write the CUSTOMER level only, and to
    // swallow a failure with a bare `console.warn(... 'continuing')` — so a Stripe
    // hiccup here produced exactly the drift F6 describes: the DB said one card,
    // Stripe's customer default said another, and the subscription (whose default
    // Stripe consults FIRST at renewal) was never written at all.
    // One shared helper now writes BOTH levels and reports failures back instead
    // of hiding them. Still best-effort: attaching a card must not fail because a
    // default-sync call did.
    const defaultSync = await syncStripeDefaultPaymentMethod(stripe, {
      customerId,
      subscriptionId: stripeSubscriptionId,
      paymentMethodId,
    });
    if (defaultSync.errors.length) {
      console.warn(
        '[attach-payment-method] Stripe default-payment-method sync had errors:',
        defaultSync.errors.join('; ')
      );
    }

    // Save stripe_payment_method_id to both tables (without changing subscription status)
    // FIX-Task-34 (Tier-0 unblock, zero runtime effect): a supabase-js query builder
    // is a PromiseLike, not a Promise, so the former `Promise<unknown>[]` declaration
    // made `deno check` fail on both pushes below. That failure PRE-DATES this task
    // (verified against HEAD) and is purely a type annotation — `Promise.all` accepts
    // PromiseLike, and the runtime behaviour is unchanged.
    const updatePromises: PromiseLike<unknown>[] = [];

    updatePromises.push(
      supabaseClient
        .from('subscriptions')
        .update({ stripe_payment_method_id: paymentMethodId })
        .eq('user_id', userId)
    );

    updatePromises.push(
      supabaseClient
        .from('user_subscriptions')
        .update({ stripe_payment_method_id: paymentMethodId })
        .eq('user_id', userId)
    );

    const results = await Promise.all(updatePromises);
    for (const result of results) {
      if ((result as any).error) {
        console.warn('[attach-payment-method] DB update warning:', (result as any).error.message);
      }
    }

    console.log('[attach-payment-method] Payment method saved successfully for user:', userId);

    // FIX-Task-37 item 2 (2026-09-16): retire the card this one REPLACED.
    // Runs LAST on purpose — the new card is attached, is the default at both
    // Stripe levels, and is already persisted in the DB before the old token is
    // destroyed. Best-effort: `retirePreviousPaymentMethod` never throws and
    // reports why it skipped, so a detach problem cannot fail the user's update.
    const retired = await retirePreviousPaymentMethod(stripe, {
      customerId,
      previousPaymentMethodId,
      newPaymentMethodId: paymentMethodId,
    });
    if (retired.error) {
      console.warn(
        '[attach-payment-method] replaced card could not be detached (non-fatal):',
        retired.error
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payment method saved successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('[attach-payment-method] Error:', error);
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
