/**
 * FILE: supabase/functions/update-auto-renew/index.ts
 * MODULE-11 TASK SUB-017: Update Auto-Renew Setting
 * 
 * Edge Function to toggle auto-renewal for Kids Club+ subscriptions.
 * Updates both Stripe subscription and local database.
 * 
 * Request body:
 * - auto_renew_enabled: boolean
 * 
 * Response:
 * - success: boolean
 * - auto_renew_enabled: boolean
 * - message: string
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '',  {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    const { auto_renew_enabled } = await req.json();

    if (typeof auto_renew_enabled !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'auto_renew_enabled must be a boolean', code: 'INVALID_INPUT' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
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
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const user_id = user.id;

    console.log('[update-auto-renew] Updating auto-renew for user:', user_id, 'to:', auto_renew_enabled);

    // Fetch user subscription
    const { data: sub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (subError || !sub) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found', code: 'SUBSCRIPTION_NOT_FOUND' }),
        { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Normalize legacy/Stripe spelling variants before business checks.
    const normalizedStatus = sub.status === 'canceled' ? 'cancelled' : sub.status;

    // Expected business-state failures should return 200 with success=false
    // so mobile can show a user-friendly message (instead of generic non-2xx errors).
    if (!['active', 'trial', 'cancelled'].includes(normalizedStatus)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Auto-renew can only be changed while your subscription is active or pending cancellation.',
          code: 'INVALID_STATUS',
          current_status: sub.status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    let stripeSyncWarning: string | null = null;

    // Update Stripe subscription if exists
    if (sub.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: !auto_renew_enabled,
        });

        console.log('[update-auto-renew] Updated Stripe subscription cancel_at_period_end to:', !auto_renew_enabled);
      } catch (stripeError: any) {
        const stripeCode = stripeError?.code || '';
        const stripeMessage = stripeError?.message || '';
        const isMissingSubscription =
          stripeCode === 'resource_missing' || /no such subscription/i.test(stripeMessage);

        // Gracefully continue for stale/missing Stripe subscription ids.
        if (isMissingSubscription) {
          stripeSyncWarning = 'STRIPE_SUBSCRIPTION_NOT_FOUND';
          console.warn(
            '[update-auto-renew] Stripe subscription not found; applying DB-only auto-renew update:',
            sub.stripe_subscription_id
          );
        } else {
          const cannotUpdateCanceledSubscription =
            /cannot update a canceled subscription/i.test(stripeMessage) ||
            /canceled subscription/i.test(stripeMessage);

          if (cannotUpdateCanceledSubscription) {
            return new Response(
              JSON.stringify({
                success: false,
                error:
                  'This subscription period has already ended. Please use Re-subscribe to restore Kids Club+.',
                code: 'SUBSCRIPTION_ALREADY_ENDED',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              }
            );
          }

        console.error('[update-auto-renew] Stripe update failed:', stripeError);
        return new Response(
          JSON.stringify({
            error: 'Failed to update Stripe subscription',
            code: 'STRIPE_UPDATE_FAILED',
            details: stripeError.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
        }
      }
    }

    // Update database
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        auto_renew_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('[update-auto-renew] DB update failed:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', code: 'DB_UPDATE_FAILED' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const message = auto_renew_enabled
      ? 'Auto-renew enabled. Your subscription will continue automatically.'
      : 'Auto-renew disabled. Your subscription will end after the current period unless you re-enable it.';

    return new Response(
      JSON.stringify({
        success: true,
        auto_renew_enabled,
        message,
        warning: stripeSyncWarning,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('[update-auto-renew] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
