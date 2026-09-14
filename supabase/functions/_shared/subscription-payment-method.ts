// File: supabase/functions/_shared/subscription-payment-method.ts
//
// FIX-Task-34 item 2/3 (2026-09-14) — keep Stripe's renewal resolution in sync
// with the card the app's DB has recorded.
//
// WHY THIS EXISTS (the F6 finding)
// --------------------------------
// A recurring Kids Club+ renewal is charged BY STRIPE, not by an Edge Function.
// Stripe resolves the card for that invoice in this order:
//
//     1. subscription.default_payment_method
//     2. customer.invoice_settings.default_payment_method
//     3. customer.default_source
//
// The app, however, treats `subscriptions.stripe_payment_method_id` as "the
// user's card" and several writers update ONLY that column:
//
//   * `get-payment-method` re-points it (its deterministic-selection fallback
//     picks another valid card when the stored one is gone/expired) and writes
//     NOTHING to Stripe;
//   * `attach-payment-method` sets the CUSTOMER default but not the
//     SUBSCRIPTION default, and that customer call is non-fatal (`console.warn`
//     + continue), so a failure is silent.
//
// Verified live 2026-09-14 on `cus_Ungj4MptKp9CUg` / `sub_1To5Vg4I6kCJlvXoebIAvLZJ`:
// the subscription's `default_payment_method` is `null` and the customer's
// `invoice_settings.default_payment_method` still names an OLDER card, while the
// DB had already moved to a NEWER one. Layer 1 falls through, so Stripe would
// resolve a card the user believes they replaced.
//
// THE FIX
// -------
// One helper that writes the SAME card to BOTH Stripe levels a renewal consults.
// Setting the SUBSCRIPTION level is what actually matters — it wins over the
// customer default — and setting the customer level keeps the two from
// disagreeing for any future subscription on that customer.
//
// Best-effort by design: these are sync calls made from a user-facing EF. A
// Stripe hiccup must NOT fail the user's primary action (replacing a card), so
// every failure is logged, reported in the return value, and never thrown. The
// caller decides whether to surface it.
//
// STRUCTURAL TYPING (deliberate): the Stripe-calling Edge Functions in this repo
// are pinned to DIFFERENT SDK majors (v12 and v14.5.0). Importing `Stripe`'s type
// from one version here would make the other version's client unassignable and
// break `deno check`. So this module describes only the two calls it makes.

export interface StripeDefaultsClient {
  subscriptions: {
    update(id: string, params: { default_payment_method: string }): Promise<unknown>;
  };
  customers: {
    update(
      id: string,
      params: { invoice_settings: { default_payment_method: string } },
    ): Promise<unknown>;
  };
}

export interface SyncResult {
  /** Did the subscription-level default get written? This is the one renewals use. */
  subscription_synced: boolean;
  /** Did the customer-level default get written? Kept in sync for consistency. */
  customer_synced: boolean;
  /** Present only when something failed — never thrown. */
  errors: string[];
}

/**
 * Write `paymentMethodId` as the default at BOTH Stripe levels a renewal reads.
 *
 * @param stripe          an initialised Stripe client
 * @param customerId      `cus_...` — skipped when falsy
 * @param subscriptionId  `sub_...` — skipped when null (a user may have no live
 *                        Stripe subscription yet; only the customer is synced)
 * @param paymentMethodId `pm_...` — no-op when falsy, so callers may pass the
 *                        DB value straight through without guarding
 */
export async function syncStripeDefaultPaymentMethod(
  stripe: StripeDefaultsClient,
  opts: {
    customerId?: string | null;
    subscriptionId?: string | null;
    paymentMethodId?: string | null;
  },
): Promise<SyncResult> {
  const result: SyncResult = { subscription_synced: false, customer_synced: false, errors: [] };
  const { paymentMethodId } = opts;
  if (!paymentMethodId) return result;

  // ── Level 1: the subscription. This is the level a renewal actually reads. ──
  if (opts.subscriptionId) {
    try {
      await stripe.subscriptions.update(opts.subscriptionId, {
        default_payment_method: paymentMethodId,
      });
      result.subscription_synced = true;
      console.log(
        `[sync-payment-method] subscription ${opts.subscriptionId} default -> ${paymentMethodId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`subscription: ${msg}`);
      console.error(`[sync-payment-method] subscription sync FAILED for ${opts.subscriptionId}:`, msg);
    }
  }

  // ── Level 2: the customer, so the two levels never disagree. ──
  if (opts.customerId) {
    try {
      await stripe.customers.update(opts.customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      result.customer_synced = true;
      console.log(`[sync-payment-method] customer ${opts.customerId} default -> ${paymentMethodId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`customer: ${msg}`);
      console.error(`[sync-payment-method] customer sync FAILED for ${opts.customerId}:`, msg);
    }
  }

  return result;
}
