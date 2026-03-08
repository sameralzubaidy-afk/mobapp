// File: supabase/functions/create-payment-setup-intent/index.ts
// MODULE-11 SUB-015: Create Stripe SetupIntent for payment method collection

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const STRIPE_PUBLISHABLE_KEY = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';

interface SetupIntentRequest {
  user_id: string;
  for_renewal?: boolean;
}

interface SetupIntentResponse {
  client_secret: string;
  publishable_key: string;
  ephemeral_key_secret: string;
  customer_id: string;
}

type SubscriptionCustomerRow = {
  stripe_customer_id: string | null;
};

type ProfileRow = {
  email: string | null;
  name: string | null;
};

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
      console.error('[create-payment-setup-intent] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: SetupIntentRequest = await req.json();
    const userId = body.user_id || user.id;

    // Verify user matches token
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Read Stripe customer from canonical subscription table first.
    const { data: subRow, error: subFetchError } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle<SubscriptionCustomerRow>();

    if (subFetchError) {
      console.error('[create-payment-setup-intent] Subscription fetch error:', subFetchError);
      return new Response(JSON.stringify({ error: 'Failed to read subscription record' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Profile is only used for display metadata when creating a new Stripe customer.
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, name')
      .eq('user_id', userId)
      .maybeSingle<ProfileRow>();

    let customerId = subRow?.stripe_customer_id || null;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email || '',
        name: profile?.name || '',
        metadata: {
          user_id: userId,
          supabase_user_id: userId,
        },
      });

      customerId = customer.id;

      // Persist customer ID to subscription table.
      const { error: updateError } = await supabaseClient
        .from('user_subscriptions')
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (updateError) {
        console.error('[create-payment-setup-intent] Failed to save customer ID to user_subscriptions:', updateError);
        // Continue anyway - customer exists in Stripe and setup intent can still proceed.
      }
    }

    // Create ephemeral key for mobile SDK
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'], // Card + Apple Pay + Google Pay work automatically in Payment Sheet
      usage: 'off_session', // For future charges without customer present
      metadata: {
        user_id: userId,
        for_renewal: body.for_renewal ? 'true' : 'false',
      },
    });

    const response: SetupIntentResponse = {
      client_secret: setupIntent.client_secret!,
      publishable_key: STRIPE_PUBLISHABLE_KEY,
      ephemeral_key_secret: ephemeralKey.secret,
      customer_id: customerId,
    };

    console.log('[create-payment-setup-intent] Success:', {
      user_id: userId,
      customer_id: customerId,
      setup_intent_id: setupIntent.id,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[create-payment-setup-intent] Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create setup intent',
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
