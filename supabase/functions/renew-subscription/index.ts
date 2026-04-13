/**
 * FILE: supabase/functions/renew-subscription/index.ts
 * MODULE-11 TASK SUB-016: Renew Subscription from Grace Period
 * 
 * Edge Function to handle re-subscription for users in grace_period or expired status.
 * Uses saved payment method from Stripe or prompts for new payment method.
 * 
 * Request body:
 * - user_id: string (optional, extracted from JWT if not provided)
 * - payment_method_id: string (optional, uses saved if omitted)
 * 
 * Response:
 * - success: boolean
 * - subscription_status: SubscriptionStatus
 * - message: string
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { validateStripePaymentMethodId } from '../_shared/stripe-payment-method-guard.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

type ResolvedTier = {
  id: string;
  name: string;
  display_name: string;
  currency: string;
  stripe_price_id: string | null;
  stripe_product_id?: string | null;
  price_cents: number;
  trial_days: number;
};

function isValidStripeProductId(productId: string): boolean {
  return /^prod_[A-Za-z0-9]+$/.test(productId);
}

function mapStripeError(error: any): { status: number; code: string; message: string } {
  const stripeCode = String(error?.code || '').toLowerCase();
  const stripeType = String(error?.type || '').toLowerCase();
  const declineCode = String(error?.decline_code || '').toLowerCase();
  const rawMessage = String(error?.message || '');
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    stripeType === 'card_error' ||
    stripeCode === 'card_declined' ||
    declineCode === 'insufficient_funds' ||
    normalizedMessage.includes('card was declined') ||
    normalizedMessage.includes('payment could not be completed')
  ) {
    return {
      status: 402,
      code: 'CARD_DECLINED',
      message: 'Your card was declined. Please update your payment method and try again.',
    };
  }

  if (stripeCode === 'resource_missing' && normalizedMessage.includes('price')) {
    return {
      status: 500,
      code: 'TIER_PRICE_INVALID',
      message: 'Kids Club+ billing is temporarily unavailable. Please try again later.',
    };
  }

  if (
    normalizedMessage.includes('items[0][price]') ||
    normalizedMessage.includes('you passed an empty string for')
  ) {
    return {
      status: 500,
      code: 'TIER_PRICE_MISSING',
      message: 'Kids Club+ billing is not configured correctly. Please contact support.',
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: rawMessage || 'Internal server error',
  };
}

async function getAdminConfigNumber(
  supabaseClient: ReturnType<typeof createClient>,
  key: string,
  fallbackValue: number,
): Promise<number> {
  const { data, error } = await supabaseClient
    .from('admin_config')
    .select('value')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return fallbackValue;
  }

  const parsed = Number(data.value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

/**
 * Normalize admin_config price to cents.
 * Convention: values >= 100 are treated as cents, values < 100 as dollars.
 * @throws Error if value is invalid - NO SILENT FALLBACK TO $4.99
 */
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

async function createAdminBackedMonthlyPriceId(params: {
  tier: ResolvedTier;
  adminPriceCents: number;
}): Promise<string> {
  const tierProductId = typeof params.tier.stripe_product_id === 'string'
    ? params.tier.stripe_product_id.trim()
    : '';
  let productId = isValidStripeProductId(tierProductId) ? tierProductId : '';

  if (!productId) {
    const product = await stripe.products.create({
      name: params.tier.display_name || 'Kids Club+',
      metadata: {
        source: 'admin-price-enforced',
        tier_id: String(params.tier.id || ''),
      },
    });
    productId = product.id;
  }

  const createdPrice = await stripe.prices.create({
    currency: String(params.tier.currency || 'usd').toLowerCase(),
    product: productId,
    recurring: { interval: 'month' },
    unit_amount: params.adminPriceCents,
    metadata: {
      source: 'renew-subscription',
      tier_id: String(params.tier.id || ''),
      admin_price_cents: String(params.adminPriceCents),
    },
  });

  return createdPrice.id;
}

async function resolveTierConfig(
  supabaseClient: ReturnType<typeof createClient>,
): Promise<ResolvedTier> {
  const selection = '*';

  const attempts: Array<Promise<{ data: any; error: any }>> = [
    supabaseClient.from('subscription_tiers').select(selection).eq('name', 'kids_club_plus').eq('is_active', true).maybeSingle(),
    supabaseClient.from('subscription_tiers').select(selection).eq('name', 'kids_club_plus').maybeSingle(),
    supabaseClient.from('subscription_tiers').select(selection).eq('is_default', true).eq('is_active', true).maybeSingle(),
    supabaseClient.from('subscription_tiers').select(selection).eq('is_active', true).order('is_default', { ascending: false }).order('sort_order', { ascending: true }).limit(1).maybeSingle(),
    supabaseClient.from('subscription_tiers').select(selection).order('is_default', { ascending: false }).order('sort_order', { ascending: true }).limit(1).maybeSingle(),
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
        price_cents: Number.isFinite(Number(data.price_cents)) && Number(data.price_cents) > 0 ? Number(data.price_cents) : 0,
        trial_days: Number.isFinite(Number(data.trial_days)) && Number(data.trial_days) >= 0 ? Number(data.trial_days) : 30,
      };
    }
  }

  // Fetch from admin_config - NO HARDCODED FALLBACK
  const [adminMonthlyPriceRaw, adminTrialDaysRaw] = await Promise.all([
    getAdminConfigNumber(supabaseClient, 'subscription_price_monthly', 0),
    getAdminConfigNumber(supabaseClient, 'trial_period_days', 30),
  ]);

  return {
    id: 'admin-config-fallback',
    name: 'kids_club_plus',
    display_name: 'Kids Club+',
    currency: 'usd',
    stripe_price_id: null,
    stripe_product_id: null,
    price_cents: normalizeAdminPriceToCents(adminMonthlyPriceRaw),
    trial_days: Math.max(Math.round(adminTrialDaysRaw), 0),
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

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

  try {
    // Parse request body
    const { payment_method_id } = await req.json();

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
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
      return jsonResponse({ error: 'Invalid user token' }, 401);
    }

    const user_id = user.id;

    console.log('[renew-subscription] Processing renewal for user:', user_id);

    // 1. Fetch user subscription
    const { data: sub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (subError || !sub) {
      return jsonResponse({ error: 'Subscription not found', code: 'SUBSCRIPTION_NOT_FOUND' }, 404);
    }

    // 2. Validate user is eligible for renewal (grace_period or expired only)
    if (!['grace_period', 'expired'].includes(sub.status)) {
      return jsonResponse(
        {
          error: 'User is not in grace period or expired status',
          code: 'INVALID_STATUS',
          current_status: sub.status,
        },
        400,
      );
    }

    // 3. Determine payment method to use
    const paymentMethodValidation = validateStripePaymentMethodId(
      payment_method_id || sub.stripe_payment_method_id,
    );

    if (!paymentMethodValidation.ok) {
      return jsonResponse(
        {
          error: paymentMethodValidation.message,
          code: paymentMethodValidation.code,
        },
        400,
      );
    }

    const paymentMethodId = paymentMethodValidation.paymentMethodId;

    // 4. Fetch subscription tier and required admin-configured price
    const tier = await resolveTierConfig(supabaseClient);
    const adminMonthlyPriceRaw = await getAdminConfigNumber(
      supabaseClient,
      'subscription_price_monthly',
      0,
    );
    const adminMonthlyPriceCents = normalizeAdminPriceToCents(adminMonthlyPriceRaw);

    if (!Number.isFinite(adminMonthlyPriceCents) || adminMonthlyPriceCents <= 0) {
      return jsonResponse(
        {
          error: 'Kids Club+ billing price is missing in admin configuration.',
          code: 'ADMIN_PRICE_MISSING',
        },
        500,
      );
    }

    // Always charge admin-configured amount, never old tier/existing Stripe price.
    const enforcedPriceId = await createAdminBackedMonthlyPriceId({
      tier,
      adminPriceCents: adminMonthlyPriceCents,
    });

    console.log('[renew-subscription] Tier:', tier.display_name, 'Admin price cents:', adminMonthlyPriceCents);

    // 5. Get or create Stripe customer
    let customerId = sub.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id },
      });
      customerId = customer.id;

      await supabaseClient
        .from('user_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user_id);

      console.log('[renew-subscription] Created Stripe customer:', customerId);
    }

    // 6. Attach payment method to customer if new
    if (payment_method_id && paymentMethodId !== sub.stripe_payment_method_id) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      console.log('[renew-subscription] Attached new payment method:', paymentMethodId);
    }

    // 7. Always create a fresh Stripe subscription for renewals.
    // This guarantees charging the current admin-configured price and avoids stale legacy pricing.
    let stripeSubscription: Stripe.Subscription | null = null;

    if (sub.stripe_subscription_id) {
      try {
        const existingStripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        if (existingStripeSubscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id, { prorate: false });
          console.log('[renew-subscription] Canceled previous Stripe subscription before renewal:', sub.stripe_subscription_id);
        }
      } catch (err) {
        console.warn('[renew-subscription] Failed to cancel previous subscription, proceeding with fresh create:', err);
      }
    }

    if (!stripeSubscription) {
      const createParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: enforcedPriceId }],
        default_payment_method: paymentMethodId,
        payment_behavior: 'error_if_incomplete',
        expand: ['latest_invoice.payment_intent'],
      };

      // Create new subscription (immediate charge, no trial)
      stripeSubscription = await stripe.subscriptions.create(createParams);

      console.log('[renew-subscription] Created new subscription:', stripeSubscription.id);
    }

    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;
    const isActivatableStatus = ['active', 'trialing'].includes(stripeSubscription.status);
    const hasSuccessfulPayment =
      stripeSubscription.status === 'trialing' ||
      latestInvoice?.status === 'paid' ||
      paymentIntent?.status === 'succeeded';

    if (!isActivatableStatus || !hasSuccessfulPayment) {
      console.error('[renew-subscription] Renewal did not complete successfully', {
        subscriptionStatus: stripeSubscription.status,
        invoiceStatus: latestInvoice?.status,
        paymentIntentStatus: paymentIntent?.status,
      });

      return jsonResponse(
        {
          error: 'Payment could not be completed. Please update your payment method and try again.',
          code: 'PAYMENT_REQUIRED',
          stripe_status: stripeSubscription.status,
        },
        402,
      );
    }

    // 8. Update user_subscriptions table
    const now = new Date().toISOString();
    const periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();

    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        status: 'active',
        stripe_subscription_id: stripeSubscription.id,
        stripe_payment_method_id: paymentMethodId,
        current_period_start: now,
        current_period_end: periodEnd,
        next_billing_date: periodEnd,
        grace_ends_at: null,
        grace_started_at: null,
        cancelled_at: null,
        cancel_reason: null,
        payment_retry_count: 0,
        payment_failed_at: null,
        auto_renew_enabled: true,
        updated_at: now,
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('[renew-subscription] Failed to update subscription:', updateError);
      return jsonResponse(
        {
          error: 'Failed to update subscription status',
          code: 'DB_UPDATE_FAILED',
          details: updateError.message,
        },
        500,
      );
    }

    console.log('[renew-subscription] Updated subscription status to active');

    // 9. Call MODULE-09 SP wallet unfreeze handler
    try {
      const unfreezeUrl = Deno.env.get('SP_SUBSCRIPTION_UNFREEZE_URL');
      if (unfreezeUrl) {
        const unfreezeResponse = await fetch(unfreezeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ user_id }),
        });

        if (!unfreezeResponse.ok) {
          console.error('[renew-subscription] SP unfreeze failed:', await unfreezeResponse.text());
        } else {
          console.log('[renew-subscription] SP wallet unfrozen successfully');
        }
      } else {
        console.warn('[renew-subscription] SP_SUBSCRIPTION_UNFREEZE_URL not configured');
      }
    } catch (err) {
      console.error('[renew-subscription] Error calling SP unfreeze handler:', err);
    }

    // 10. Create billing history record
    try {
      const charge = paymentIntent?.charges?.data?.[0];
      if (charge) {
        await supabaseClient.from('billing_history').insert({
          user_id,
          subscription_id: sub.id,
          charge_id: charge.id,
          stripe_invoice_id: latestInvoice?.id,
          amount: charge.amount,
          currency: charge.currency,
          status: charge.status === 'succeeded' ? 'succeeded' : 'pending',
          charged_at: new Date(charge.created * 1000).toISOString(),
          description: `Kids Club+ subscription renewal`,
        });

        console.log('[renew-subscription] Created billing history record');
      }
    } catch (err) {
      console.error('[renew-subscription] Failed to create billing history:', err);
    }

    // Success response
    return jsonResponse({
        success: true,
        subscription_status: 'active',
        message: 'Subscription renewed successfully. Your Swap Points are now available.',
        stripe_subscription_id: stripeSubscription.id,
        next_billing_date: periodEnd,
      });
  } catch (error: any) {
    const mapped = mapStripeError(error);
    console.error('[renew-subscription] Error:', {
      code: error?.code,
      type: error?.type,
      decline_code: error?.decline_code,
      message: error?.message,
      mapped,
    });

    return jsonResponse(
      {
        error: mapped.message,
        code: mapped.code,
      },
      mapped.status,
    );
  }
});
