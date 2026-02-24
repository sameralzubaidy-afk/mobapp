// File: supabase/functions/cancel-subscription/index.ts
// MODULE-11 TASK SUB-008: User-Initiated Cancellation Flow
//
// This Edge Function handles user-initiated subscription cancellations:
// - For 'active' users: Sets Stripe cancel_at_period_end, status → 'cancelled'
// - For 'trial' users with SP activity: Immediate move to 'grace_period'
// - For 'trial' users without SP activity: Move to 'free'
//
// Per V2 rules:
// - SP wallet is frozen only when entering grace_period
// - User keeps Kids Club+ benefits until current period ends (for active)
// - cancel_reason is captured for analytics

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

function getStripeClient(): Stripe | null {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    console.warn('[cancel-subscription] STRIPE_SECRET_KEY is not configured; Stripe calls will be skipped');
    return null;
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
  });
}

// ─── CORS headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CancelSubscriptionRequest {
  cancel_reason?: string;
}

interface CancelSubscriptionResponse {
  success: boolean;
  new_status: 'cancelled' | 'grace_period' | 'free';
  message: string;
  current_period_end?: string;
  grace_period_ends_at?: string;
}

// ─── Helper: Get grace period days from tier ──────────────────────────────────
async function getGracePeriodDays(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<number> {
  const DEFAULT_GRACE_DAYS = 90;

  try {
    // Preferred source: admin_config.grace_period_days (dynamic admin-controlled setting)
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

    // Legacy admin_config schema fallback: config_key/config_value
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

    // First get user's tier_id
    const { data: subData, error: subError } = await supabase
      .from('subscriptions')
      .select('tier_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError || !subData?.tier_id) {
      console.warn('[cancel-subscription] Could not fetch tier_id, using default grace period');
      return DEFAULT_GRACE_DAYS;
    }

    // Get grace_period_days from tier
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('grace_period_days')
      .eq('id', subData.tier_id)
      .maybeSingle();

    if (tierError || tierData?.grace_period_days == null) {
      console.warn('[cancel-subscription] Could not fetch grace_period_days, using default');
      return DEFAULT_GRACE_DAYS;
    }

    return Math.max(tierData.grace_period_days, 0);
  } catch (err) {
    console.error('[cancel-subscription] Error getting grace period days:', err);
    return DEFAULT_GRACE_DAYS;
  }
}

// ─── Helper: Check if user has SP activity ────────────────────────────────────
async function hasSpActivity(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  try {
    // Check if user has any SP ledger entries
    const { data, error } = await supabase
      .from('sp_ledger')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.warn('[cancel-subscription] Error checking SP activity:', error.message);
      return false;
    }

    return data && data.length > 0;
  } catch (err) {
    console.error('[cancel-subscription] Unexpected error checking SP activity:', err);
    return false;
  }
}

// ─── Helper: Freeze SP wallet ─────────────────────────────────────────────────
async function freezeSpWallet(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  graceEndsAt: Date
): Promise<void> {
  try {
    const { error } = await supabase
      .from('sp_wallets')
      .update({
        frozen_at: new Date().toISOString(),
        grace_period_ends_at: graceEndsAt.toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[cancel-subscription] Error freezing SP wallet:', error.message);
      // We don't throw here - subscription cancellation should still proceed
    } else {
      console.log('[cancel-subscription] SP wallet frozen for user:', userId);
    }
  } catch (err) {
    console.error('[cancel-subscription] Unexpected error freezing SP wallet:', err);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization header format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Base env
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfiguration: missing Supabase env vars' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for auth verification and DB updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('[cancel-subscription] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', details: authError?.message || 'Token validation failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('[cancel-subscription] Processing cancellation for user:', userId);

    // Parse request body
    let body: CancelSubscriptionRequest = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is OK - cancel_reason is optional
    }
    const cancelReason = body.cancel_reason || 'User requested cancellation';

    // Reuse service role client for DB updates

    // Get current subscription status
    const { data: subData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, stripe_subscription_id, current_period_end, tier_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      console.error('[cancel-subscription] Error fetching subscription:', subError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subData) {
      return new Response(
        JSON.stringify({ success: false, error: 'No subscription found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentStatus = subData.status;
    const stripeSubId = subData.stripe_subscription_id;

    // Only allow cancellation from 'active' or 'trial' status
    if (!['active', 'trial'].includes(currentStatus)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot cancel subscription in '${currentStatus}' status` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newStatus: 'cancelled' | 'grace_period' | 'free' = 'cancelled';
    let message = '';
    let currentPeriodEnd: string | undefined;
    let graceEndsAt: string | undefined;

    const now = new Date();

    if (currentStatus === 'active') {
      // ─── ACTIVE USER CANCELLATION ───────────────────────────────────────────
      // Set Stripe cancel_at_period_end, keep benefits until period ends
      
      if (stripeSubId) {
        const stripe = getStripeClient();
        if (!stripe) {
          console.warn('[cancel-subscription] Stripe update skipped (missing STRIPE_SECRET_KEY)');
        } else {
        try {
          await stripe.subscriptions.update(stripeSubId, {
            cancel_at_period_end: true,
          });
          console.log('[cancel-subscription] Stripe subscription set to cancel at period end:', stripeSubId);
        } catch (stripeError: unknown) {
          const errMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
          console.error('[cancel-subscription] Stripe update failed:', errMessage);
          // Continue with DB update even if Stripe fails (webhook will handle it)
        }
        }
      }

      newStatus = 'cancelled';
      currentPeriodEnd = subData.current_period_end;
      message = 'Your subscription has been cancelled. You will retain Kids Club+ benefits until your billing period ends.';

      // Update DB: status → cancelled, set cancelled_at and cancel_reason
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: now.toISOString(),
          cancel_reason: cancelReason,
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[cancel-subscription] DB update error:', updateError.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update subscription',
            details: updateError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } else if (currentStatus === 'trial') {
      // ─── TRIAL USER CANCELLATION ────────────────────────────────────────────
      // Check SP activity to decide: grace_period vs free
      
      const hasSp = await hasSpActivity(supabaseAdmin, userId);
      const gracePeriodDays = await getGracePeriodDays(supabaseAdmin, userId);
      
      if (hasSp) {
        // Trial user with SP activity → grace_period
        newStatus = 'grace_period';
        const graceEnd = new Date(now);
        graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
        graceEndsAt = graceEnd.toISOString();

        // Freeze SP wallet
        await freezeSpWallet(supabaseAdmin, userId, graceEnd);

        message = `Your trial has been cancelled. Your Swap Points are frozen for ${gracePeriodDays} days. Re-subscribe to restore access.`;
      } else {
        // Trial user without SP activity → free
        newStatus = 'free';
        message = 'Your trial has been cancelled. You are now on the free plan.';
      }

      // Cancel Stripe subscription immediately if exists (not cancel_at_period_end)
      if (stripeSubId) {
        const stripe = getStripeClient();
        if (!stripe) {
          console.warn('[cancel-subscription] Stripe cancel skipped (missing STRIPE_SECRET_KEY)');
        } else {
        try {
          await stripe.subscriptions.cancel(stripeSubId);
          console.log('[cancel-subscription] Stripe trial subscription cancelled:', stripeSubId);
        } catch (stripeError: unknown) {
          const errMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
          console.warn('[cancel-subscription] Stripe cancel failed (may not exist):', errMessage);
        }
        }
      }

      // Update DB based on newStatus
      const updateFields: Record<string, unknown> = {
        status: newStatus,
        cancelled_at: now.toISOString(),
        cancel_reason: cancelReason,
      };

      if (newStatus === 'grace_period') {
        updateFields.grace_started_at = now.toISOString();
        updateFields.grace_ends_at = graceEndsAt;
      }

      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update(updateFields)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[cancel-subscription] DB update error:', updateError.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update subscription',
            details: updateError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[cancel-subscription] Subscription cancelled: ${userId} → ${newStatus}`);

    // Return success response
    const response: CancelSubscriptionResponse = {
      success: true,
      new_status: newStatus,
      message,
      current_period_end: currentPeriodEnd,
      grace_period_ends_at: graceEndsAt,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cancel-subscription] Unexpected error:', errMessage);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: errMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
