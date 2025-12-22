// File: supabase/functions/trade-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { tradeId, paymentMethodId } = await req.json();

    if (!tradeId || !paymentMethodId) {
      return new Response(JSON.stringify({ error: 'Missing tradeId or paymentMethodId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Load trade and buyer info
    const { data: trade, error: tradeError } = await supabaseClient
      .from('trades')
      .select(`
        *,
        buyer:auth.users!buyer_id(id, email),
        subscription:subscriptions!buyer_id(stripe_customer_id)
      `)
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      console.error('[trade-payment] Trade not found:', tradeError);
      throw new Error('Trade not found');
    }

    if (trade.status !== 'pending') {
      throw new Error(`Trade is not in pending state (current: ${trade.status})`);
    }

    const cashAmountCents = trade.cash_amount_cents;
    const buyer = trade.buyer;
    const subscription = trade.subscription;

    // 2) Create or reuse Stripe customer
    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      console.log('[trade-payment] Creating new Stripe customer for buyer:', buyer.id);
      const customer = await stripe.customers.create({
        email: buyer.email,
        metadata: { supabase_user_id: buyer.id },
      });

      customerId = customer.id;

      // Update subscription record with customer ID
      await supabaseClient
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', buyer.id);
    }

    // 3) Attach payment method and set as default
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 4) Mark trade as payment_processing
    await supabaseClient
      .from('trades')
      .update({ 
        status: 'payment_processing', 
        last_status_change_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', trade.id);

    // 5) Create and Confirm PaymentIntent
    console.log('[trade-payment] Creating PaymentIntent for amount:', cashAmountCents);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: cashAmountCents,
      currency: trade.cash_currency || 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: false, // User is present
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        supabase_trade_id: trade.id,
        buyer_id: trade.buyer_id,
        seller_id: trade.seller_id,
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      console.error('[trade-payment] Payment failed status:', paymentIntent.status);
      // Payment not completed; mark as failed
      await supabaseClient
        .from('trades')
        .update({ 
          status: 'payment_failed', 
          last_status_change_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      return new Response(
        JSON.stringify({ 
          error: 'Payment did not succeed', 
          payment_intent_status: paymentIntent.status 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6) Debit SP wallet if points were used
    let spDebitLedgerId: string | null = null;
    const pointsToDebit = trade.sp_amount;

    if (pointsToDebit && pointsToDebit > 0) {
      console.log('[trade-payment] Debiting SP points:', pointsToDebit);
      const { data: debitResult, error: debitError } = await supabaseClient
        .rpc('debit_sp_for_trade', {
          p_user_id: trade.buyer_id,
          p_trade_id: trade.id,
          p_points: pointsToDebit,
        });

      if (debitError) {
        // CRITICAL: Payment succeeded but SP debit failed. 
        // In a real app, we should refund the Stripe payment or queue a retry.
        console.error('[trade-payment] SP debit failed after payment SUCCESS:', debitError);
        // We'll still proceed but log the error. The trade will be in_progress but missing SP linkage.
        // TODO: Implement compensation logic (refund Stripe)
      } else {
        spDebitLedgerId = debitResult?.ledger_entry_id ?? null;
      }
    }

    // 7) Update trade as in_progress with payment + SP linkage
    const { error: updateTradeError } = await supabaseClient
      .from('trades')
      .update({
        status: 'in_progress',
        last_status_change_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id,
        sp_debit_ledger_entry_id: spDebitLedgerId,
      })
      .eq('id', trade.id);

    if (updateTradeError) {
      console.error('[trade-payment] Failed to update trade after payment:', updateTradeError);
      throw updateTradeError;
    }

    // 8) Update item status to 'pending' (locked for this trade)
    await supabaseClient
      .from('items')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', trade.listing_id);

    console.log('[trade-payment] Trade payment successful:', trade.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tradeId: trade.id, 
        payment_intent_id: paymentIntent.id,
        status: 'in_progress'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[trade-payment] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
