// File: supabase/functions/retry-failed-payment/index.ts
// MODULE-11 TASK SUB-018: Payment Failure Handling - Retry Failed Payment
//
// Allows user to manually retry a failed subscription payment after updating payment method.
// Resets retry count and payment_failed_at on success.
//
// SECURITY: Uses user JWT to ensure user can only retry their own payment.
// HP-3: User auth enforced. No service role bypass needed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

// ─── Stripe client ────────────────────────────────────────────────────────────
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─────────────────────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────────────────────
interface RetryPaymentRequest {
  user_id: string; // Required for authorization check
  resolve_without_invoice?: boolean; // Optional: clear stale failure flags after card update
}

interface RetryPaymentResponse {
  success: boolean;
  message?: string;
  subscription?: {
    status: string;
    payment_retry_count: number;
    current_period_end: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Extract user from JWT ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

  if (authError || !user) {
    console.error('[retry-failed-payment] Auth error:', authError);
    return jsonResponse(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
      { status: 401 }
    );
  }

  const authenticatedUserId = user.id;

  // ── Parse request body ─────────────────────────────────────────────────────
  let body: RetryPaymentRequest;
  try {
    body = await req.json();
  } catch (err) {
    return jsonResponse(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const { user_id, resolve_without_invoice } = body;

  // ── Authorization: User can only retry their own payment ──────────────────
  if (user_id !== authenticatedUserId) {
    return jsonResponse(
      { success: false, error: { code: 'FORBIDDEN', message: 'You can only retry your own payment' } },
      { status: 403 }
    );
  }

  // ── Fetch user subscription ────────────────────────────────────────────────
  const { data: sub, error: fetchError } = await supabaseClient
    .from('subscriptions')
    .select('id, user_id, status, payment_retry_count, payment_failed_at, stripe_subscription_id, stripe_customer_id, stripe_payment_method_id')
    .eq('user_id', user_id)
    .maybeSingle();

  if (fetchError || !sub) {
    console.error('[retry-failed-payment] Subscription fetch error:', fetchError);
    return jsonResponse(
      { success: false, error: { code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for user' } },
      { status: 404 }
    );
  }

  // ── Validate subscription state ────────────────────────────────────────────
  if (!sub.payment_failed_at || sub.payment_retry_count === 0) {
    return jsonResponse({
      success: false,
      error: { code: 'NO_FAILED_PAYMENT', message: 'No failed payment to retry' },
    }, { status: 400 });
  }

  if (!sub.stripe_subscription_id || !sub.stripe_customer_id) {
    return jsonResponse({
      success: false,
      error: { code: 'MISSING_STRIPE_DATA', message: 'Subscription missing Stripe identifiers' },
    }, { status: 400 });
  }

  // ── Attempt to retry the invoice payment via Stripe ───────────────────────
  try {
    console.log(`[retry-failed-payment] Retrying payment for user=${user_id} stripe_sub=${sub.stripe_subscription_id}`);

    // Get the latest open invoice for the subscription
    const invoices = await stripe.invoices.list({
      subscription: sub.stripe_subscription_id,
      status: 'open',
      limit: 1,
    });

    if (invoices.data.length === 0) {
      // No open invoice — subscription may have been manually fixed/deleted,
      // or user just updated card between retry windows.
      if (resolve_without_invoice === true) {
        await supabaseClient.rpc('record_payment_attempt', {
          p_user_id: user_id,
          p_success: true,
        });

        console.log(
          `[retry-failed-payment] Cleared stale payment failure flags without open invoice for user=${user_id}`
        );

        return jsonResponse({
          success: true,
          message:
            'Payment method updated successfully. No open invoice was found, and payment failure flags were cleared.',
          subscription: {
            status: sub.status,
            payment_retry_count: 0,
            current_period_end: null,
          },
        });
      }

      return jsonResponse({
        success: false,
        error: { code: 'NO_OPEN_INVOICE', message: 'No open invoice found to retry' },
      }, { status: 400 });
    }

    const invoice = invoices.data[0];

    // ── DEV-TASK-6 (2026-08-27): Reset retry gate BEFORE invoking Stripe ─────
    // The payment_retry_count / payment_failed_at reset used to run only AFTER a
    // successful invoices.pay. A timeout between the Stripe charge and that DB
    // reset left a stale count that could re-enable this retry path (an unintended
    // re-invocation). Clearing the gate first — the user is explicitly retrying —
    // means a timeout can never leave a stale count. `status` is intentionally NOT
    // touched here: a declined retry is re-marked by the invoice.payment_failed
    // webhook (record_payment_attempt p_success=false), and a successful charge
    // transitions to active in the success branch below.
    const { error: resetError } = await supabaseClient
      .from('subscriptions')
      .update({
        payment_retry_count: 0,
        payment_failed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    if (resetError) {
      console.error('[retry-failed-payment] Failed to reset retry gate before Stripe pay:', resetError);
      // Non-fatal — the idempotency key below is the real double-charge guard.
    }

    // Retry the invoice payment (this will use the default payment method on customer)
    // DEV-TASK-6 (2026-08-27): per-invoice idempotency key so a timeout-retry of the
    // SAME invoice can never double-charge. STRIPE-IDEMPOTENCY-FIX: key is the options
    // arg, never a property of the params object (BP-65).
    // DT-11 (2026-08-27): `paid_out_of_band: false` is REJECTED by Stripe
    // ("invalid_paid_out_of_band_parameter ... must be 'true'"), so the retry could never
    // actually charge — omit the param entirely (its default IS the real-charge attempt).
    const retriedInvoice = await stripe.invoices.pay(
      invoice.id,
      // Attempt real charge (paid_out_of_band omitted — Stripe rejects an explicit `false`).
      // Expand payment_intent so we can read the charge ID for the billing ledger.
      { expand: ['payment_intent'] },
      { idempotencyKey: `invoice_pay_${invoice.id}` },
    );

    if (retriedInvoice.status === 'paid') {
      // ── Success: finalize state (status → active; RPC records last_payment_date) ──
      const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .update({
          payment_retry_count: 0,
          payment_failed_at: null,
          status: 'active', // Move back to active if they were in grace_period
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      if (updateError) {
        console.error('[retry-failed-payment] DB update error after successful payment:', updateError);
        // Payment succeeded but DB update failed — log for manual intervention
      }

      // ── Charge + amount from the retried invoice (ledger + last_payment) ────
      // Match the webhook's charge_id resolution so retry and invoice.payment_succeeded
      // write the SAME billing_history row (upsert dedupes on charge_id).
      const pi = retriedInvoice.payment_intent;
      const retriedChargeId =
        (typeof retriedInvoice.charge === 'string' && retriedInvoice.charge) ||
        (typeof pi === 'object' && pi !== null && typeof pi.latest_charge === 'string' && pi.latest_charge) ||
        (typeof pi === 'string' && pi) ||
        retriedInvoice.id;
      const retriedAmount = retriedInvoice.amount_paid || retriedInvoice.amount_due || 0;

      // ── Call record_payment_attempt RPC to reset state cleanly AND record the
      //    last payment (SUB-002 RPC sets subscriptions.last_payment_amount when
      //    p_amount is passed — fixes last_payment_amount staying NULL on retry). ──
      const { error: attemptError } = await supabaseClient.rpc('record_payment_attempt', {
        p_user_id: user_id,
        p_success: true,
        p_amount: retriedAmount,
        p_charge_id: retriedChargeId,
      });
      if (attemptError) {
        console.error('[retry-failed-payment] record_payment_attempt failed after successful payment:', attemptError.message);
      }

      // DEV-TASK-99 (R6): a successful retry returns the subscription to active —
      // also return the SP wallet to 'active' (earn+spend) if grace entry had
      // moved it to 'grace_period'. rpc_set_sp_wallet_state is service-role only.
      const { error: walletRestoreError } = await supabaseClient.rpc('rpc_set_sp_wallet_state', {
        p_user_id: user_id,
        p_state: 'active',
      });
      if (walletRestoreError) {
        console.error('[retry-failed-payment] rpc_set_sp_wallet_state(active) failed after successful payment:', walletRestoreError.message);
      } else {
        console.log(`[retry-failed-payment] SP wallet -> active for user=${user_id}`);
      }

      // ── Billing ledger (idempotent on charge_id) — Item 3 (2026-08-27) ───────
      const { error: billingError } = await supabaseClient.from('billing_history').upsert(
        {
          user_id,
          subscription_id: sub.id,
          charge_id: retriedChargeId,
          stripe_invoice_id: retriedInvoice.id,
          amount: retriedAmount,
          currency: retriedInvoice.currency || 'usd',
          status: 'succeeded',
          charged_at: retriedInvoice.status_transitions?.paid_at
            ? new Date(retriedInvoice.status_transitions.paid_at * 1000).toISOString()
            : new Date().toISOString(),
          description: 'Kids Club+ subscription - retried payment',
        },
        { onConflict: 'charge_id', ignoreDuplicates: true },
      );
      if (billingError) {
        console.error('[retry-failed-payment] billing_history upsert failed:', billingError.message);
      }

      console.log(`[retry-failed-payment] ✅ Payment retry succeeded for user=${user_id}`);

      return jsonResponse({
        success: true,
        message: 'Payment successful! Your subscription has been renewed.',
        subscription: {
          status: 'active',
          payment_retry_count: 0,
          current_period_end: retriedInvoice.period_end ? new Date(retriedInvoice.period_end * 1000).toISOString() : null,
        },
      });
    } else {
      // Payment still failed
      console.warn(`[retry-failed-payment] Payment retry failed again for user=${user_id} invoice_status=${retriedInvoice.status}`);

      return jsonResponse({
        success: false,
        error: {
          code: 'PAYMENT_FAILED_AGAIN',
          message: 'Your card was declined again. Please check with your bank or try a different payment method.',
        },
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[retry-failed-payment] Stripe error:', error?.message, error?.code);

    // Stripe error (card declined, insufficient funds, etc.)
    let errorMessage = 'Payment could not be completed. Please update your payment method and try again.';
    if (error?.decline_code) {
      errorMessage = `Payment declined: ${error.decline_code}. Please contact your bank.`;
    }

    return jsonResponse({
      success: false,
      error: {
        code: 'STRIPE_ERROR',
        message: errorMessage,
      },
    }, { status: 400 });
  }
});

// ─── Helper: JSON response ────────────────────────────────────────────────────
function jsonResponse(data: RetryPaymentResponse, options: { status?: number } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: options.status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
