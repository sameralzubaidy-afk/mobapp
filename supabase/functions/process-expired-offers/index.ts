// File: supabase/functions/process-expired-offers/index.ts
// TAX-STATUS-LIFECYCLE (2026-07-23): Before calling the RPC to expire offers, cancel
// the Stripe PaymentIntent for each expired offer and void the tax record.
// The RPC handles the DB status change; we handle the Stripe + tax side.
//
// Flow:
//   1. Find trades eligible for expiry (pending, offer_expires_at <= now)
//   2. For each with a PI, retrieve + cancel it on Stripe
//   3. Void the tax record for each
//   4. Call rpc_process_expired_offers for status changes + notifications
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Notification {
  trade_id: string;
  event_type: string;
  recipient_user_id: string;
  extra_data?: Record<string, unknown>;
}

/** Send a batch of notifications to send-trade-notifications Edge Function */
async function sendNotifications(
  supabaseUrl: string,
  serviceRoleKey: string,
  notifications: Notification[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    try {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/send-trade-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(notification),
        },
      );

      if (!resp.ok) {
        console.warn(
          '[process-expired-offers] notification failed',
          notification.event_type,
          notification.trade_id,
          resp.status,
        );
        failed++;
      } else {
        sent++;
      }
    } catch (err) {
      console.warn(
        '[process-expired-offers] notification error',
        notification.event_type,
        notification.trade_id,
        err,
      );
      failed++;
    }
  }

  return { sent, failed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported',
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      success: false,
      error: {
        code: 'CONFIG_MISSING',
        message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      },
    });
  }

  const requestId = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const stripe = stripeKey.startsWith('sk_') ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBatchSize = Number(body?.batch_size);
    const batchSize =
      Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
        ? Math.min(Math.floor(requestedBatchSize), 500)
        : 100;

    // TAX-STATUS-LIFECYCLE: Find and process expired offers BEFORE the RPC runs
    // so we can cancel PIs and void tax before the RPC changes their status.
    const { data: expiredTrades, error: fetchErr } = await supabase
      .from('trades')
      .select('id, stripe_payment_intent_id, cash_amount_cents')
      .eq('status', 'pending')
      .not('offer_expires_at', 'is', null)
      .lte('offer_expires_at', new Date().toISOString())
      .limit(batchSize);

    if (fetchErr) {
      console.error('[process-expired-offers] Fetch error:', fetchErr);
    } else {
      const trades = (expiredTrades ?? []) as Array<{
        id: string;
        stripe_payment_intent_id: string | null;
        cash_amount_cents: number;
      }>;

      let piCancelled = 0;
      let piFailed = 0;

      for (const trade of trades) {
        // Cancel PI on Stripe
        const piId = trade.stripe_payment_intent_id;
        if (piId && stripe) {
          try {
            const pi = await stripe.paymentIntents.retrieve(piId);
            if (['requires_capture', 'requires_confirmation', 'requires_action', 'requires_payment_method'].includes(pi.status)) {
              await stripe.paymentIntents.cancel(piId);
              piCancelled++;
              console.log(`[process-expired-offers] PI ${piId} cancelled for expired trade ${trade.id}`);
            }
          } catch (stripeErr: unknown) {
            const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
            console.error(`[process-expired-offers] PI cancel failed for ${trade.id}:`, msg);
            piFailed++;
          }
        }

        // Void tax record (non-blocking, handles zero-tax trades via noop)
        try {
          await supabase.rpc('rpc_void_tax_for_trade', {
            p_trade_id: trade.id,
            p_reason: 'offer_expired',
          });
        } catch (taxErr: unknown) {
          const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
          console.error(`[process-expired-offers] Tax void error for ${trade.id}:`, msg);
        }
      }

      console.log(`[process-expired-offers] PI results: ${piCancelled} cancelled, ${piFailed} failed`);
    }

    // Step 1: Run the RPC (data-only, handles DB status changes + notifications)
    const { data, error } = await supabase.rpc('rpc_process_expired_offers', {
      p_batch_size: batchSize,
    });

    if (error) {
      console.error('[process-expired-offers]', {
        requestId,
        batchSize,
        error: error.message,
      });

      return jsonResponse(500, {
        success: false,
        error: {
          code: 'RPC_PROCESS_EXPIRED_OFFERS_FAILED',
          message: error.message,
          details: { requestId },
        },
      });
    }

    // Step 2: Send queued notifications
    const rpcResult = data as Record<string, unknown>;
    const notifications = (rpcResult?.notifications ?? []) as Notification[];
    const { sent, failed } = await sendNotifications(
      supabaseUrl,
      serviceRoleKey,
      notifications,
    );

    console.log('[process-expired-offers]', {
      requestId,
      batchSize,
      processed: rpcResult?.expired_offers_processed,
      notificationsSent: sent,
      notificationsFailed: failed,
    });

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      data: rpcResult,
      notifications: { sent, failed, total: notifications.length },
    });
  } catch (error) {
    console.error('[process-expired-offers] unexpected error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResponse(500, {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { requestId },
      },
    });
  }
});
