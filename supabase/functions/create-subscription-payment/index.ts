// File: supabase/functions/create-subscription-payment/index.ts
// MODULE-11 TASK SUB-006: Create Stripe Subscription with Payment
// Creates a paid Stripe subscription for Kids Club+ (trial-to-paid conversion)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CreateSubscriptionRequest {
  paymentMethodId: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[create-subscription-payment] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create-subscription-payment] Processing for user: ${user.id}`);

    // 2. Parse request body
    const body: CreateSubscriptionRequest = await req.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing paymentMethodId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get subscription tier info (Kids Club+)
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('name', 'kids_club_plus')
      .eq('is_active', true)
      .single();

    if (tierError || !tier) {
      console.error('[create-subscription-payment] Tier fetch error:', tierError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kids Club+ tier not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get user's current subscription
    const { data: existingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError) {
      console.error('[create-subscription-payment] Subscription fetch error:', subError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let subscription = existingSubscription;

    if (!subscription) {
      const { data: createdSubscription, error: createSubError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          status: 'trial',
          trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (createSubError || !createdSubscription) {
        console.error('[create-subscription-payment] Failed to create missing subscription row:', createSubError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to initialize subscription record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      subscription = createdSubscription;
    }

    if (subscription.status === 'active' && subscription.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription already active' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For non-trial users (e.g. free), initialize a 30-day free period before first charge.
    const now = new Date();
    let trialEndDate = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
    const hasFutureTrial = trialEndDate && !Number.isNaN(trialEndDate.getTime()) && trialEndDate > now;
    const shouldInitializeTrial = subscription.status !== 'trial' || !hasFutureTrial;

    if (shouldInitializeTrial) {
      trialEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { error: trialInitError } = await supabase
        .from('subscriptions')
        .update({
          status: 'trial',
          trial_end_date: trialEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (trialInitError) {
        console.error('[create-subscription-payment] Failed to initialize 30-day trial:', trialInitError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to initialize free trial window' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      subscription = {
        ...subscription,
        status: 'trial',
        trial_end_date: trialEndDate.toISOString(),
      };
    }

    if (subscription.stripe_subscription_id) {
      try {
        const existingStripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        return new Response(
          JSON.stringify({
            success: true,
            subscription: {
              id: existingStripeSubscription.id,
              status: existingStripeSubscription.status,
              current_period_end: existingStripeSubscription.current_period_end,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (existingSubError) {
        console.warn('[create-subscription-payment] Existing Stripe subscription lookup failed, continuing with create flow:', existingSubError);
      }
    }

    // 5. Get or create Stripe Customer
    let customerId = subscription.stripe_customer_id;

    if (!customerId) {
      console.log('[create-subscription-payment] Creating Stripe customer...');
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update subscription with customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('id', subscription.id);
    }

    // 6. Attach payment method to customer
    console.log('[create-subscription-payment] Attaching payment method...');
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (attachError: any) {
      // If already attached to this customer, we can ignore
      if (attachError.message?.includes('already been attached to a customer')) {
        console.log('[create-subscription-payment] Payment method already attached, continuing...');
      } else {
        console.error('[create-subscription-payment] Payment method attach error:', attachError);
        throw attachError;
      }
    }

    // Set as default payment method
    console.log('[create-subscription-payment] Setting default payment method...');
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // 7. Create Stripe Subscription
    console.log('[create-subscription-payment] Creating Stripe subscription...');
    
    const isCurrentlyTrial = subscription.status === 'trial';
    const normalizedTrialEndDate = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
    
    // If trial is active and hasn't ended, set trial_end on Stripe sub
    const stripePriceId =
      typeof (tier as any).stripe_price_id === 'string' && (tier as any).stripe_price_id.trim() !== ''
        ? (tier as any).stripe_price_id.trim()
        : null;

    let stripeProductId =
      typeof (tier as any).stripe_product_id === 'string' && (tier as any).stripe_product_id.trim() !== ''
        ? (tier as any).stripe_product_id.trim()
        : null;

    if (!stripePriceId && !stripeProductId) {
      console.log('[create-subscription-payment] No stripe_product_id found on tier; creating fallback product...');
      const createdProduct = await stripe.products.create({
        name:
          (typeof (tier as any).display_name === 'string' && (tier as any).display_name.trim() !== '')
            ? (tier as any).display_name
            : tier.name,
        metadata: {
          tier_id: String(tier.id),
          source: 'create-subscription-payment-fallback',
        },
      });
      stripeProductId = createdProduct.id;
    }

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: stripePriceId
        ? [{ price: stripePriceId }]
        : [{ 
            price_data: {
              currency: 'usd',
              product: stripeProductId!,
              recurring: {
                interval: 'month',
              },
              unit_amount: tier.price_cents,
            },
          }],
      default_payment_method: paymentMethodId,
      metadata: {
        supabase_user_id: user.id,
        tier_id: tier.id,
      },
      expand: ['latest_invoice.payment_intent'],
    };

    // If user still in trial period, keep trial until it expires
    if (isCurrentlyTrial && normalizedTrialEndDate && normalizedTrialEndDate > new Date()) {
      subscriptionParams.trial_end = Math.floor(normalizedTrialEndDate.getTime() / 1000);
    }

    console.log('[create-subscription-payment] Subscription params:', JSON.stringify(subscriptionParams));
    const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

    console.log(`[create-subscription-payment] Stripe subscription created: ${stripeSubscription.id}`);

    // 8. Update user_subscriptions in database
    const updateData: any = {
      stripe_subscription_id: stripeSubscription.id,
      stripe_payment_method_id: paymentMethodId,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If not in trial or trial just ended, set to active
    if (!isCurrentlyTrial || (normalizedTrialEndDate && normalizedTrialEndDate <= new Date())) {
      updateData.status = 'active';
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[create-subscription-payment] Subscription update error:', updateError);
      // Don't fail the request - Stripe subscription is created
      // Webhook will sync this later
    }

    console.log('[create-subscription-payment] Success!');

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          current_period_end: stripeSubscription.current_period_end,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[create-subscription-payment] Fatal error:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = `Invalid request: ${error.message}`;
      statusCode = 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        code: error.code,
        type: error.type
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
