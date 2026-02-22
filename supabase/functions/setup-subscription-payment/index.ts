// File: supabase/functions/setup-subscription-payment/index.ts
// MODULE-11 TASK SUB-006: Setup Payment Sheet for Subscription
// Creates SetupIntent for collecting payment method

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripePublishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[setup-subscription-payment] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[setup-subscription-payment] Setting up for user: ${user.id}`);

    const adminTrialDays = await getAdminConfigNumber(supabase, 'trial_period_days');
    const normalizedTrialDays = Math.max(Math.round(adminTrialDays), 0);

    // 3. Get or create Stripe Customer
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, status, trial_end_date, stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = subscription?.stripe_customer_id;
    const now = new Date();
    const defaultTrialEndIso = new Date(now.getTime() + normalizedTrialDays * 24 * 60 * 60 * 1000).toISOString();

    if (!customerId) {
      console.log('[setup-subscription-payment] Creating Stripe customer...');
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Ensure subscription record exists and has customer ID
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({ 
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'trial',
          trial_end_date: defaultTrialEndIso,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('[setup-subscription-payment] Subscription upsert error:', upsertError);
      }
    }

    // Non-trial users should receive admin-configured free period before first charge
    // when they start Kids Club+ from profile.
    if (subscription && !subscription.stripe_subscription_id) {
      const trialEndDate = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
      const needsTrialWindow =
        subscription.status !== 'trial' ||
        !trialEndDate ||
        Number.isNaN(trialEndDate.getTime()) ||
        trialEndDate <= now;

      if (needsTrialWindow) {
        const { error: trialUpdateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'trial',
            trial_end_date: defaultTrialEndIso,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        if (trialUpdateError) {
          console.error('[setup-subscription-payment] Failed to initialize 30-day trial window:', trialUpdateError);
        }
      }
    }

    // 4. Create ephemeral key for customer
    console.log('[setup-subscription-payment] Creating ephemeral key...');
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    // 5. Create SetupIntent to collect payment method
    console.log('[setup-subscription-payment] Creating setup intent...');
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        supabase_user_id: user.id,
        purpose: 'subscription_payment',
      },
    });

    console.log('[setup-subscription-payment] Setup complete');

    return new Response(
      JSON.stringify({
        setupIntent: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey: stripePublishableKey,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[setup-subscription-payment] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
