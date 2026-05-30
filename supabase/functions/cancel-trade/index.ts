// File: supabase/functions/cancel-trade/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';
import { logTradeEvent } from '../_shared/trade-events.ts';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { tradeId, reason, issue_refund = true } = await req.json();

    if (!tradeId) {
      return new Response(JSON.stringify({ error: 'Missing tradeId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load trade to check status and get Stripe info
    const { data: trade, error: tradeError } = await supabaseClient
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      throw new Error('Trade not found');
    }

    // 3. Handle Stripe refund if trade was paid and refund requested
    if (issue_refund && trade.status === 'in_progress' && trade.stripe_payment_intent_id) {
      console.log('[cancel-trade] Checking existing refund for trade:', tradeId, 'stripe_refund_id:', trade.stripe_refund_id);

      // Idempotency: don't create a new refund if one already exists
      if (!trade.stripe_refund_id) {
        console.log('[cancel-trade] Issuing Stripe refund for PI:', trade.stripe_payment_intent_id);
        try {
          const refund = await stripe.refunds.create({
            payment_intent: trade.stripe_payment_intent_id,
            reason: 'requested_by_customer',
            metadata: { supabase_trade_id: tradeId },
          });

          // Store refund id (service role) to prevent duplicate refunds
          await supabaseClient.from('trades').update({ stripe_refund_id: refund.id }).eq('id', tradeId);
        } catch (stripeError: any) {
          console.error('[cancel-trade] Stripe refund failed:', stripeError);
          // We continue to cancel the trade in DB even if Stripe refund fails (might be already refunded)
        }
      } else {
        console.log('[cancel-trade] Refund already recorded, skipping Stripe refund creation.');
      }
    }

    // 4. Call the RPC to cancel the trade in DB and refund SP
    const { data, error: rpcError } = await supabaseClient.rpc('cancel_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id,
      p_reason: reason || 'User requested cancellation'
    });

    if (rpcError) {
      console.error('[cancel-trade] RPC error:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.success) {
      return new Response(JSON.stringify({ error: data.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TFV2-019: Log cancellation event
    // TFV2-023: If seller cancels an in_progress trade, apply progressive consequence.
    let consequenceLevel: number | null = null;

    if (user.id === trade.seller_id && trade.status === 'in_progress') {
      try {
        const { data: consequence, error: conseqError } = await supabaseClient.rpc(
          'fn_handle_seller_cancellation',
          { p_seller_id: trade.seller_id, p_trade_id: tradeId }
        );
        if (!conseqError && consequence) {
          consequenceLevel = (consequence as any).level ?? null;
        } else if (conseqError) {
          console.error('[cancel-trade] fn_handle_seller_cancellation error:', conseqError);
        }
      } catch (e) {
        console.error('[cancel-trade] fn_handle_seller_cancellation unexpected error:', e);
        // Non-blocking: cancellation already succeeded — don't fail over consequence logic.
      }

      // Log seller-specific event with consequence metadata.
      await logTradeEvent(supabaseClient, tradeId, 'seller_cancelled', user.id, {
        reason: reason || 'Seller requested cancellation',
        sp_refunded: data.sp_refunded,
        level: consequenceLevel,
        seller_cancellation_count: consequenceLevel,
      });
    } else {
      await logTradeEvent(supabaseClient, tradeId, 'offer_cancelled', user.id, {
        reason: reason || 'User requested cancellation',
        sp_refunded: data.sp_refunded,
      });
    }

    return new Response(JSON.stringify({ success: true, tradeId: data.trade_id, sp_refunded: data.sp_refunded, consequence_level: consequenceLevel }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[cancel-trade] error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
