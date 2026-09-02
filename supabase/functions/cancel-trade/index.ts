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
  // Use the concrete (permissive) service-role client type so this schema-drift fallback
  // type-checks cleanly under `deno check` (BP-25). `ReturnType<typeof createClient>` alone
  // resolves to a `never` schema that makes the .from(...) builders below fail to type-check.
  supabaseClient: ReturnType<typeof createClient<any, 'public', any>>,
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

// DEV-TASK-85 (QA Task 18 item 3 — audit metadata): the ACTUAL SP released on
// cancel is performed by the fn_release_sp_on_cancel trigger, which releases the
// trade's `sp_amount` whenever the trade had SP reserved (sp_amount > 0 AND
// sp_reserved_at set, and not already released). cancel_trade_v2's returned
// sp_refunded derives from trades.sp_debit_ledger_entry_id, which the current
// reserve flow (fn_reserve_sp_on_offer) never populates — so it returns 0 even
// when SP was genuinely refunded (observed on the Z05 whole-bundle approve: an
// 11-SP trade logged sp_refunded: 0 on its cancel_request_approved trade event
// while 11 SP was actually released to the buyer's wallet). Compute the true
// per-trade refunded amount for event metadata. Actual release is unchanged.
function actualSpRefunded(trade: Record<string, unknown>, rpcSpRefunded: number | undefined): number {
  const spAmount = Number(trade.sp_amount) || 0;
  if (spAmount > 0 && trade.sp_reserved_at != null && trade.sp_released_at == null) {
    return spAmount;
  }
  return rpcSpRefunded && rpcSpRefunded > 0 ? rpcSpRefunded : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEV-TASK-83 (Z05): cancel ONE trade's money state. Extracted from the original
// inline handler so a whole-bundle cancel-request approval can cancel every
// sibling BEFORE the request is marked approved. Idempotency is per-trade, so
// looping is safe: Stripe refund key `refund_<tradeId>` (BP-65), the
// `trades.stripe_refund_id` guard, `cancel_trade_v2`'s SP refund
// (sp_refund_<tradeId> idempotency) + the `fn_release_sp_on_cancel` trigger
// (`sp_released_at` re-entry guard).
// ─────────────────────────────────────────────────────────────────────────────
type CancelOneTradeContext = {
  supabaseClient: ReturnType<typeof createClient<any, 'public', any>>;
  reason: string;
  issueRefund: boolean;
  actorUserId: string;
};

async function cancelOneTrade(
  ctx: CancelOneTradeContext,
  trade: Record<string, unknown>
): Promise<{ success: true; data: any } | { success: false; error: string }> {
  const { supabaseClient, reason, issueRefund, actorUserId } = ctx;
  const tradeId = typeof trade.id === 'string' ? trade.id : String(trade.id);
  const status = typeof trade.status === 'string' ? trade.status : '';
  const stripePaymentIntentId =
    typeof trade.stripe_payment_intent_id === 'string' ? trade.stripe_payment_intent_id : null;

  // TAX-STATUS-LIFECYCLE (2026-07-23): Cancel the Stripe PaymentIntent for pending offers
  // with an authorization hold. Previously, only in_progress trades had their PI refunded.
  // Now pending trades must explicitly cancel their authorization hold so the buyer's card
  // is not left with a lingering hold when they actively cancel.
  if (status === 'pending' && stripePaymentIntentId) {
    console.log('[cancel-trade] Cancelling PI for pending trade:', tradeId, 'PI:', stripePaymentIntentId);
    try {
      const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
      if (['requires_capture', 'requires_confirmation', 'requires_action', 'requires_payment_method'].includes(pi.status)) {
        await stripe.paymentIntents.cancel(stripePaymentIntentId);
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

  // 3. Handle Stripe refund if trade was paid and refund requested.
  // TAX-STATUS-LIFECYCLE (2026-07-23): In the current tax flow, an in_progress
  // trade's PaymentIntent is still an UNCAPTURED authorization hold (capture happens
  // only at buyer completion). Stripe does NOT allow refunds on uncaptured PIs — they
  // must be CANCELLED. Previously this branch unconditionally called refunds.create(),
  // which failed on uncaptured PIs and left the Stripe transaction stuck as
  // "uncaptured" even though the trade was cancelled (TC-R05 / TC-O3-C07).
  if (issueRefund && status === 'in_progress' && stripePaymentIntentId) {
    console.log('[cancel-trade] Checking existing refund for trade:', tradeId, 'stripe_refund_id:', trade.stripe_refund_id);

    // Idempotency: don't create a new refund if one already exists
    if (!trade.stripe_refund_id) {
      console.log('[cancel-trade] Issuing Stripe refund/cancel for PI:', stripePaymentIntentId);
      try {
        const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

        if (pi.status === 'requires_capture' || pi.status === 'processing') {
          // Uncaptured authorization hold — cancel it (can't be refunded).
          const cancelled = await stripe.paymentIntents.cancel(stripePaymentIntentId, {
            cancellation_reason: 'requested_by_customer',
          });
          console.log('[cancel-trade] PI cancelled (uncaptured) for trade:', tradeId, 'PI:', cancelled.id);
          // Store id (service role) to prevent duplicate refund/cancel on retry
          await supabaseClient.from('trades').update({ stripe_refund_id: `cancelled_${cancelled.id}` }).eq('id', tradeId);
        } else if (pi.status === 'succeeded') {
          // Captured payment — issue a refund
          // DEV-TASK-6 (2026-08-27): idempotency key (options arg, BP-65) so a
          // timeout-retry of the same cancel can never issue a duplicate Stripe
          // refund. Close the check-then-act gap: if the charge was ALREADY
          // refunded (refund made but DB update never landed on a prior attempt),
          // reconcile the existing refund id from Stripe instead of silently
          // dropping it — otherwise trades.stripe_refund_id stays null and the
          // reconciliation/tax-reversal gap persists.
          let refundId: string;
          try {
            const refund = await stripe.refunds.create(
              {
                payment_intent: stripePaymentIntentId,
                reason: 'requested_by_customer',
                metadata: { supabase_trade_id: tradeId },
              },
              { idempotencyKey: `refund_${tradeId}` },
            );
            refundId = refund.id;
          } catch (refundErr: unknown) {
            const err = refundErr as { code?: string; message?: string };
            const alreadyRefunded =
              err?.code === 'charge_already_refunded' ||
              /already been refunded/i.test(err?.message ?? '');
            if (!alreadyRefunded) throw refundErr;
            const existing = await stripe.refunds.list({
              payment_intent: stripePaymentIntentId,
              limit: 5,
            });
            const prior = existing?.data?.[0];
            if (!prior?.id) throw refundErr;
            refundId = prior.id;
            console.log(
              `[cancel-trade] Charge already refunded — reconciled existing refund ${refundId} for trade ${tradeId}`,
            );
          }
          console.log('[cancel-trade] Stripe refund issued:', refundId);
          // Store refund id (service role) to prevent duplicate refunds
          await supabaseClient.from('trades').update({ stripe_refund_id: refundId }).eq('id', tradeId);
        } else {
          // canceled / requires_payment_method / etc — nothing to refund or cancel
          console.log('[cancel-trade] PI status is', pi.status, '- no refund/cancel needed for trade:', tradeId);
        }
      } catch (stripeError: unknown) {
        console.error('[cancel-trade] Stripe refund/cancel failed:', stripeError);
        // We continue to cancel the trade in DB even if Stripe fails (might be already refunded)
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
    p_user_id: actorUserId,
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
        actorUserId,
        reason || 'User requested cancellation'
      );

      if (!fallback.success) {
        console.error('[cancel-trade] ✗ Fallback failed:', fallback.error);
        return { success: false, error: fallback.error || 'Failed to cancel trade' };
      }

      console.log('[cancel-trade] ✓ Fallback succeeded');
      return { success: true, data: fallback };
    }

    console.error('[cancel-trade] ✗ RPC error not matched for fallback');
    return { success: false, error: errorText };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true, data };
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

    const { tradeId, reason, issue_refund = true, cancel_request_id } = await req.json();

    if (!tradeId) {
      return new Response(JSON.stringify({ error: 'Missing tradeId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FIX-CANCEL (2026-09-01): when the seller approves a BUYER's cancellation
    // request, the trade is cancelled via this same path but the seller is not
    // at fault — so the seller-cancellation consequence (TFV2-023) must be
    // skipped and the cancel_request row marked approved afterwards.
    const isCancelRequestApproval = Boolean(cancel_request_id);

    // 2. Load trade to check status and get Stripe info
    const { data: trade, error: tradeError } = await supabaseClient
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      throw new Error('Trade not found');
    }

    // DEV-TASK-83 (Z05): Cancel the tapped trade's money state via the shared
    // per-trade helper (Stripe hold cancel/refund → tax void → cancel_trade_v2).
    const actorUserId = user.id;
    const primaryResult = await cancelOneTrade(
      { supabaseClient, reason: reason || '', issueRefund: Boolean(issue_refund), actorUserId },
      trade as Record<string, unknown>
    );
    if (!primaryResult.success) {
      return new Response(JSON.stringify({ error: primaryResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = primaryResult.data;

    // FIX-CANCEL / DEV-TASK-83 (Z05): when the seller approves a WHOLE-BUNDLE
    // cancellation request, cancel EVERY sibling that is part of the same pending
    // request too. Previously only the tapped trade was cancelled while
    // fn_respond_cancel_request cascade-marked siblings 'approved' — leaving their
    // Stripe holds live (`requires_capture`) and their reserved SP unreleased.
    const cancelledTradeIds: string[] = [tradeId];
    // DEV-TASK-85 (item 3): record the ACTUAL refunded amount per trade (the
    // fn_release_sp_on_cancel trigger releases sp_amount) — not cancel_trade_v2's
    // return, which is 0 when sp_debit_ledger_entry_id is unset (current flow).
    const spRefundedByTrade: Record<string, number> = {
      [tradeId]: actualSpRefunded(trade as Record<string, unknown>, data.sp_refunded),
    };
    const bundleSiblingFailures: string[] = [];

    if (isCancelRequestApproval && trade.bundle_id) {
      const { data: siblings, error: siblingsError } = await supabaseClient
        .from('trades')
        .select('*')
        .eq('bundle_id', trade.bundle_id)
        .eq('cancel_request_status', 'requested')
        .eq('status', 'in_progress')
        .neq('id', tradeId);

      if (siblingsError) {
        console.error('[cancel-trade] bundle sibling query error:', siblingsError);
      } else if (Array.isArray(siblings) && siblings.length > 0) {
        console.log(
          `[cancel-trade] Approving bundle cancel — cancelling ${siblings.length} sibling trade(s) for bundle ${trade.bundle_id}`
        );
        for (const sibling of siblings) {
          const sibResult = await cancelOneTrade(
            { supabaseClient, reason: reason || '', issueRefund: Boolean(issue_refund), actorUserId },
            sibling as Record<string, unknown>
          );
          if (sibResult.success) {
            const sibId = String(sibling.id);
            cancelledTradeIds.push(sibId);
            spRefundedByTrade[sibId] = actualSpRefunded(sibling as Record<string, unknown>, sibResult.data.sp_refunded);
          } else {
            bundleSiblingFailures.push(`${sibling.id}: ${sibResult.error}`);
          }
        }
      }
    }

    // Fail closed: never mark the request approved while any sibling still holds
    // money. The request stays 'requested' so the buyer can escalate / retry, and
    // no trade is falsely reported as approved-cancelled.
    if (bundleSiblingFailures.length > 0) {
      console.error('[cancel-trade] bundle sibling cancel failures — NOT marking approved:', bundleSiblingFailures);
      return new Response(
        JSON.stringify({
          error:
            `We couldn't cancel every item in this bundle. ${bundleSiblingFailures.length} item(s) failed: ` +
            bundleSiblingFailures.join('; '),
          cancelledTrades: cancelledTradeIds,
          failures: bundleSiblingFailures,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX-CANCEL (2026-09-01) / DEV-TASK-83 (Z05): mark the buyer's cancellation
    // request approved AFTER the tapped trade AND all bundle siblings are cancelled
    // (idempotent — NOT_PENDING if already handled). The RPC cascade marks every
    // requested sibling 'approved'; because each one was just cancelled above, the
    // approved marker now reflects real state (no live holds). Non-fatal: the
    // trades are already cancelled.
    if (isCancelRequestApproval) {
      try {
        await supabaseClient.rpc('fn_respond_cancel_request', {
          p_trade_id: tradeId,
          p_user_id: user.id,
          p_action: 'approve',
        });
      } catch (approveErr: unknown) {
        const approveMsg = approveErr instanceof Error ? approveErr.message : 'Unknown error';
        console.error('[cancel-trade] mark cancel request approved (non-fatal):', approveMsg);
      }
    }

    // TFV2-019: Log cancellation event
    // TFV2-023: If seller cancels an in_progress trade, apply progressive consequence.
    // Skipped for cancel-request approvals (seller approving the buyer's request is
    // not a seller-initiated cancellation).
    let consequenceLevel: number | null = null;

    const { sellerId } = getTradePartyIds(trade as Record<string, unknown>);

    if (sellerId && user.id === sellerId && trade.status === 'in_progress' && !isCancelRequestApproval) {
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
        sp_refunded: actualSpRefunded(trade as Record<string, unknown>, data.sp_refunded),
        level: consequenceLevel,
        seller_cancellation_count: consequenceLevel,
      });
    } else {
      // DEV-TASK-83 (Z05): log one cancellation event per cancelled trade (tapped
      // trade + every bundle sibling), each carrying its own SP refund amount.
      for (const cancelledId of cancelledTradeIds) {
        await logTradeEvent(
          supabaseClient,
          cancelledId,
          isCancelRequestApproval ? 'cancel_request_approved' : 'offer_cancelled',
          user.id,
          {
            reason: reason || 'User requested cancellation',
            sp_refunded: spRefundedByTrade[cancelledId],
            ...(isCancelRequestApproval ? { cancel_request_id } : {}),
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tradeId: data.trade_id,
        cancelledTrades: cancelledTradeIds,
        sp_refunded: data.sp_refunded,
        consequence_level: consequenceLevel,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[cancel-trade] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel trade';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
