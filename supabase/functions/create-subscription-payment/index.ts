// File: supabase/functions/create-subscription-payment/index.ts
// MODULE-11 TASK SUB-006: Create Stripe Subscription with Payment
// Creates a paid Stripe subscription for Kids Club+ (trial-to-paid conversion)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { validateStripePaymentMethodId } from '../_shared/stripe-payment-method-guard.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CreateSubscriptionRequest {
  paymentMethodId: string;
}

type ResolvedTier = {
  id: string;
  name: string;
  display_name: string;
  currency: string;
  stripe_price_id: string | null;
  stripe_product_id?: string | null;
};

async function getAdminConfigNumber(
  supabase: ReturnType<typeof createClient>,
  key: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', key)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(`Missing required admin_config key: ${key}`);
  }

  const parsed = Number(data.value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric admin_config value for key: ${key}`);
  }

  return parsed;
}

function normalizeAdminPriceToCents(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    throw new Error(
      `Invalid subscription price in admin_config: ${rawValue}. ` +
      'Set subscription_price_monthly to a positive number. ' +
      'Values >= 100 are cents (e.g., 1500 = $15), values < 100 are dollars (e.g., 15 = $15)'
    );
  }

  if (rawValue >= 100) {
    return Math.round(rawValue);
  }

  return Math.round(rawValue * 100);
}

async function resolveTierConfig(
  supabase: ReturnType<typeof createClient>,
): Promise<ResolvedTier> {
  const selection = '*';
  const attempts: Array<Promise<{ data: any; error: any }>> = [
    supabase.from('subscription_tiers').select(selection).eq('name', 'kids_club_plus').eq('is_active', true).maybeSingle(),
    supabase.from('subscription_tiers').select(selection).eq('name', 'kids_club_plus').maybeSingle(),
    supabase.from('subscription_tiers').select(selection).eq('is_default', true).eq('is_active', true).maybeSingle(),
    supabase.from('subscription_tiers').select(selection).eq('is_active', true).order('is_default', { ascending: false }).order('sort_order', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('subscription_tiers').select(selection).order('is_default', { ascending: false }).order('sort_order', { ascending: true }).limit(1).maybeSingle(),
  ];

  for (const attempt of attempts) {
    const { data } = await attempt;
    if (data) {
      return {
        id: String(data.id),
        name: typeof data.name === 'string' && data.name.trim() !== '' ? data.name : 'kids_club_plus',
        display_name: typeof data.display_name === 'string' && data.display_name.trim() !== '' ? data.display_name : 'Kids Club+',
        currency: typeof data.currency === 'string' && data.currency.trim() !== '' ? data.currency : 'usd',
        stripe_price_id: typeof data.stripe_price_id === 'string' ? data.stripe_price_id : null,
        stripe_product_id: typeof data.stripe_product_id === 'string' ? data.stripe_product_id : null,
      };
    }
  }

  return {
    id: 'admin-config-fallback',
    name: 'kids_club_plus',
    display_name: 'Kids Club+',
    currency: 'usd',
    stripe_price_id: null,
    stripe_product_id: null,
  };
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
    const paymentMethodValidation = validateStripePaymentMethodId(body.paymentMethodId);

    if (!paymentMethodValidation.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: paymentMethodValidation.message,
          code: paymentMethodValidation.code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentMethodId = paymentMethodValidation.paymentMethodId;

    // 3. Get subscription tier info (Kids Club+) and admin-config subscription values
    const tier = await resolveTierConfig(supabase);

    const [adminMonthlyPrice, adminTrialDays] = await Promise.all([
      getAdminConfigNumber(supabase, 'subscription_price_monthly'),
      getAdminConfigNumber(supabase, 'trial_period_days'),
    ]);

    const adminMonthlyPriceCents = normalizeAdminPriceToCents(adminMonthlyPrice);
    const normalizedTrialDays = Math.max(Math.round(adminTrialDays), 0);

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
          trial_end_date: new Date(Date.now() + normalizedTrialDays * 24 * 60 * 60 * 1000).toISOString(),
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

    // For non-trial users (e.g. free), initialize admin-configured free-trial period before first charge.
    const now = new Date();
    let trialEndDate = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
    const hasFutureTrial = trialEndDate && !Number.isNaN(trialEndDate.getTime()) && trialEndDate > now;
    const shouldInitializeTrial = subscription.status !== 'trial' || !hasFutureTrial;

    if (shouldInitializeTrial) {
      trialEndDate = new Date(now.getTime() + normalizedTrialDays * 24 * 60 * 60 * 1000);
      const { error: trialInitError } = await supabase
        .from('subscriptions')
        .update({
          status: 'trial',
          trial_end_date: trialEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (trialInitError) {
        console.error('[create-subscription-payment] Failed to initialize admin-configured trial window:', trialInitError);
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
    let stripeProductId =
      typeof (tier as any).stripe_product_id === 'string' && (tier as any).stripe_product_id.trim() !== ''
        ? (tier as any).stripe_product_id.trim()
        : null;

    if (!stripeProductId) {
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
      items: [{
        price_data: {
          currency: 'usd',
          product: stripeProductId!,
          recurring: {
            interval: 'month',
          },
          unit_amount: adminMonthlyPriceCents,
        },
      }],
      default_payment_method: paymentMethodId,
      metadata: {
        supabase_user_id: user.id,
        tier_id: tier.id,
        admin_price_monthly: adminMonthlyPrice.toFixed(2),
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
