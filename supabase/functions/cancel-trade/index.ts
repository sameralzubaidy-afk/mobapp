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

function getTradePartyIds(trade: Record<string, unknown>): {
  buyerId: string | null;
  sellerId: string | null;
} {
  const buyerId = typeof trade.buyer_id === 'string'
    ? trade.buyer_id
    : typeof trade.buyer_user_id === 'string'
      ? trade.buyer_user_id
      : null;

  const sellerId = typeof trade.seller_id === 'string'
    ? trade.seller_id
    : typeof trade.seller_user_id === 'string'
      ? trade.seller_user_id
      : null;

  return { buyerId, sellerId };
}

function isMissingSellerColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('column "seller_id" does not exist') ||
    normalized.includes('record "v_trade" has no field "seller_id"') ||
    normalized.includes('column trades.seller_id does not exist')
  );
}

async function fallbackCancelTrade(
  supabaseClient: ReturnType<typeof createClient>,
  trade: Record<string, unknown>,
  tradeId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string; trade_id?: string; sp_refunded?: number; sp_refund_error?: string | null }> {
  const { buyerId, sellerId } = getTradePartyIds(trade);

  if (!buyerId || !sellerId) {
    return {
      success: false,
      error: 'Trade schema mismatch: buyer/seller columns are missing',
    };
  }

  if (userId !== buyerId && userId !== sellerId) {
    return {
      success: false,
      error: 'You do not have permission to cancel this trade',
    };
  }

  const status = typeof trade.status === 'string' ? trade.status : '';
  if (!['pending', 'payment_failed', 'in_progress'].includes(status)) {
    return {
      success: false,
      error: `This trade cannot be cancelled. Current status: ${status}`,
    };
  }

  const nowIso = new Date().toISOString();
  let spRefunded = 0;
  let spRefundError: string | null = null;

  const spDebitLedgerEntryId = typeof trade.sp_debit_ledger_entry_id === 'string'
    ? trade.sp_debit_ledger_entry_id
    : null;

  if (spDebitLedgerEntryId) {
    const { data: debitLedger, error: ledgerError } = await supabaseClient
      .from('sp_ledger')
      .select('amount')
      .eq('id', spDebitLedgerEntryId)
      .maybeSingle();

    if (!ledgerError && debitLedger?.amount != null) {
      spRefunded = Math.max(0, Number(debitLedger.amount) || 0);
    }
  } else if (typeof trade.sp_amount === 'number' && trade.sp_amount > 0) {
    spRefunded = trade.sp_amount;
  }

  // SP release is handled by trigger fn_release_sp_on_cancel which fires on
  // AFTER UPDATE OF status → 'cancelled'. It releases reserved SP back to
  // available_balance AND creates the earn_refund ledger entry.
  // Do NOT call credit_sp_for_cancelled_trade here — it would double-credit.

  const updatePayload: Record<string, unknown> = {
    status: 'cancelled',
    updated_at: nowIso,
  };

  if ('cancellation_reason' in trade) {
    updatePayload.cancellation_reason = reason;
  }
  if ('cancelled_at' in trade) {
    updatePayload.cancelled_at = nowIso;
  }
  if ('last_status_change_at' in trade) {
    updatePayload.last_status_change_at = nowIso;
  }

  const { error: updateError } = await supabaseClient
    .from('trades')
    .update(updatePayload)
    .eq('id', tradeId);

  if (updateError) {
    return {
      success: false,
      error: updateError.message,
    };
  }

  return {
    success: true,
    trade_id: tradeId,
    sp_refunded: spRefunded,
    sp_refund_error: spRefundError,
  };
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseKey = supabaseAnonKey || supabaseServiceKey;
  const userClient = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch?.[1]?.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // TAX-STATUS-LIFECYCLE (2026-07-23): Cancel the Stripe PaymentIntent for pending offers
    // with an authorization hold. Previously, only in_progress trades had their PI refunded.
    // Now pending trades must explicitly cancel their authorization hold so the buyer's card
    // is not left with a lingering hold when they actively cancel.
    if (trade.status === 'pending' && trade.stripe_payment_intent_id) {
      console.log('[cancel-trade] Cancelling PI for pending trade:', tradeId, 'PI:', trade.stripe_payment_intent_id);
      try {
        const pi = await stripe.paymentIntents.retrieve(trade.stripe_payment_intent_id);
        if (['requires_capture', 'requires_confirmation', 'requires_action', 'requires_payment_method'].includes(pi.status)) {
          await stripe.paymentIntents.cancel(trade.stripe_payment_intent_id);
          console.log('[cancel-trade] PI cancelled successfully for pending trade:', tradeId);
        } else {
          console.log('[cancel-trade] PI status is', pi.status, '- no cancel needed for trade:', tradeId);
        }
      } catch (stripeError: unknown) {
        console.error('[cancel-trade] PI cancel failed for pending trade (non-fatal):', stripeError);
        // Non-fatal — the trade cancellation proceeds regardless. The authorization
        // will expire naturally within 7 days if we can't cancel it now.
      }
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
        } catch (stripeError: unknown) {
          console.error('[cancel-trade] Stripe refund failed:', stripeError);
          // We continue to cancel the trade in DB even if Stripe refund fails (might be already refunded)
        }
      } else {
        console.log('[cancel-trade] Refund already recorded, skipping Stripe refund creation.');
      }
    }

    // TAX-STATUS-LIFECYCLE (2026-07-23): Void the tax record before the RPC cancels the trade.
    // This must happen BEFORE cancel_trade_v2 so the tax_records lock is acquired first
    // (avoiding deadlock with the fn_release_sp_on_cancel trigger which locks sp_wallets).
    try {
      await supabaseClient.rpc('rpc_void_tax_for_trade', {
        p_trade_id: tradeId,
        p_reason: reason || 'trade_cancelled',
      });
    } catch (voidTaxErr: unknown) {
      const msg = voidTaxErr instanceof Error ? voidTaxErr.message : 'Unknown error';
      console.error('[cancel-trade] Tax void error (non-fatal):', msg);
      // Non-fatal — the trade cancellation proceeds regardless. Tax records for
      // zero-tax trades will get a noop, and capture_failed records still get voided.
    }

    // 4. Call the RPC to cancel the trade in DB and refund SP
    let { data, error: rpcError } = await supabaseClient.rpc('cancel_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id,
      p_reason: reason || 'User requested cancellation'
    });

    const rpcDataFailure =
      data != null &&
      typeof data === 'object' &&
      'success' in (data as Record<string, unknown>) &&
      (data as Record<string, unknown>).success === false;

    const rpcDataError =
      rpcDataFailure && typeof (data as Record<string, unknown>).error === 'string'
        ? (data as Record<string, unknown>).error as string
        : '';

    if (rpcError || rpcDataFailure) {
      // Enhanced logging to diagnose both transport-level and JSON-level RPC failures.
      console.error('[cancel-trade] RPC failure details:', {
        transport_message: rpcError?.message,
        transport_hint: rpcError?.hint,
        transport_details: rpcError?.details,
        transport_code: rpcError?.code,
        transport_full_error: rpcError ? JSON.stringify(rpcError) : null,
        json_error: rpcDataError,
        json_data: data,
      });

      // Check all possible error message locations.
      const errorText =
        rpcError?.message ||
        rpcError?.hint ||
        rpcError?.details ||
        rpcDataError ||
        (rpcError ? JSON.stringify(rpcError) : 'Unknown cancel_trade_v2 failure');

      if (isMissingSellerColumnError(errorText)) {
        console.warn('[cancel-trade] ✓ Detected schema drift, using fallback path');
        const fallback = await fallbackCancelTrade(
          supabaseClient,
          trade,
          tradeId,
          user.id,
          reason || 'User requested cancellation'
        );

        if (!fallback.success) {
          console.error('[cancel-trade] ✗ Fallback failed:', fallback.error);
          return new Response(JSON.stringify({ error: fallback.error || 'Failed to cancel trade' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('[cancel-trade] ✓ Fallback succeeded, returning success');
        data = fallback;
        rpcError = null;
      } else {
        console.error('[cancel-trade] ✗ RPC error not matched for fallback, returning error to client');
        return new Response(JSON.stringify({ error: errorText }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

    const { sellerId } = getTradePartyIds(trade as Record<string, unknown>);

    if (sellerId && user.id === sellerId && trade.status === 'in_progress') {
      try {
        const { data: consequence, error: conseqError } = await supabaseClient.rpc(
          'fn_handle_seller_cancellation',
          { p_seller_id: sellerId, p_trade_id: tradeId }
        );
        if (!conseqError && consequence) {
          const consequenceRecord = consequence as Record<string, unknown>;
          consequenceLevel = typeof consequenceRecord.level === 'number' ? consequenceRecord.level : null;
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
  } catch (error: unknown) {
    console.error('[cancel-trade] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel trade';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
