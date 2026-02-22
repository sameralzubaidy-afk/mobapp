// File: supabase/functions/stripe-webhook-subscriptions/index.ts
// MODULE-11 TASK SUB-007: Stripe Webhook Handling (Status & Billing Updates)
// Handles: customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
//
// SECURITY DEFINER: Uses service role key because webhook events arrive without user JWT.
// Audit: every DB mutation is logged with [stripe-webhook-subscriptions] prefix.
//
// BP-7: All errors return structured responses. BP-3: All SQL uses table aliases.
// HP-3: Uses service role only for webhook processing — no user data exposure.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

// ─── Stripe client ────────────────────────────────────────────────────────────
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET') || '';

// ─── Supabase service-role client (bypasses RLS — justified: webhook has no user JWT) ──
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Max payment retries before entering grace period ─────────────────────────
const MAX_PAYMENT_RETRIES = 3;

// ─── Grace-period duration (fetched from subscription_tiers, default 90 days) ──
const DEFAULT_GRACE_PERIOD_DAYS = 90;

// ============================================================================
// HELPER: Fetch grace period days from user's subscription tier
// ============================================================================
async function getGracePeriodDays(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  try {
    // Fetch user's subscription to get tier_id
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('tier_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError || !sub?.tier_id) {
      console.warn(
        '[stripe-webhook-subscriptions] getGracePeriodDays: could not fetch tier_id, using default',
        { subError, userId }
      );
      return DEFAULT_GRACE_PERIOD_DAYS;
    }

    // Fetch tier configuration
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('grace_period_days')
      .eq('id', sub.tier_id)
      .maybeSingle();

    if (tierError || !tier) {
      console.warn(
        '[stripe-webhook-subscriptions] getGracePeriodDays: could not fetch grace_period_days from tier, using default',
        { tierError, tierId: sub.tier_id }
      );
      return DEFAULT_GRACE_PERIOD_DAYS;
    }

    return Math.max(tier.grace_period_days || DEFAULT_GRACE_PERIOD_DAYS, 0); // Ensure non-negative
  } catch (err) {
    console.error('[stripe-webhook-subscriptions] getGracePeriodDays: unexpected error:', err);
    return DEFAULT_GRACE_PERIOD_DAYS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  // Stripe sends POST only; reject everything else
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig || !endpointSecret) {
    console.error('[stripe-webhook-subscriptions] Missing stripe-signature or STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET');
    return new Response(
      JSON.stringify({ error: { code: 'MISSING_SIGNATURE', message: 'Webhook secret not configured' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Verify signature ────────────────────────────────────────────────────────
  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('[stripe-webhook-subscriptions] Signature verification failed:', err.message);
    return new Response(
      JSON.stringify({ error: { code: 'INVALID_SIGNATURE', message: err.message } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log(`[stripe-webhook-subscriptions] Received event: ${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      // ── 1. Subscription updated (status changes, period renewals, cancel scheduling) ───
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription, event.id);
        break;
      }

      // ── 2. Subscription deleted (Stripe hard-deleted it → enter grace period) ──────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription, event.id);
        break;
      }

      // ── 3. Invoice payment failed (retry tracking + grace after 3 failures) ──────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice, event.id);
        break;
      }

      default:
        console.log(`[stripe-webhook-subscriptions] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[stripe-webhook-subscriptions] Error processing ${event.type}:`, error?.message, error?.stack);
    return new Response(
      JSON.stringify({ error: { code: 'PROCESSING_ERROR', message: error.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Handler: customer.subscription.updated
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  const toIsoFromStripeSeconds = (value: unknown): string | null => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    const asDate = new Date(numeric * 1000);
    if (Number.isNaN(asDate.getTime())) {
      return null;
    }

    return asDate.toISOString();
  };

  const stripeSubId = subscription.id;
  const currentPeriodEnd = toIsoFromStripeSeconds(subscription.current_period_end);
  const currentPeriodStart = toIsoFromStripeSeconds(subscription.current_period_start);

  // ── Determine new internal status ──────────────────────────────────────────
  // Priority order: explicit cancel flag > Stripe status
  let newStatus: 'active' | 'canceled' | 'grace_period' = 'active';

  if (subscription.cancel_at_period_end) {
    // User requested cancellation — still has access until period_end
    newStatus = 'canceled';
  } else if (subscription.status === 'active' || subscription.status === 'trialing') {
    newStatus = 'active';
  } else if (subscription.status === 'canceled') {
    // Stripe already terminated the subscription immediately
    newStatus = 'grace_period';
  }

  // ── Fetch the subscription record ─────────────────────────────────────────
  const { data: sub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, user_id, status')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle();

  if (fetchError || !sub) {
    console.error(
      `[stripe-webhook-subscriptions] handleSubscriptionUpdated: no record for stripe_subscription_id=${stripeSubId}`,
      fetchError,
    );
    return;
  }

  // ── Build update payload ───────────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (currentPeriodStart) {
    updatePayload.current_period_start = currentPeriodStart;
  }
  if (currentPeriodEnd) {
    updatePayload.current_period_end = currentPeriodEnd;
  }

  // If entering grace period immediately (e.g. immediate cancel), set grace dates
  if (newStatus === 'grace_period' && sub.status !== 'grace_period') {
    const gracePeriodDays = await getGracePeriodDays(supabase, sub.user_id);
    const graceEnd = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();
    updatePayload.grace_started_at = new Date().toISOString();
    updatePayload.grace_ends_at = graceEnd;
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update(updatePayload)
    .eq('id', sub.id);

  if (updateError) {
    console.error(`[stripe-webhook-subscriptions] handleSubscriptionUpdated: DB update failed`, updateError);
    throw new Error(`DB update failed: ${updateError.message}`);
  }

  console.log(
    `[stripe-webhook-subscriptions] handleSubscriptionUpdated: user=${sub.user_id} status=${newStatus} event=${eventId}`,
  );

  // If entering grace period, freeze SP wallet
  if (newStatus === 'grace_period' && sub.status !== 'grace_period') {
    await triggerSpFreeze(sub.user_id, 'subscription_updated_to_grace');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: customer.subscription.deleted
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  const stripeSubId = subscription.id;

  const { data: sub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, user_id, status')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle();

  if (fetchError || !sub) {
    console.error(
      `[stripe-webhook-subscriptions] handleSubscriptionDeleted: no record for stripe_subscription_id=${stripeSubId}`,
      fetchError,
    );
    return;
  }

  // ── Set grace period ───────────────────────────────────────────────────────
  const now = new Date();
  const gracePeriodDays = await getGracePeriodDays(supabase, sub.user_id);
  const graceEnd = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'grace_period',
      grace_started_at: now.toISOString(),
      grace_ends_at: graceEnd,
      updated_at: now.toISOString(),
    })
    .eq('id', sub.id);

  if (updateError) {
    console.error(`[stripe-webhook-subscriptions] handleSubscriptionDeleted: DB update failed`, updateError);
    throw new Error(`DB update failed: ${updateError.message}`);
  }

  console.log(
    `[stripe-webhook-subscriptions] handleSubscriptionDeleted: user=${sub.user_id} grace_until=${graceEnd} event=${eventId}`,
  );

  // Freeze SP wallet (MODULE-09 integration)
  await triggerSpFreeze(sub.user_id, 'subscription_deleted');
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: invoice.payment_failed
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  const stripeSubId = invoice.subscription as string | null;

  if (!stripeSubId) {
    console.warn('[stripe-webhook-subscriptions] handleInvoicePaymentFailed: invoice has no subscription field');
    return;
  }

  const { data: sub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, user_id, status, payment_retry_count')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle();

  if (fetchError || !sub) {
    console.error(
      `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: no record for stripe_subscription_id=${stripeSubId}`,
      fetchError,
    );
    return;
  }

  // ── Use existing record_payment_attempt RPC (from SUB-002) ────────────────
  // This RPC:
  //   - Increments payment_retry_count
  //   - Sets payment_failed_at
  //   - Auto-transitions to grace_period after MAX_PAYMENT_RETRIES
  const { data: rpcResult, error: rpcError } = await supabase.rpc('record_payment_attempt', {
    p_user_id: sub.user_id,
    p_success: false,
  });

  if (rpcError) {
    console.error(
      `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: record_payment_attempt RPC failed`,
      rpcError,
    );
    throw new Error(`RPC failed: ${rpcError.message}`);
  }

  const retryCount: number = rpcResult?.retry_count ?? (sub.payment_retry_count ?? 0) + 1;
  const maxRetriesReached: boolean = rpcResult?.max_retries_reached ?? retryCount >= MAX_PAYMENT_RETRIES;

  console.log(
    `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: user=${sub.user_id} retry_count=${retryCount} max=${maxRetriesReached} event=${eventId}`,
  );

  // ── Freeze SP if 3rd failure → grace period ────────────────────────────────
  if (maxRetriesReached && sub.status !== 'grace_period') {
    await triggerSpFreeze(sub.user_id, 'payment_failed_max_retries');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SP Wallet freeze trigger (MODULE-09 integration)
// Calls the SP lapse URL if configured; fails gracefully if not yet deployed.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerSpFreeze(userId: string, reason: string): Promise<void> {
  const spLapseUrl = Deno.env.get('SP_SUBSCRIPTION_LAPSE_URL');

  if (!spLapseUrl) {
    // TODO(MODULE-09): Configure SP_SUBSCRIPTION_LAPSE_URL once MODULE-09 SP freeze endpoint is deployed
    console.warn(
      `[stripe-webhook-subscriptions] SP_SUBSCRIPTION_LAPSE_URL not set — skipping SP freeze for user=${userId} reason=${reason}`,
    );
    return;
  }

  try {
    const resp = await fetch(spLapseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, reason }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(
        `[stripe-webhook-subscriptions] SP freeze call failed user=${userId} status=${resp.status} body=${text}`,
      );
    } else {
      console.log(`[stripe-webhook-subscriptions] SP freeze triggered for user=${userId} reason=${reason}`);
    }
  } catch (err: any) {
    // Non-blocking: SP freeze failure must not prevent subscription state update
    console.error(`[stripe-webhook-subscriptions] SP freeze request error user=${userId}:`, err.message);
  }
}
