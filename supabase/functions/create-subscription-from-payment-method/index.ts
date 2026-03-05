// File: supabase/functions/create-subscription-from-payment-method/index.ts
// MODULE-11 SUB-015: Create Stripe subscription after payment method collected

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

interface CreateSubscriptionRequest {
  user_id: string;
  payment_method_id: string;
  is_renewal?: boolean;
}

interface CreateSubscriptionResponse {
  subscription_id: string;
  status: string;
  current_period_end: string;
  trial_end?: string | null;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify JWT and get user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[create-subscription-from-payment-method] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: CreateSubscriptionRequest = await req.json();
    const userId = body.user_id || user.id;
    const paymentMethodId = body.payment_method_id;
    const isRenewal = body.is_renewal || false;

    if (!paymentMethodId) {
      return new Response(JSON.stringify({ error: 'Missing payment_method_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify user matches token
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user profile and subscription  
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile || !profile.stripe_customer_id) {
      console.error('[create-subscription-from-payment-method] Profile/customer error:', profileError);
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customerId = profile.stripe_customer_id;

    // Get user subscription record
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError) {
      console.error('[create-subscription-from-payment-method] Subscription fetch error:', subError);
      return new Response(JSON.stringify({ error: 'Subscription record not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Kids Club+ tier
    const { data: tier, error: tierError } = await supabaseClient
      .from('subscription_tiers')
      .select('id, stripe_price_id, price_cents, trial_days')
      .eq('name', 'kids_club_plus')
      .eq('is_active', true)
      .single();

    if (tierError || !tier) {
      console.error('[create-subscription-from-payment-method] Tier fetch error:', tierError);
      return new Response(JSON.stringify({ error: 'Subscription tier not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Attach payment method to customer and set as default
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    let stripeSubscription: Stripe.Subscription;

    // Check if renewal (updating existing subscription)
    if (isRenewal && subscription.stripe_subscription_id) {
      // Update existing subscription with new payment method
      stripeSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        default_payment_method: paymentMethodId,
        cancel_at_period_end: false, // Resume if it was set to cancel
      });

      console.log('[create-subscription-from-payment-method] Updated existing subscription:', {
        subscription_id: stripeSubscription.id,
        status: stripeSubscription.status,
      });
    } else {
      // Create new subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [
          {
            price: tier.stripe_price_id || undefined,
            price_data: tier.stripe_price_id
              ? undefined
              : {
                  currency: 'usd',
                  product_data: {
                    name: 'Kids Club+',
                    description: 'Monthly subscription with Swap Points access',
                  },
                  recurring: {
                    interval: 'month',
                  },
                  unit_amount: tier.price_cents,
                },
          },
        ],
        default_payment_method: paymentMethodId,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          user_id: userId,
          tier_id: tier.id,
        },
      };

      // If user still in trial, preserve trial end date
      if (subscription.status === 'trial' && subscription.trial_ends_at) {
        const trialEndTimestamp = Math.floor(new Date(subscription.trial_ends_at).getTime() / 1000);
        subscriptionParams.trial_end = trialEndTimestamp;
      }

      stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

      console.log('[create-subscription-from-payment-method] Created new subscription:', {
        subscription_id: stripeSubscription.id,
        status: stripeSubscription.status,
      });
    }

    // Update user_subscriptions with Stripe IDs
    const updateData: any = {
      stripe_subscription_id: stripeSubscription.id,
      stripe_payment_method_id: paymentMethodId,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      next_billing_date: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      monthly_price_cents: tier.price_cents,
      auto_renew_enabled: !stripeSubscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    // If creating from grace/expired, reactivate
    if (isRenewal && (subscription.status === 'grace_period' || subscription.status === 'expired')) {
      updateData.status = 'active';
      updateData.grace_started_at = null;
      updateData.grace_ends_at = null;

      // Call SP wallet unfreeze
      try {
        await fetch(Deno.env.get('SP_SUBSCRIPTION_REACTIVATE_URL') || '', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.warn('[create-subscription-from-payment-method] SP unfreeze call failed:', err);
      }
    }

    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[create-subscription-from-payment-method] Failed to update subscription:', updateError);
      // Continue anyway - webhook will sync status
    }

    // Create billing history entry if charge succeeded immediately
    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    if (latestInvoice && latestInvoice.status === 'paid') {
      const { error: billingError } = await supabaseClient.from('billing_history').insert({
        user_id: userId,
        subscription_id: subscription.id,
        charge_id: latestInvoice.charge as string,
        stripe_invoice_id: latestInvoice.id,
        amount: latestInvoice.amount_paid,
        currency: latestInvoice.currency,
        status: 'succeeded',
        charged_at: new Date(latestInvoice.status_transitions.paid_at! * 1000).toISOString(),
        description: 'Kids Club+ Subscription - Initial Payment',
      });

      if (billingError) {
        console.error('[create-subscription-from-payment-method] Billing history insert failed:', billingError);
      }
    }

    const response: CreateSubscriptionResponse = {
      subscription_id: stripeSubscription.id,
      status: stripeSubscription.status,
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      trial_end: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000).toISOString()
        : null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[create-subscription-from-payment-method] Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create subscription',
        details: error.type || 'unknown',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
