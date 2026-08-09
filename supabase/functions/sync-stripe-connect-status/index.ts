// File: supabase/functions/sync-stripe-connect-status/index.ts
// Purpose: Fallback sync for Stripe Connect account status -> seller_payout_methods flags.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';
import {
  ownershipDeniedResponse,
  verifyStripeAccountOwnership,
} from '../_shared/verify-stripe-ownership.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

type SyncStripeConnectStatusRequest = {
  methodId?: string;
};

type SyncedMethod = {
  methodId: string;
  stripeAccountId: string;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  stripeOnboardingComplete: boolean;
  stripePayoutsEnabled: boolean;
  stripeChargesEnabled: boolean;
  isVerified: boolean;
};

type SyncStripeConnectStatusResponse = {
  success: boolean;
  syncedMethods?: SyncedMethod[];
  error?: string;
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ success: false, error: 'STRIPE_SECRET_KEY is not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase env not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return new Response(JSON.stringify({ success: false, error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: `Unauthorized: ${userErr?.message || 'No user'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: SyncStripeConnectStatusRequest = {};
    try {
      body = (await req.json()) as SyncStripeConnectStatusRequest;
    } catch {
      // Allow empty body
      body = {};
    }

    let query = supabase
      .from('seller_payout_methods')
      .select('id, user_id, method_type, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled, stripe_charges_enabled, is_verified')
      .eq('user_id', user.id)
      .eq('method_type', 'stripe_connect')
      .not('stripe_account_id', 'is', null);

    if (body.methodId) {
      query = query.eq('id', body.methodId);
    }

    const { data: methods, error: methodsErr } = await query;
    if (methodsErr) {
      return new Response(JSON.stringify({ success: false, error: `Failed to load payout methods: ${methodsErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!methods || methods.length === 0) {
      const resp: SyncStripeConnectStatusResponse = { success: true, syncedMethods: [] };
      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const syncedMethods: SyncedMethod[] = [];

    for (const method of methods) {
      const stripeAccountId = method.stripe_account_id as string;

      // PROD-005: Defense-in-depth ownership check (redundant with the
      // user_id-scoped query above, but produces an explicit audit log
      // and 403 on any future query regression).
      const ownership = await verifyStripeAccountOwnership(
        supabase,
        user.id,
        stripeAccountId
      );
      if (!ownership.owned) {
        console.warn('[sync-stripe-connect-status] Ownership denied:', {
          userId: user.id,
          methodId: method.id,
          reason: ownership.error,
        });
        return ownershipDeniedResponse(
          ownership.error || 'Stripe account ownership check failed',
          corsHeaders
        );
      }

      const account = await stripe.accounts.retrieve(stripeAccountId);
      const detailsSubmitted = !!account.details_submitted;
      const payoutsEnabled = !!account.payouts_enabled;
      const chargesEnabled = !!account.charges_enabled;

      const nextStripeOnboardingComplete = detailsSubmitted;
      const nextStripePayoutsEnabled = payoutsEnabled;
      const nextStripeChargesEnabled = chargesEnabled;
      const nextIsVerified = payoutsEnabled;

      // Update only when needed
      const needsUpdate =
        method.stripe_onboarding_complete !== nextStripeOnboardingComplete ||
        method.stripe_payouts_enabled !== nextStripePayoutsEnabled ||
        method.stripe_charges_enabled !== nextStripeChargesEnabled ||
        method.is_verified !== nextIsVerified;

      if (needsUpdate) {
        const { error: updateErr } = await supabase
          .from('seller_payout_methods')
          .update({
            stripe_onboarding_complete: nextStripeOnboardingComplete,
            stripe_payouts_enabled: nextStripePayoutsEnabled,
            stripe_charges_enabled: nextStripeChargesEnabled,
            is_verified: nextIsVerified,
            updated_at: new Date().toISOString(),
          })
          .eq('id', method.id)
          .eq('user_id', user.id);

        if (updateErr) {
          return new Response(JSON.stringify({ success: false, error: `Failed to update payout method: ${updateErr.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      syncedMethods.push({
        methodId: method.id,
        stripeAccountId,
        detailsSubmitted,
        payoutsEnabled,
        chargesEnabled,
        stripeOnboardingComplete: nextStripeOnboardingComplete,
        stripePayoutsEnabled: nextStripePayoutsEnabled,
        stripeChargesEnabled: nextStripeChargesEnabled,
        isVerified: nextIsVerified,
      });
    }

    const response: SyncStripeConnectStatusResponse = {
      success: true,
      syncedMethods,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[sync-stripe-connect-status] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
