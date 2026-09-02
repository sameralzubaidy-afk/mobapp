// File: supabase/functions/create-checkout-session/index.ts
// R7 — Web-First Subscription Purchase (Option A)
// Creates a Stripe Checkout Session (mode=subscription) for the web checkout
// (passitup.com/join). Hosted Checkout keeps card data on Stripe's PCI-DSS L1
// domain → SAQ-A; no client-side Stripe SDK on the web, no custom card fields.
//
// Account linking (user decision 2026-08-09):
//   - Primary: resolve the app user by email (profiles.email) → set
//     client_reference_id + metadata.supabase_user_id so the webhook binds by ID.
//   - Fallback: if the account doesn't exist yet, issue a one-time HMAC
//     bind_token (over the email) so the subscription can be linked later via
//     link-subscription-account (covers "purchased before app account created").
//
// Auth: verify_jwt=false in config.toml. Requires EITHER the shared web secret
// header (x-web-secret == SUBSCRIPTION_WEB_SECRET) OR a valid user JWT.
// BP-7 structured errors; BP-28 fail loud on missing config (no hardcoded price).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const webSecret = Deno.env.get('SUBSCRIPTION_WEB_SECRET') ?? '';
const bindTokenSecret = Deno.env.get('SUBSCRIPTION_BIND_TOKEN_SECRET') ?? '';
const webBaseUrl = (Deno.env.get('SUBSCRIPTION_WEB_URL') ?? 'https://passitup.com').replace(/\/$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-web-secret',
};

type ProfileRow = { user_id: string; email: string | null };
type TierRow = { id: string; stripe_price_id: string | null; trial_days: number | null; is_default: boolean | null };
type SubRow = { has_used_trial: boolean | null };

// HMAC-SHA256 hex (Deno Web Crypto) over `email` using SUBSCRIPTION_BIND_TOKEN_SECRET.
async function hmacToken(email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(bindTokenSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── Auth: shared web secret OR valid user JWT ──────────────────────────
    const webSecretHeader = req.headers.get('x-web-secret') || '';
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    let authenticatedUserId: string | null = null;
    if (webSecret && webSecretHeader && webSecretHeader === webSecret) {
      // web app server → authenticated (shared secret)
    } else if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      authenticatedUserId = user.id;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing credentials' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: { email?: string; user_id?: string; price_id?: string; trial_days?: number } = await req.json();
    const rawEmail = (body.email || '').trim().toLowerCase();
    let email = rawEmail;

    // ── Resolve the app user ───────────────────────────────────────────────
    // Priority: explicit user_id (JWT owner) → email match on profiles.email.
    let resolvedUserId: string | null = null;

    if (authenticatedUserId && (body.user_id === authenticatedUserId || body.user_id == null)) {
      resolvedUserId = authenticatedUserId;
    }

    if (!resolvedUserId && email) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email')
        .ilike('email', email)
        .maybeSingle<ProfileRow>();

      if (!profileError && profile?.user_id) {
        resolvedUserId = profile.user_id;
        email = (profile.email || email).trim().toLowerCase();
      }
    }

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'EMAIL_REQUIRED', message: 'An email address is required to subscribe.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve the Stripe price (BP-28: fail loud, no hardcoded fallback) ──
    // DT-58 (2026-08-30): price_id is validated against an ALLOWLIST — the set of
    // stripe_price_id values on ACTIVE subscription_tiers rows. An unmatched price_id
    // is rejected (INVALID_PRICE_ID); a client can no longer point checkout at an
    // arbitrary Stripe price. trial_days is ALWAYS derived server-side from the
    // resolved tier (admin-configured); the client's trial_days is ignored entirely.
    const { data: activeTiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('id, stripe_price_id, trial_days, is_default')
      .eq('is_active', true)
      .not('stripe_price_id', 'is', null)
      .order('is_default', { ascending: false });

    if (tiersError) {
      console.error('[create-checkout-session] tier lookup error:', tiersError);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'CONFIG_UNAVAILABLE', message: 'Subscription pricing is not configured yet. Please try again later.' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const requestedPriceId = body.price_id || null;
    let priceId: string | null = null;
    let tierId: string | null = null;
    let trialDays: number | null = null;

    const allowlist = (activeTiers ?? []) as Array<TierRow>;
    if (requestedPriceId) {
      const matchedTier = allowlist.find((t) => t.stripe_price_id === requestedPriceId);
      if (!matchedTier) {
        console.error(`[create-checkout-session] rejected unknown price_id: ${requestedPriceId}`);
        return new Response(
          JSON.stringify({ success: false, error: { code: 'INVALID_PRICE_ID', message: 'This subscription plan is no longer available. Please refresh and try again.' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      priceId = requestedPriceId;
      tierId = matchedTier.id;
      trialDays = matchedTier.trial_days ?? null;
    } else {
      const defaultTier = allowlist.find((t) => t.is_default) ?? allowlist[0] ?? null;
      if (!defaultTier?.stripe_price_id) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'CONFIG_UNAVAILABLE', message: 'Subscription pricing is not configured yet. Please try again later.' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      priceId = defaultTier.stripe_price_id;
      tierId = defaultTier.id;
      trialDays = defaultTier.trial_days ?? null;
    }

    // ── Trial gating: honor admin_config.trial_enabled (QA Task 20 F-3).
    //    When the admin switch is OFF, no trial is granted regardless of the
    //    resolved tier's trial_days (D-001: staging trial_enabled=false). When
    //    it is ON, the tier's trial_days governs (server-derived only).
    //    Fail-open only on a config-read error? NO — fail closed to "no trial"
    //    is the safe default for a trial currently disabled at the config level,
    //    but a genuine config outage must not silently change billing either.
    //    We treat a missing/disabled key as "no trial" and log the decision.
    {
      let trialEnabled = false;
      const { data: trialCfg, error: trialCfgErr } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'trial_enabled')
        .eq('is_active', true)
        .maybeSingle<{ value: string | null }>();
      if (!trialCfgErr && trialCfg?.value != null) {
        trialEnabled = trialCfg.value === 'true';
      } else {
        console.warn(
          '[create-checkout-session] trial_enabled config read failed; defaulting to no trial.',
          trialCfgErr?.message,
        );
      }
      if (!trialEnabled) {
        trialDays = null; // config says trials are off — ignore tier trial_days.
        console.log('[create-checkout-session] trial_enabled=false → no trial granted.');
      }
    }

    // ── Trial eligibility (one-time; skip if the account already used trial) ─
    let useTrial = true;
    if (resolvedUserId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('has_used_trial')
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<SubRow>();
      if (sub?.has_used_trial === true) {
        useTrial = false;
      }
    }
    // DT-58 (2026-08-30): trial_days is server-derived ONLY (the resolved tier's
    // admin-configured value). The client's trial_days is ignored — no self-granted
    // trial length. 0/null → no trial period. BP-40: trial_period_days and trial_end
    // are mutually exclusive — we only ever set trial_period_days here.
    const trialDaysToUse = trialDays && trialDays > 0 ? trialDays : null;

    // ── Create Stripe Checkout Session (hosted; Apple Pay / Google Pay / card) ─
    const bindToken = resolvedUserId ? null : await hmacToken(email);
    const successUrl = `${webBaseUrl}/account/subscription?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}${bindToken ? `&bind_token=${bindToken}` : ''}`;

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: useTrial && trialDaysToUse ? { trial_period_days: trialDaysToUse } : undefined,
      customer_email: email,
      client_reference_id: resolvedUserId ?? undefined,
      metadata: {
        ...(resolvedUserId ? { supabase_user_id: resolvedUserId } : {}),
        email,
        tier_id: tierId ?? '',
      },
      // DT-58 (2026-08-30): `automatic_payment_methods` is NOT a valid parameter for
      // `checkout.sessions.create` (it belongs on payment intents / payment links) —
      // Stripe rejects the whole request with `parameter_unknown`, so NO session could
      // ever be created. Removed so hosted Checkout uses its default card payment flow
      // (Apple Pay / Google Pay are enabled automatically for card on Checkout).
      success_url: successUrl,
      cancel_url: `${webBaseUrl}/join?cancelled=1`,
    });

    console.log('[create-checkout-session] created', {
      checkout_session_id: checkout.id,
      resolved_user_id: resolvedUserId,
      email,
      price_id: priceId,
      use_trial: useTrial,
    });

    return new Response(
      JSON.stringify({
        success: true,
        url: checkout.url,
        checkout_session_id: checkout.id,
        ...(bindToken ? { bind_token: bindToken } : {}),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[create-checkout-session] error:', error?.message, error?.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'CHECKOUT_CREATE_FAILED',
          message: error?.message || 'We could not start the checkout. Please try again.',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
