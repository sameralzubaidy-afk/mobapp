// File: supabase/functions/create-subscription-from-payment-method/index.ts
// MODULE-11 SUB-015: Create Stripe subscription after payment method collected

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

// NOTE (BP-41, 2026-08-09): validateStripePaymentMethodId + helpers INLINED from
// ../_shared/stripe-payment-method-guard.ts (kept in sync) because the MCP
// deploy bundler cannot resolve ../_shared/* relative imports.
type PaymentMethodValidationSuccess = {
  ok: true;
  paymentMethodId: string;
};

type PaymentMethodValidationFailure = {
  ok: false;
  code: 'MISSING_PAYMENT_METHOD' | 'CARD_DATA_FORBIDDEN' | 'INVALID_PAYMENT_METHOD_ID';
  message: string;
};

type PaymentMethodValidationResult =
  | PaymentMethodValidationSuccess
  | PaymentMethodValidationFailure;

function looksLikeRawCardData(value: string): boolean {
  if (!/^[0-9\s-]+$/.test(value)) {
    return false;
  }

  const digitCount = value.replace(/\D/g, '').length;
  return digitCount >= 12 && digitCount <= 19;
}

function validateStripePaymentMethodId(rawValue: unknown): PaymentMethodValidationResult {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return {
      ok: false,
      code: 'MISSING_PAYMENT_METHOD',
      message: 'Missing payment method ID. Expected Stripe PaymentMethod ID (pm_...).',
    };
  }

  const paymentMethodId = rawValue.trim();

  if (looksLikeRawCardData(paymentMethodId)) {
    return {
      ok: false,
      code: 'CARD_DATA_FORBIDDEN',
      message:
        'Raw card data is not accepted. Use Stripe SDK or Payment Sheet and send only PaymentMethod ID (pm_...).',
    };
  }

  if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_METHOD_ID',
      message: 'Invalid payment method format. Expected Stripe PaymentMethod ID (pm_...).',
    };
  }

  return {
    ok: true,
    paymentMethodId,
  };
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

interface CreateSubscriptionRequest {
  user_id: string;
  payment_method_id: string;
  is_renewal?: boolean;
}

interface CreateSubscriptionResponse {
  success: boolean;
  subscription_id: string;
  status: string;
  current_period_end: string;
  trial_end?: string | null;
}

type SubscriptionCustomerRow = {
  stripe_customer_id: string | null;
};

type ProfileCustomerRow = {
  stripe_customer_id?: string | null;
};

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function mapStripeStatusToSubscriptionStatus(
  stripeStatus: string,
): 'trial' | 'active' | 'paused' | 'cancelled' | null {
  switch (stripeStatus) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'paused':
      return 'paused';
    case 'canceled':
      return 'cancelled';
    default:
      return null;
  }
}

/**
 * Normalize admin_config price to cents.
 * Convention: values >= 100 are treated as cents, values < 100 as dollars.
 * Example: 1500 → 1500 cents ($15.00), 15.00 → 1500 cents ($15.00)
 * For $1500/month, set admin_config to 150000 (cents).
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

  // Treat as cents if >= 100, otherwise as dollars
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
      source: 'create-subscription-from-payment-method',
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
  // If admin_config is missing, this will return 0 and normalizeAdminPriceToCents will throw
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
    const paymentMethodValidation = validateStripePaymentMethodId(body.payment_method_id);
    const isRenewal = body.is_renewal || false;

    if (!paymentMethodValidation.ok) {
      return new Response(JSON.stringify({
        error: paymentMethodValidation.message,
        code: paymentMethodValidation.code,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentMethodId = paymentMethodValidation.paymentMethodId;

    // Verify user matches token
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user subscription record (canonical source for stripe_customer_id)
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

    // DT-11 (2026-08-27): already-subscribed guard. A timeout-retry AFTER a successful
    // activation must NOT create a second subscription — the per-activation idempotency
    // key below cannot dedupe a post-success retry (the row now points at the new sub, so
    // the key differs). If the row shows an active/trialing Stripe subscription, return it.
    if (['trial', 'active'].includes((subscription as any).status) && subscription.stripe_subscription_id) {
      try {
        const existingStripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        if (['active', 'trialing'].includes(existingStripeSub.status)) {
          console.log('[create-subscription-from-payment-method] Already subscribed, returning existing:', existingStripeSub.id);
          return new Response(JSON.stringify({
            success: true,
            subscription_id: existingStripeSub.id,
            status: existingStripeSub.status,
            current_period_end: new Date(existingStripeSub.current_period_end * 1000).toISOString(),
            trial_end: existingStripeSub.trial_end
              ? new Date(existingStripeSub.trial_end * 1000).toISOString()
              : null,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } catch (err: any) {
        console.warn('[create-subscription-from-payment-method] Existing-sub check failed, proceeding:', err?.message);
      }
    }

    let customerId = (subscription as SubscriptionCustomerRow).stripe_customer_id;

    // Backward compatibility fallback in case some legacy rows still store customer ID in profiles.
    if (!customerId) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle<ProfileCustomerRow>();

      customerId = profile?.stripe_customer_id || null;
    }

    if (!customerId) {
      console.error('[create-subscription-from-payment-method] Customer missing for user:', userId);
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Kids Club+ tier and required admin monthly price
    const tier = await resolveTierConfig(supabaseClient);
    const adminMonthlyPriceRaw = await getAdminConfigNumber(
      supabaseClient,
      'subscription_price_monthly',
      0,
    );
    const adminMonthlyPriceCents = normalizeAdminPriceToCents(adminMonthlyPriceRaw);

    if (!Number.isFinite(adminMonthlyPriceCents) || adminMonthlyPriceCents <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Kids Club+ billing price is missing in admin configuration.',
          code: 'ADMIN_PRICE_MISSING',
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

    // Always charge admin-configured amount, never tier stripe_price_id.
    const enforcedPriceId = await createAdminBackedMonthlyPriceId({
      tier,
      adminPriceCents: adminMonthlyPriceCents,
    });

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

    // For renewal paths, retire existing Stripe subscription and create a fresh one
    // so the current admin-configured price is always charged.
    if (isRenewal && subscription.stripe_subscription_id) {
      try {
        const existingStripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        if (existingStripeSubscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id, {
            prorate: false,
          });
          console.log('[create-subscription-from-payment-method] Canceled previous Stripe subscription before renewal:', subscription.stripe_subscription_id);
        }
      } catch (cancelErr) {
        console.warn('[create-subscription-from-payment-method] Failed to cancel previous subscription, proceeding with fresh create:', cancelErr);
      }
    }

    {
      // Create new subscription and enforce admin-configured monthly price.
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: enforcedPriceId }],
        default_payment_method: paymentMethodId,
        payment_behavior: isRenewal ? 'error_if_incomplete' : 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          user_id: userId,
          tier_id: tier.id,
          admin_price_cents: String(adminMonthlyPriceCents),
        },
      };

      // Stripe rejects a request that sets both trial_end and trial_period_days, so these
      // two branches must be mutually exclusive (see BUG: "Received both trial_end and
      // trial_period_days parameters" when a non-renewal subscribe hit a user already in trial).
      const existingTrialEndsAt = subscription.trial_ends_at || subscription.trial_end_date;
      if (subscription.status === 'trial' && existingTrialEndsAt) {
        // Preserve existing trial window for users already in trial.
        const trialEndTimestamp = Math.floor(
          new Date(existingTrialEndsAt).getTime() / 1000,
        );
        subscriptionParams.trial_end = trialEndTimestamp;
      } else if (!isRenewal) {
        // Trial initialization for first-time upgrades (free -> trialing) using admin-config days.
        const trialDaysRaw = await getAdminConfigNumber(supabaseClient, 'trial_period_days', 30);
        const trialDays = Math.max(Math.round(trialDaysRaw), 0);

        if (trialDays > 0) {
          subscriptionParams.trial_period_days = trialDays;
        }
      }

      // DEV-TASK-6 (2026-08-27) + DT-11 (2026-08-27): per-activation idempotency key.
      // Key includes the row's current stripe_subscription_id (or 'initial' for a first
      // activation) so each DISTINCT activation/renewal gets a unique key — a later
      // legitimate renewal must NOT be deduped against a prior activation (the constant
      // `sub_<row_id>` key broke renewals: every activation mints a fresh price, so Stripe
      // rejects a re-used key whose params differ). Key is the options arg (BP-65).
      stripeSubscription = await stripe.subscriptions.create(subscriptionParams, {
        idempotencyKey: `sub_${subscription.id}_${subscription.stripe_subscription_id || 'initial'}`,
      });

      console.log('[create-subscription-from-payment-method] Created new subscription:', {
        subscription_id: stripeSubscription.id,
        status: stripeSubscription.status,
      });
    }

    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;
    const isActivatableStatus = ['active', 'trialing'].includes(stripeSubscription.status);
    const hasSuccessfulPayment =
      stripeSubscription.status === 'trialing' ||
      latestInvoice?.status === 'paid' ||
      paymentIntent?.status === 'succeeded';
    const normalizedStatus = mapStripeStatusToSubscriptionStatus(stripeSubscription.status);

    if (!normalizedStatus) {
      console.error('[create-subscription-from-payment-method] Subscription not activatable', {
        subscriptionStatus: stripeSubscription.status,
        invoiceStatus: latestInvoice?.status,
        paymentIntentStatus: paymentIntent?.status,
      });

      return new Response(
        JSON.stringify({
          error: 'Subscription setup is not complete yet. Please retry in a moment.',
          code: 'SUBSCRIPTION_NOT_ACTIVATED',
          stripe_status: stripeSubscription.status,
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    if (isRenewal && (!isActivatableStatus || !hasSuccessfulPayment)) {
      console.error('[create-subscription-from-payment-method] Renewal payment incomplete', {
        subscriptionStatus: stripeSubscription.status,
        invoiceStatus: latestInvoice?.status,
        paymentIntentStatus: paymentIntent?.status,
      });

      return new Response(
        JSON.stringify({
          error: 'Payment could not be completed. Please update your payment method and try again.',
          code: 'PAYMENT_REQUIRED',
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Update user_subscriptions with Stripe IDs
    const updateData: any = {
      stripe_subscription_id: stripeSubscription.id,
      stripe_payment_method_id: paymentMethodId,
      status: normalizedStatus,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      next_billing_date: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      monthly_price_cents: adminMonthlyPriceCents,
      last_payment_amount: adminMonthlyPriceCents,
      auto_renew_enabled: !stripeSubscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    if (stripeSubscription.status === 'trialing') {
      updateData.has_used_trial = true;

      if (stripeSubscription.trial_start) {
        updateData.trial_start_date = new Date(
          stripeSubscription.trial_start * 1000,
        ).toISOString();
      }

      if (stripeSubscription.trial_end) {
        updateData.trial_end_date = new Date(stripeSubscription.trial_end * 1000).toISOString();
      }
    }

    if (isUuid(tier.id)) {
      updateData.tier_id = tier.id;
    }

    // If creating from grace/expired, reactivate
    if (
      isRenewal &&
      (subscription.status === 'grace_period' || subscription.status === 'grace' || subscription.status === 'expired')
    ) {
      updateData.grace_started_at = null;
      updateData.grace_ends_at = null;

      // R6 (2026-08-09): unfreeze SP wallet via in-repo RPC so a resubscribed
      // user's frozen balance becomes spendable again (replaces the external
      // SP_SUBSCRIPTION_REACTIVATE_URL dependency).
      try {
        const { error: unfreezeError } = await supabaseClient.rpc('rpc_set_sp_wallet_state', {
          p_user_id: userId,
          p_state: 'active',
        });
        if (unfreezeError) {
          console.warn('[create-subscription-from-payment-method] SP unfreeze RPC failed:', unfreezeError.message);
        }
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

    // Create billing history entry when payment succeeded (renewal or immediate paid activation).
    const chargeId =
      (typeof latestInvoice?.charge === 'string' ? latestInvoice.charge : null) ||
      (typeof paymentIntent?.latest_charge === 'string' ? paymentIntent.latest_charge : null) ||
      paymentIntent?.id ||
      latestInvoice?.id ||
      null;

    const paidAtUnix = latestInvoice?.status_transitions?.paid_at || paymentIntent?.created || null;
    const chargedAtIso = paidAtUnix
      ? new Date(paidAtUnix * 1000).toISOString()
      : new Date().toISOString();

    const paidAmount =
      latestInvoice?.amount_paid ??
      paymentIntent?.amount_received ??
      paymentIntent?.amount ??
      adminMonthlyPriceCents;

    if (hasSuccessfulPayment && chargeId) {
      const { error: billingError } = await supabaseClient.from('billing_history').upsert(
        {
          user_id: userId,
          subscription_id: subscription.id,
          charge_id: chargeId,
          stripe_invoice_id: latestInvoice?.id || null,
          amount: paidAmount,
          currency: latestInvoice?.currency || 'usd',
          status: 'succeeded',
          charged_at: chargedAtIso,
          description: isRenewal
            ? 'Kids Club+ Subscription - Renewal Payment'
            : 'Kids Club+ Subscription - Initial Payment',
        },
        {
          onConflict: 'charge_id',
          ignoreDuplicates: true,
        }
      );

      if (billingError) {
        console.error('[create-subscription-from-payment-method] Billing history insert failed:', billingError);
      }
    }

    const response: CreateSubscriptionResponse = {
      success: true,
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
