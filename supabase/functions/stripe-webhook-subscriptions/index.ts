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

// ─── Grace-period duration (fetched from admin_config, then tier fallback) ──
const DEFAULT_GRACE_PERIOD_DAYS = 90;

// ============================================================================
// HELPER: Fetch grace period days from admin_config (primary), then subscription tier
// ============================================================================
async function getGracePeriodDays(
  supabase: any,
  userId: string,
): Promise<number> {
  try {
    // 1) Preferred source: admin_config.grace_period_days (dynamic admin-controlled setting)
    const { data: configData, error: configError } = await supabase
      .from('admin_config')
      .select('key, value')
      .eq('is_active', true)
      .eq('key', 'grace_period_days')
      .maybeSingle();

    if (!configError && configData?.value != null) {
      const parsed = Number(configData.value);
      if (Number.isFinite(parsed)) {
        return Math.max(parsed, 0);
      }
    }

    // 2) Legacy schema fallback: config_key/config_value
    const { data: legacyConfigData, error: legacyConfigError } = await supabase
      .from('admin_config')
      .select('config_key, config_value')
      .eq('is_active', true)
      .eq('config_key', 'grace_period_days')
      .maybeSingle();

    if (!legacyConfigError && legacyConfigData?.config_value != null) {
      const parsed = Number(legacyConfigData.config_value);
      if (Number.isFinite(parsed)) {
        return Math.max(parsed, 0);
      }
    }

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

    // 3) Tier fallback
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

      // ── R7: Web-first subscription purchase ──────────────────────────────────────────
      // checkout.session.completed — link the web Stripe Checkout to the app account
      // (resolve by client_reference_id → metadata → email) and flag it subscribed.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(supabase, session, event.id);
        break;
      }

      // customer.subscription.created — idempotent confirmation of the web subscription
      // (also covers Checkout-before-webhook ordering).
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(supabase, subscription, event.id);
        break;
      }

      // invoice.payment_succeeded — renewal success: reset retry count, record billing,
      // and restore status if a previous failure had pushed the account to grace.
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(supabase, invoice, event.id);
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
  supabase: any,
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
  const stripeCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id || null;
  const currentPeriodEnd = toIsoFromStripeSeconds(subscription.current_period_end);
  const currentPeriodStart = toIsoFromStripeSeconds(subscription.current_period_start);

  // ── Determine new internal status ──────────────────────────────────────────
  // Priority order: explicit cancel flag > Stripe status
  // R7 fix: Stripe 'trialing' maps to internal 'trial' (web trial), NOT 'active'.
  let newStatus: 'active' | 'canceled' | 'grace_period' | 'trial' = 'active';

  if (subscription.cancel_at_period_end) {
    // User requested cancellation — still has access until period_end
    newStatus = 'canceled';
  } else if (subscription.status === 'trialing') {
    // Web trial period (Stripe trial_period_days) — internal status 'trial'
    newStatus = 'trial';
  } else if (subscription.status === 'active') {
    newStatus = 'active';
  } else if (subscription.status === 'canceled') {
    // Stripe already terminated the subscription immediately
    newStatus = 'grace_period';
  }

  // ── Fetch the subscription record ─────────────────────────────────────────
  let { data: sub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, user_id, status, current_period_end')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle();

  if ((!sub || fetchError) && stripeCustomerId) {
    const fallback = await supabase
      .from('subscriptions')
      .select('id, user_id, status, current_period_end')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (!fallback.error && fallback.data) {
      sub = fallback.data;
      fetchError = null;

      // Keep canonical Stripe subscription id in sync for future webhooks.
      const { error: syncError } = await supabase
        .from('subscriptions')
        .update({ stripe_subscription_id: stripeSubId, updated_at: new Date().toISOString() })
        .eq('id', sub.id);

      if (syncError) {
        console.warn(
          `[stripe-webhook-subscriptions] handleSubscriptionUpdated: matched by customer but failed to sync stripe_subscription_id`,
          syncError,
        );
      } else {
        console.log(
          `[stripe-webhook-subscriptions] handleSubscriptionUpdated: matched by stripe_customer_id and synced stripe_subscription_id user=${sub.user_id}`,
        );
      }
    }
  }

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
  if (newStatus === 'trial' && subscription.trial_end) {
    updatePayload.trial_end_date = toIsoFromStripeSeconds(subscription.trial_end);
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

  const previousPeriodEndMs = sub.current_period_end ? Date.parse(sub.current_period_end) : NaN;
  const nextPeriodEndMs = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN;
  const periodAdvanced = Number.isFinite(nextPeriodEndMs)
    && (!Number.isFinite(previousPeriodEndMs) || nextPeriodEndMs > previousPeriodEndMs);

  // ── MODULE-14 NOTIF-V2-002: Send notifications for subscription events ────

  // 1. Subscription renewed when active period moves forward (works for Stripe CLI + live renewal events)
  if (
    newStatus === 'active' &&
    sub.status === 'active' &&
    !subscription.cancel_at_period_end &&
    periodAdvanced
  ) {
    await sendSubscriptionRenewalNotification(sub.user_id, currentPeriodEnd || '');
  }

  // 2. Subscription cancelled (cancel_at_period_end set to true)
  if (subscription.cancel_at_period_end && sub.status !== 'canceled') {
    await sendCancellationConfirmationNotification(sub.user_id, currentPeriodEnd || '');
  }

  // If entering grace period, freeze SP wallet
  if (newStatus === 'grace_period' && sub.status !== 'grace_period') {
    await triggerSpFreeze(sub.user_id, 'subscription_updated_to_grace');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: customer.subscription.deleted
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionDeleted(
  supabase: any,
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
  supabase: any,
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  const stripeSubId = invoice.subscription as string | null;
  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;

  let sub: { id: string; user_id: string; status: string; payment_retry_count: number | null } | null = null;
  let fetchError: { message?: string } | null = null;

  if (stripeSubId) {
    const primaryLookup = await supabase
      .from('subscriptions')
      .select('id, user_id, status, payment_retry_count')
      .eq('stripe_subscription_id', stripeSubId)
      .maybeSingle();

    sub = primaryLookup.data;
    fetchError = primaryLookup.error;
  } else {
    console.warn('[stripe-webhook-subscriptions] handleInvoicePaymentFailed: invoice.subscription missing, trying customer lookup');
  }

  if ((!sub || fetchError) && stripeCustomerId) {
    const fallback = await supabase
      .from('subscriptions')
      .select('id, user_id, status, payment_retry_count')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (!fallback.error && fallback.data) {
      sub = fallback.data as { id: string; user_id: string; status: string; payment_retry_count: number | null };
      fetchError = null;

      if (stripeSubId) {
        const { error: syncError } = await supabase
          .from('subscriptions')
          .update({ stripe_subscription_id: stripeSubId, updated_at: new Date().toISOString() })
          .eq('id', sub.id);

        if (syncError) {
          console.warn(
            `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: matched by customer but failed to sync stripe_subscription_id`,
            syncError,
          );
        } else {
          console.log(
            `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: matched by stripe_customer_id and synced stripe_subscription_id user=${sub.user_id}`,
          );
        }
      } else {
        console.log(
          `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: matched by stripe_customer_id with no subscription id in event user=${sub.user_id}`,
        );
      }
    }
  }

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

  // ── Send payment failure notification to user ──────────────────────────────
  // MODULE-14 NOTIF-V2-002: Critical notifications bypass user preferences
  await sendCriticalPaymentFailureNotification(sub.user_id, retryCount);

  // ── Freeze SP if 3rd failure → grace period ────────────────────────────────
  if (maxRetriesReached && sub.status !== 'grace_period') {
    await triggerSpFreeze(sub.user_id, 'payment_failed_max_retries');
  }
}

// ============================================================================
// R7 — Web-first subscription purchase helpers
// ============================================================================

function secondsToIso(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    return null;
  }
  const asDate = new Date(Number(value) * 1000);
  if (Number.isNaN(asDate.getTime())) {
    return null;
  }
  return asDate.toISOString();
}

function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveUserByEmail(
  supabase: any,
  email: string | null | undefined,
): Promise<string | null> {
  if (!email) {
    return null;
  }
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .ilike('email', email.trim().toLowerCase())
    .maybeSingle();
  return data?.user_id ?? null;
}

async function resolveTierIdForPrice(
  supabase: any,
  priceId: string | null | undefined,
): Promise<string | null> {
  if (!priceId) {
    return null;
  }
  const { data } = await supabase
    .from('subscription_tiers')
    .select('id')
    .eq('stripe_price_id', priceId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Upsert the subscriptions row from a Stripe subscription object.
 * Status mapping: Stripe 'trialing' → internal 'trial'; 'active' → 'active'.
 *
 * Returns the DB subscription id + the prior status so callers can tell a
 * genuinely NEW row (old_status === null) from a re-bind/update of an existing
 * row — only a new row warrants writing the initial billing record (DEV-TASK-92).
 */
async function upsertWebSubscription(
  supabase: any,
  userId: string,
  subscription: Stripe.Subscription,
  tierId: string | null,
): Promise<{ subscription_id: string | null; old_status: string | null }> {
  const status = subscription.status === 'trialing' ? 'trial' : 'active';
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null;

  const { data, error } = await supabase.rpc('rpc_upsert_web_subscription', {
    p_user_id: userId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_tier_id: tierId,
    p_status: status,
    p_period_start: secondsToIso(subscription.current_period_start),
    p_period_end: secondsToIso(subscription.current_period_end),
    p_has_used_trial: true,
    p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    p_trial_end: secondsToIso(subscription.trial_end ?? null),
  });

  if (error) {
    throw new Error(`upsertWebSubscription RPC failed: ${error.message}`);
  }

  // RPC RETURNS JSONB → a single object (not a RETURNS TABLE array).
  return {
    subscription_id: (data as { subscription_id?: string | null } | null)?.subscription_id ?? null,
    old_status: (data as { old_status?: string | null } | null)?.old_status ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: checkout.session.completed (R7 — web subscription purchase)
// ─────────────────────────────────────────────────────────────────────────────
async function handleCheckoutSessionCompleted(
  supabase: any,
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  if (session.mode !== 'subscription') {
    console.log(`[stripe-webhook-subscriptions] checkout.session.completed: ignoring non-subscription session=${session.id} mode=${session.mode}`);
    return;
  }

  // Resolve the app user: client_reference_id → metadata.supabase_user_id → email match.
  let userId: string | null = null;
  if (isUuid(session.client_reference_id)) {
    userId = session.client_reference_id as string;
  }
  if (!userId && isUuid(session.metadata?.supabase_user_id)) {
    userId = session.metadata?.supabase_user_id as string;
  }
  if (!userId) {
    const email = session.customer_details?.email || session.customer_email || session.metadata?.email || null;
    userId = await resolveUserByEmail(supabase, email);
  }

  if (!userId) {
    // No app account yet — the subscription will be bound later via
    // link-subscription-account (email match + one-time token) once the parent
    // signs up / signs in with the same email.
    console.log(
      `[stripe-webhook-subscriptions] checkout.session.completed: no resolvable app user, deferring binding`,
      { checkout_session_id: session.id, email: session.customer_details?.email || session.customer_email },
    );
    return;
  }

  const stripeSubId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!stripeSubId) {
    console.warn(`[stripe-webhook-subscriptions] checkout.session.completed: no subscription on session=${session.id}`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(stripeSubId);
  if (subscription.status !== 'trialing' && subscription.status !== 'active') {
    console.log(
      `[stripe-webhook-subscriptions] checkout.session.completed: subscription not yet active/trialing status=${subscription.status}`,
      { checkout_session_id: session.id },
    );
    return;
  }

  const tierId = await resolveTierIdForPrice(supabase, subscription.items?.data?.[0]?.price?.id ?? null);
  const upsert = await upsertWebSubscription(supabase, userId, subscription, tierId);

  // DEV-TASK-92/94 (2026-09-02/03): a brand-new web subscription's initial charge must
  // appear in Transaction History. Stripe may deliver the initial
  // `invoice.payment_succeeded` BEFORE this handler binds the subscriptions row
  // (the invoice handler then no-ops on the unbound row and webhooks are never
  // re-delivered after a 200), so record the first paid invoice here — but only
  // on a transition FROM a non-live subscription state (see shouldRecordInitialBilling:
  // every user starts with a signup-created `free` row, so the RPC UPDATE returns
  // old_status='free', never null), and never on a re-bind/update of an ALREADY
  // live subscription (e.g. a test-clock re-bind of an active sub). The billing
  // write runs BEFORE the welcome notification so a slow notification can never
  // delay/starve the money-critical write.
  if (upsert.subscription_id && shouldRecordInitialBilling(upsert.old_status)) {
    await recordInitialBillingRow(supabase, upsert.subscription_id, userId, subscription);
  }
  await sendSubscriptionWelcomeNotification(userId, subscription.status === 'trialing');

  console.log(
    `[stripe-webhook-subscriptions] checkout.session.completed: linked user=${userId} subscription=${stripeSubId} status=${subscription.status} old_status=${upsert.old_status} event=${eventId}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: customer.subscription.created (R7 — idempotent confirmation)
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionCreated(
  supabase: any,
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  let userId: string | null = null;

  if (isUuid(subscription.metadata?.supabase_user_id)) {
    userId = subscription.metadata?.supabase_user_id as string;
  }

  if (!userId) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) {
        if (isUuid(customer.metadata?.supabase_user_id)) {
          userId = customer.metadata?.supabase_user_id as string;
        }
        if (!userId) {
          userId = await resolveUserByEmail(supabase, customer.email);
        }
      }
    }
  }

  if (!userId) {
    console.log(
      `[stripe-webhook-subscriptions] customer.subscription.created: no resolvable app user, deferring`,
      { subscription_id: subscription.id },
    );
    return;
  }

  if (subscription.status !== 'trialing' && subscription.status !== 'active') {
    return;
  }

  const tierId = await resolveTierIdForPrice(supabase, subscription.items?.data?.[0]?.price?.id ?? null);
  const upsert = await upsertWebSubscription(supabase, userId, subscription, tierId);

  // DEV-TASK-92/94: same initial-billing-row net as checkout.session.completed —
  // the first row-binding handler records the first paid invoice; whichever of
  // the two events wins the race, the sibling then sees the row is already live
  // and is a no-op (shouldRecordInitialBilling(old_status) === false for active).
  // DEV-TASK-94: gate is shouldRecordInitialBilling — never old_status === null,
  // because the signup trigger pre-creates a `free` subscriptions row, so the
  // RPC UPDATE path returns old_status='free' on the first real subscription.
  if (upsert.subscription_id && shouldRecordInitialBilling(upsert.old_status)) {
    await recordInitialBillingRow(supabase, upsert.subscription_id, userId, subscription);
  }

  console.log(
    `[stripe-webhook-subscriptions] customer.subscription.created: linked user=${userId} subscription=${subscription.id} status=${subscription.status} old_status=${upsert.old_status} event=${eventId}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: decide whether a subscription transition warrants recording the
// subscription's current (initial) paid invoice as a billing_history row.
//
// DEV-TASK-94 (2026-09-03): the original DT92 gate (old_status === null, i.e.
// "the RPC just INSERTED a brand-new row") never fired in practice because the
// signup trigger (20260214000000_add_subscription_creation_to_signup.sql) pre-
// creates a default `subscriptions` row with status 'free' for EVERY user — so
// the RPC always finds that row and takes its UPDATE path, returning
// old_status='free', never null. result: recordInitialBillingRow was never
// called and the initial $5.99 charge never reached Transaction History (QA
// Task 22 reproduced live).
//
// The correct semantic: record the initial invoice on any transition FROM a
// non-live subscription state — brand-new (null), free→paid, or a re-subscribe
// after cancel/expiry (all of which carry a REAL first charge) — but NOT when
// the row was ALREADY a live paid subscription (active/trial/grace) and is just
// being re-bound/updated (e.g. QA Task 21's test-clock re-bind of an active sub,
// whose initial invoice is not a real user charge).
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_SUB_STATUSES = new Set(['active', 'trial', 'grace', 'grace_period']);

function shouldRecordInitialBilling(oldStatus: string | null | undefined): boolean {
  return oldStatus == null || !LIVE_SUB_STATUSES.has(oldStatus);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: record the very first (initial) paid invoice of a brand-new web
// subscription as a billing_history row.
//
// DEV-TASK-92 (2026-09-02): QA Task 21 found the initial web-purchase charge
// produced NO billing_history row — only renewals did. Root cause: for a new
// subscription Stripe can deliver the initial `invoice.payment_succeeded`
// BEFORE checkout.session.completed / customer.subscription.created bind the
// `subscriptions` row, so handleInvoicePaymentSucceeded no-ops on the missing/
// unbound row and (webhooks are not re-delivered after a 200) the first $5.99
// charge is never recorded. Called by the row-binding handlers right after the
// row is transitioned to a live subscription (see shouldRecordInitialBilling),
// so the initial charge is recorded deterministically regardless of event
// ordering.
// Idempotent: pre-checked by stripe_invoice_id + upsert onConflict charge_id,
// so a later real invoice.payment_succeeded (or the sibling handler) never
// creates a duplicate.
// ─────────────────────────────────────────────────────────────────────────────
async function recordInitialBillingRow(
  supabase: any,
  dbSubscriptionId: string,
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const latestInvoiceId =
    (typeof subscription.latest_invoice === 'string' && subscription.latest_invoice) ||
    subscription.latest_invoice?.id ||
    null;

  // DEV-TASK-94: explicit branch markers — the EF log tool has been down several
  // sessions, so each early-return/success/failure point is individually logged
  // for any future log read-back.
  console.log(
    `[stripe-webhook-subscriptions] recordInitialBillingRow: enter user=${userId} sub=${dbSubscriptionId} latest_invoice=${latestInvoiceId ?? '(none)'}`,
  );

  if (!latestInvoiceId) {
    console.log(
      `[stripe-webhook-subscriptions] recordInitialBillingRow: no latest_invoice on subscription — skipping`,
    );
    return;
  }

  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(latestInvoiceId);
  } catch (err: any) {
    console.warn(
      `[stripe-webhook-subscriptions] recordInitialBillingRow: invoice retrieve failed`,
      { invoice_id: latestInvoiceId, error: err?.message },
    );
    return;
  }

  const amount = invoice.amount_paid ?? invoice.amount_due ?? 0;
  if (invoice.status !== 'paid' || amount <= 0) {
    // e.g. a $0 trial invoice, or an async payment not yet settled when the
    // row-binding handler runs — nothing to record yet.
    console.log(
      `[stripe-webhook-subscriptions] recordInitialBillingRow: invoice not paid/settled yet invoice=${invoice.id} status=${invoice.status} amount=${amount} — skipping`,
    );
    return;
  }

  const { data: existing } = await supabase
    .from('billing_history')
    .select('id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();
  if (existing?.id) {
    console.log(
      `[stripe-webhook-subscriptions] recordInitialBillingRow: already recorded invoice=${invoice.id} — skipping`,
    );
    return; // already recorded (helper or invoice.payment_succeeded handler).
  }

  // Same charge-id fallback as handleInvoicePaymentSucceeded so a subsequent
  // real invoice.payment_succeeded upsert reconciles onto this row. This
  // environment's invoices carry no charge/payment_intent id, so charge_id
  // falls back to invoice.id — unique per invoice, so it never collides.
  const chargeId =
    (typeof invoice.charge === 'string' && invoice.charge) ||
    (typeof invoice.payment_intent === 'string' && invoice.payment_intent) ||
    invoice.id;

  const { error: billingError } = await supabase.from('billing_history').upsert(
    {
      user_id: userId,
      subscription_id: dbSubscriptionId,
      charge_id: chargeId,
      stripe_invoice_id: invoice.id,
      amount,
      status: 'succeeded',
    },
    { onConflict: 'charge_id' },
  );

  if (billingError) {
    console.warn(
      `[stripe-webhook-subscriptions] recordInitialBillingRow: billing_history insert failed`,
      billingError,
    );
  } else {
    console.log(
      `[stripe-webhook-subscriptions] recordInitialBillingRow: recorded initial charge user=${userId} invoice=${invoice.id} amount=${amount}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute the DB period-window advance for a successful renewal invoice
// (DEV-TASK-88, 2026-09-02). Stripe reports NULL current_period_* on the
// subscription object in this environment, so the renewal invoice line period is
// the authoritative next window. Returns null (no advance) when the invoice has
// no line period, or when the renewal end is NOT later than the stored end
// (forward-only, so replays / out-of-order events never regress the DB).
// ─────────────────────────────────────────────────────────────────────────────
function computePeriodAdvance(
  existingEndIso: string | null,
  renewalStartSec: number | null | undefined,
  renewalEndSec: number | null | undefined,
): Record<string, unknown> | null {
  if (!renewalEndSec || !Number.isFinite(renewalEndSec) || renewalEndSec <= 0) {
    return null;
  }

  const existingEndMs = existingEndIso ? Date.parse(existingEndIso) : NaN;
  const nextEndMs = renewalEndSec * 1000;

  if (Number.isFinite(existingEndMs) && nextEndMs <= existingEndMs) {
    return null; // forward-only
  }

  const payload: Record<string, unknown> = {
    current_period_end: new Date(nextEndMs).toISOString(),
    next_billing_date: new Date(nextEndMs).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (renewalStartSec && Number.isFinite(renewalStartSec) && renewalStartSec > 0) {
    payload.current_period_start = new Date(renewalStartSec * 1000).toISOString();
  }

  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: invoice.payment_succeeded (R7 — renewal success)
// Resets the payment retry counter, records a billing_history row, restores
// status back to 'active' if a prior failure had pushed the account to grace,
// and ADVANCES the subscription's period window (current_period_start/end +
// next_billing_date) from the renewal invoice's line period.
//
// DEV-TASK-88 (2026-09-02): Stripe reports NULL current_period_* on the
// subscription object for the accounts/subs in this environment (verified
// systemic: all subs on the Stripe account returned current_period_start/end
// = null even after paid renewals), so customer.subscription.updated can never
// advance the DB period window. The renewal invoice line period IS populated,
// so this handler is the reliable renewal-advance path. It is also the sole
// writer of renewal billing_history rows.
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoicePaymentSucceeded(
  supabase: any,
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;

  let sub: { id: string; user_id: string; status: string; current_period_end: string | null } | null = null;

  if (stripeSubId) {
    const primary = await supabase
      .from('subscriptions')
      .select('id, user_id, status, current_period_end')
      .eq('stripe_subscription_id', stripeSubId)
      .maybeSingle();
    sub = primary.data;
  }

  if (!sub && stripeCustomerId) {
    const fallback = await supabase
      .from('subscriptions')
      .select('id, user_id, status, current_period_end')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    if (!fallback.error && fallback.data) {
      sub = fallback.data;
    }
  }

  if (!sub) {
    console.log(
      `[stripe-webhook-subscriptions] invoice.payment_succeeded: no subscription record`,
      { invoice_id: invoice.id, stripe_subscription_id: stripeSubId },
    );
    return;
  }

  const amount = invoice.amount_paid ?? invoice.amount_due ?? 0;
  const chargeId =
    (typeof invoice.charge === 'string' && invoice.charge) ||
    (typeof invoice.payment_intent === 'string' && invoice.payment_intent) ||
    invoice.id;

  // Renewal success: reset retry count + record last payment (SUB-002 RPC).
  const { error: attemptError } = await supabase.rpc('record_payment_attempt', {
    p_user_id: sub.user_id,
    p_success: true,
    p_amount: amount,
    p_charge_id: chargeId,
  });
  if (attemptError) {
    throw new Error(`record_payment_attempt failed: ${attemptError.message}`);
  }

  // Billing ledger (idempotent on charge_id).
  const { error: billingError } = await supabase.from('billing_history').upsert(
    {
      user_id: sub.user_id,
      subscription_id: sub.id,
      charge_id: chargeId,
      stripe_invoice_id: invoice.id,
      amount,
      status: 'succeeded',
    },
    { onConflict: 'charge_id' },
  );
  if (billingError) {
    console.error(`[stripe-webhook-subscriptions] invoice.payment_succeeded: billing_history insert failed`, billingError);
  }

  // ── DEV-TASK-88: Advance the DB period window from the renewal invoice ──────
  // Stripe reports NULL current_period_start/current_period_end on the
  // subscription object for this environment's subs (systemic — verified), so
  // customer.subscription.updated can never advance the DB. The renewal
  // invoice's line period IS populated (verified: in_1U92cw line period start
  // 2026-08-27 / end 2026-09-27) and is the authoritative next period. Advance
  // current_period_start/end + next_billing_date FORWARD ONLY (never regress),
  // so replays/out-of-order events are idempotent.
  const renewalLine = invoice.lines?.data?.[0];
  const periodAdvance = computePeriodAdvance(
    sub.current_period_end,
    renewalLine?.period?.start,
    renewalLine?.period?.end,
  );

  if (periodAdvance) {
    const { error: periodError } = await supabase
      .from('subscriptions')
      .update(periodAdvance)
      .eq('id', sub.id);

    if (periodError) {
      console.error(
        `[stripe-webhook-subscriptions] invoice.payment_succeeded: period advance failed`,
        periodError,
      );
    } else {
      console.log(
        `[stripe-webhook-subscriptions] invoice.payment_succeeded: advanced period user=${sub.user_id} end=${periodAdvance.current_period_end} event=${eventId}`,
      );
    }
  } else {
    console.log(
      `[stripe-webhook-subscriptions] invoice.payment_succeeded: no period advance for invoice=${invoice.id}`,
    );
  }

  // If a previous failure had pushed the account into grace/cancel, a successful
  // renewal restores it to active (R6: SP earn/spend gating re-enables).
  if (sub.status === 'grace_period' || sub.status === 'grace' || sub.status === 'cancelled' || sub.status === 'canceled') {
    const { error: statusError } = await supabase.rpc('update_subscription_status', {
      p_user_id: sub.user_id,
      p_status: 'active',
      p_last_payment_date: new Date().toISOString(),
      p_last_payment_amount: amount,
      p_next_billing_date: invoice.lines?.data?.[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
        : null,
    });
    if (statusError) {
      console.error(`[stripe-webhook-subscriptions] invoice.payment_succeeded: status restore failed`, statusError);
    }
  }

  console.log(
    `[stripe-webhook-subscriptions] invoice.payment_succeeded: user=${sub.user_id} amount=${amount} event=${eventId}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-14 NOTIF-V2-002: Subscription notification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send subscription renewal success notification
 */
async function sendSubscriptionRenewalNotification(userId: string, nextBillingDate: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[stripe-webhook-subscriptions] Missing Supabase credentials for renewal notification');
    return;
  }

  try {
    const formattedDate = new Date(nextBillingDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create notification in database
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.from('user_notifications').insert({
      user_id: userId,
      category: 'subscription',
      type: 'subscription',
      title: 'Subscription Renewed ✅',
      body: `Your Kids Club+ subscription has been renewed. Your next billing date is ${formattedDate}.`,
      channels: ['push', 'in_app'],
      data: {
        event: 'subscription_renewed',
        next_billing_date: nextBillingDate,
        deep_link: '/profile/subscription',
      },
      is_read: false,
    });

    if (error) {
      console.error('[stripe-webhook-subscriptions] Failed to create renewal notification:', error);
      return;
    }

    // Send push notification
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title: 'Subscription Renewed ✅',
        body: `Your Kids Club+ subscription has been renewed. Next billing: ${formattedDate}.`,
        data: {
          type: 'subscription',
          event: 'subscription_renewed',
        },
      },
    });

    console.log(`[stripe-webhook-subscriptions] Renewal notification sent to user=${userId}`);
  } catch (err: any) {
    console.error('[stripe-webhook-subscriptions] Renewal notification error:', err.message);
  }
}

/**
 * Send "Welcome to Kids Club+" notification after a successful web subscription
 * (R7). For trial subscriptions, tell them when the trial ends.
 */
async function sendSubscriptionWelcomeNotification(userId: string, isTrial: boolean): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[stripe-webhook-subscriptions] Missing Supabase credentials for welcome notification');
    return;
  }

  try {
    // QA Task 20 F-2 (fee copy) / F-3 (trial copy): build the welcome body from
    // live admin_config so it can't drift from the charged fee again.
    //   fee:       buyer_fee_active_member_cents (149 default = seed canonical)
    //   trial days: trial_period_days (only meaningful when a trial is actually
    //               running — Stripe status 'trialing' reaches this branch).
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let flatFeeCents = 149;
    let trialDays = 30;
    const { data: feeCfg } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'buyer_fee_active_member_cents')
      .eq('is_active', true)
      .maybeSingle<{ value: string | null }>();
    if (feeCfg?.value != null) {
      const parsedFee = Number(feeCfg.value);
      if (Number.isFinite(parsedFee) && parsedFee >= 0) flatFeeCents = Math.round(parsedFee);
    }
    const { data: trialCfg } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'trial_period_days')
      .eq('is_active', true)
      .maybeSingle<{ value: string | null }>();
    if (trialCfg?.value != null) {
      const parsedTrial = Number(trialCfg.value);
      if (Number.isFinite(parsedTrial) && parsedTrial > 0) trialDays = Math.round(parsedTrial);
    }

    const flatFee = `$${(flatFeeCents / 100).toFixed(2)}`;
    const title = isTrial ? 'Welcome to Kids Club+ 🎉' : 'You\'re a Kids Club+ member 🎉';
    const body = isTrial
      ? `Your ${trialDays}-day free trial has started. Earn Swap Points and enjoy the ${flatFee} flat fee — no charge until your trial ends.`
      : `Your membership is active. Earn Swap Points on sales and pay the ${flatFee} flat fee instead of the free-user percentage fee.`;

    const { error } = await supabase.from('user_notifications').insert({
      user_id: userId,
      category: 'subscription',
      type: 'subscription',
      title,
      body,
      channels: ['push', 'in_app'],
      data: {
        event: 'subscription_created',
        deep_link: '/profile/subscription',
      },
      is_read: false,
    });

    if (error) {
      console.error('[stripe-webhook-subscriptions] Failed to create welcome notification:', error);
      return;
    }

    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title,
        body,
        data: {
          type: 'subscription',
          event: 'subscription_created',
        },
      },
    });

    console.log(`[stripe-webhook-subscriptions] Welcome notification sent to user=${userId} trial=${isTrial}`);
  } catch (err: any) {
    console.error('[stripe-webhook-subscriptions] Welcome notification error:', err.message);
  }
}

/**
 * Send cancellation confirmation notification
 */
async function sendCancellationConfirmationNotification(userId: string, accessUntil: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[stripe-webhook-subscriptions] Missing Supabase credentials for cancellation notification');
    return;
  }

  try {
    const formattedDate = new Date(accessUntil).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create notification in database
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.from('user_notifications').insert({
      user_id: userId,
      category: 'subscription',
      type: 'subscription',
      title: 'Subscription Cancelled',
      body: `Your Kids Club+ subscription has been cancelled. You'll have access until ${formattedDate}, then enter a 90-day grace period where your Swap Points will be frozen.`,
      channels: ['push', 'in_app'],
      data: {
        event: 'subscription_cancelled',
        access_until: accessUntil,
        deep_link: '/profile/subscription',
      },
      is_read: false,
    });

    if (error) {
      console.error('[stripe-webhook-subscriptions] Failed to create cancellation notification:', error);
      return;
    }

    // Send push notification
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title: 'Subscription Cancelled',
        body: `You'll have access until ${formattedDate}. Your Swap Points will be frozen after.`,
        data: {
          type: 'subscription',
          event: 'subscription_cancelled',
        },
      },
    });

    console.log(`[stripe-webhook-subscriptions] Cancellation notification sent to user=${userId}`);
  } catch (err: any) {
    console.error('[stripe-webhook-subscriptions] Cancellation notification error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send payment failure notification (MODULE-11 TASK SUB-018)
// Calls send-push-notification Edge Function to notify user of payment issue
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send critical payment failure notification (MODULE-14 NOTIF-V2-002)
 * CRITICAL notifications bypass user preferences and are always sent
 */
async function sendCriticalPaymentFailureNotification(userId: string, retryCount: number): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[stripe-webhook-subscriptions] Missing Supabase credentials for payment failure notification');
    return;
  }

  const messages = {
    1: 'Your payment was declined. Please update your payment method to keep your subscription active.',
    2: 'Your subscription payment was declined again. Please update your payment method to avoid service interruption.',
    3: 'Final attempt failed. Your subscription will be paused soon. Please update your payment method immediately.',
  };

  const body = messages[retryCount as keyof typeof messages] || messages[1];

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create CRITICAL notification in database (bypasses preferences)
    const { error } = await supabase.from('user_notifications').insert({
      user_id: userId,
      category: 'subscription',
      type: 'subscription',
      title: '⚠️ Payment Failed - Action Required',
      body,
      channels: ['push', 'in_app'],
      data: {
        event: 'payment_failed',
        retry_count: retryCount,
        action_required: true,
        deep_link: '/profile/subscription',
        critical: true, // Mark as critical
      },
      is_read: false,
    });

    if (error) {
      console.error('[stripe-webhook-subscriptions] Failed to create payment failure notification:', error);
      return;
    }

    // Send push notification (CRITICAL - always sent)
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title: '⚠️ Payment Failed - Action Required',
        body,
        data: {
          type: 'subscription',
          event: 'payment_failed',
          retry_count: retryCount.toString(),
          critical: true,
        },
      },
    });

    console.log(`[stripe-webhook-subscriptions] Critical payment failure notification sent to user=${userId} retry=${retryCount}`);
  } catch (err: any) {
    console.error('[stripe-webhook-subscriptions] Payment failure notification error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED: Legacy payment failure notification (kept for backward compatibility)
// Use sendCriticalPaymentFailureNotification() instead
// ─────────────────────────────────────────────────────────────────────────────
async function sendPaymentFailureNotification(userId: string, retryCount: number): Promise<void> {
  const notificationUrl = Deno.env.get('SEND_PUSH_NOTIFICATION_URL');

  // Determine notification message based on retry count
  let body = '';
  switch (retryCount) {
    case 1:
      body = 'Your payment was declined. Please update your payment method to keep your subscription active.';
      break;
    case 2:
      body = 'Your subscription payment was declined again. Please update your card or it will be paused.';
      break;
    case 3:
      body = 'Your Kids Club+ access has been paused. Re-subscribe to restore your Swap Points.';
      break;
    default:
      body = 'There was an issue with your subscription payment. Please update your payment method.';
  }

  if (!notificationUrl) {
    // TODO(MODULE-14): Configure SEND_PUSH_NOTIFICATION_URL once push notification system is deployed
    console.warn(
      `[stripe-webhook-subscriptions] SEND_PUSH_NOTIFICATION_URL not set — skipping notification for user=${userId} retry=${retryCount}`,
    );
    return;
  }

  try {
    const resp = await fetch(notificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        title: 'Payment Failed',
        body,
        data: {
          type: 'payment_failure',
          retry_count: retryCount.toString(),
          action: 'update_payment_method',
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(
        `[stripe-webhook-subscriptions] Payment failure notification failed user=${userId} status=${resp.status} body=${text}`,
      );
    } else {
      console.log(`[stripe-webhook-subscriptions] Payment failure notification sent user=${userId} retry=${retryCount}`);
    }
  } catch (err: any) {
    // Non-blocking: Notification failure must not prevent subscription state update
    console.error(`[stripe-webhook-subscriptions] Notification error user=${userId}:`, err.message);
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
