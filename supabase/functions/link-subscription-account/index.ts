// File: supabase/functions/link-subscription-account/index.ts
// R7 — Web-First Subscription Purchase (Option A)
// Binds a web (Stripe Checkout) subscription to the currently-logged-in app
// account, covering the "purchased on the web before the app account existed"
// case, or re-syncing status when the webhook could not resolve the user by ID.
//
// Security (account ownership):
//   - If the email being bound matches the authenticated user's email (JWT),
//     no token is required — it is the user's own account.
//   - If the email differs, a valid one-time HMAC bind_token (over that email,
//     from create-checkout-session) is required. This prevents binding a
//     subscription to an account the user does not own.
//   - verify_jwt = true (default) so only signed-in users can link.
//
// Flow: resolve Stripe customer by email → list their subscriptions → upsert the
// subscriptions row for the logged-in user via rpc_upsert_web_subscription.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const bindTokenSecret = Deno.env.get('SUBSCRIPTION_BIND_TOKEN_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

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

function toIso(value: number | null | undefined): string | null {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
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
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to link your subscription.' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: { bind_token?: string; email?: string } = await req.json();
    const email = (body.email || user.email || '').trim().toLowerCase();
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'EMAIL_REQUIRED', message: 'An email address is required.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Ownership check ─────────────────────────────────────────────────────
    const userEmail = (user.email || '').trim().toLowerCase();
    if (email !== userEmail) {
      if (!body.bind_token || !bindTokenSecret) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'BIND_TOKEN_REQUIRED', message: 'A linking token is required for this email.' } }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const expected = await hmacToken(email);
      if (body.bind_token !== expected) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'INVALID_BIND_TOKEN', message: 'This linking token is not valid.' } }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Find Stripe customer + subscriptions by email ───────────────────────
    const customers = await stripe.customers.list({ email, limit: 10 });
    if (!customers.data.length) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'NO_STRIPE_SUBSCRIPTION', message: 'We could not find a subscription for this email yet.' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const linked: Array<{ status: string; stripe_subscription_id: string }> = [];
    let anyError: string | null = null;

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10,
      });
      for (const subscription of subscriptions.data) {
        // Only bind subscriptions that are trialing or active (skip canceled/past_due/incomplete).
        if (subscription.status !== 'trialing' && subscription.status !== 'active') {
          continue;
        }
        const priceId = typeof subscription.items.data[0]?.price?.id === 'string'
          ? subscription.items.data[0].price.id
          : null;

        let tierId: string | null = null;
        if (priceId) {
          const { data: tier } = await supabase
            .from('subscription_tiers')
            .select('id')
            .eq('stripe_price_id', priceId)
            .maybeSingle<{ id: string }>();
          tierId = tier?.id ?? null;
        }

        const newStatus = subscription.status === 'trialing' ? 'trial' : 'active';
        const { error } = await supabase.rpc('rpc_upsert_web_subscription', {
          p_user_id: user.id,
          p_stripe_customer_id: typeof customer.id === 'string' ? customer.id : null,
          p_stripe_subscription_id: subscription.id,
          p_tier_id: tierId,
          p_status: newStatus,
          p_period_start: toIso(subscription.current_period_start),
          p_period_end: toIso(subscription.current_period_end),
          p_has_used_trial: true,
          p_cancel_at_period_end: subscription.cancel_at_period_end || false,
          p_trial_end: toIso(subscription.trial_end ?? undefined),
        });

        if (error) {
          anyError = error.message;
          console.error('[link-subscription-account] upsert failed', { user_id: user.id, subscription_id: subscription.id, error });
        } else {
          linked.push({ status: newStatus, stripe_subscription_id: subscription.id });
        }
      }
    }

    if (!linked.length && !anyError) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active or trial subscription was found for this email.' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[link-subscription-account] linked', { user_id: user.id, email, linked });

    return new Response(
      JSON.stringify({ success: true, linked, partial_error: anyError }),
      { status: anyError && !linked.length ? 500 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[link-subscription-account] error:', error?.message, error?.stack);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'LINK_FAILED', message: error?.message || 'We could not link your subscription. Please try again.' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
