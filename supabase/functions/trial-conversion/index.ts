// File: supabase/functions/trial-conversion/index.ts
// MODULE-11 TASK SUB-005: Trial Conversion & Downgrade Rules
// Edge Function to process expired trials and convert or downgrade them

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ExpiredTrial {
  v_id: string;
  v_user_id: string;
  v_status: string;
  v_stripe_subscription_id: string | null;
  v_trial_end_date: string;
  v_stripe_customer_id: string | null;
  v_has_payment_method: boolean;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[trial-conversion] Starting trial conversion process...');

    // Get all expired trials
    const { data: expiredTrials, error: fetchError } = await supabase
      .rpc('check_expired_trials');

    if (fetchError) {
      console.error('[trial-conversion] Error fetching expired trials:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FETCH_ERROR',
          message: fetchError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      console.log('[trial-conversion] No expired trials found');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          converted: 0,
          downgraded: 0,
          message: 'No expired trials to process',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[trial-conversion] Found ${expiredTrials.length} expired trials to process`);

    let converted = 0;
    let downgraded = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    // Process each expired trial
    for (const trial of expiredTrials as ExpiredTrial[]) {
      try {
        console.log(`[trial-conversion] Processing user ${trial.v_user_id}...`);

        // Check if user has active Stripe subscription
        let hasActiveStripeSubscription = false;

        if (trial.v_stripe_subscription_id) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(
              trial.v_stripe_subscription_id
            );

            hasActiveStripeSubscription = 
              stripeSub.status === 'active' && 
              stripeSub.default_payment_method !== null;

            console.log(
              `[trial-conversion] Stripe subscription status: ${stripeSub.status}, has payment: ${hasActiveStripeSubscription}`
            );
          } catch (stripeError) {
            console.error(
              `[trial-conversion] Error fetching Stripe subscription for user ${trial.v_user_id}:`,
              stripeError
            );
            // Continue with has_payment_method flag from DB
          }
        }

        // Decision: Convert to active or downgrade to grace
        if (hasActiveStripeSubscription || trial.v_has_payment_method) {
          // User has payment method → Convert to active
          console.log(`[trial-conversion] Converting user ${trial.v_user_id} to active`);

          const { data: convertResult, error: convertError } = await supabase
            .rpc('convert_trial_to_active', {
              p_user_id: trial.v_user_id,
            });

          if (convertError) {
            console.error(
              `[trial-conversion] Error converting trial for user ${trial.v_user_id}:`,
              convertError
            );
            errors.push({
              user_id: trial.v_user_id,
              error: convertError.message,
            });
          } else {
            console.log(`[trial-conversion] Successfully converted user ${trial.v_user_id}:`, convertResult);
            converted++;
          }
        } else {
          // User has no payment method → Downgrade to grace period
          console.log(`[trial-conversion] Downgrading user ${trial.v_user_id} to grace period`);

          const { data: downgradeResult, error: downgradeError } = await supabase
            .rpc('downgrade_trial_to_grace', {
              p_user_id: trial.v_user_id,
            });

          if (downgradeError) {
            console.error(
              `[trial-conversion] Error downgrading trial for user ${trial.v_user_id}:`,
              downgradeError
            );
            errors.push({
              user_id: trial.v_user_id,
              error: downgradeError.message,
            });
          } else {
            console.log(`[trial-conversion] Successfully downgraded user ${trial.v_user_id}:`, downgradeResult);
            downgraded++;

            // TODO: Send notification to user about grace period
            // TODO: Call MODULE-09 SP wallet freeze handler if needed
          }
        }
      } catch (error) {
        console.error(`[trial-conversion] Unexpected error processing user ${trial.v_user_id}:`, error);
        errors.push({
          user_id: trial.v_user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `[trial-conversion] Completed: ${expiredTrials.length} processed, ${converted} converted, ${downgraded} downgraded, ${errors.length} errors`
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: expiredTrials.length,
        converted,
        downgraded,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[trial-conversion] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'FATAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
