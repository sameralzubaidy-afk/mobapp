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

// =============================================================================
// FIX-Task-37 item 2 (2026-09-16) — retire the PaymentMethod a new card REPLACED
// =============================================================================
//
// WHY THIS EXISTS (the F2 finding)
// --------------------------------
// Attaching a new card never detached the old one, so `attach-payment-method`
// (and its three sibling attach sites) left every replaced PaymentMethod attached
// to the Stripe customer forever. Verified live on 2026-09-16:
//
//     attach 4242            -> [4242]
//     Update to 4444         -> [4444, 4242]   <- replaced card NOT detached
//     Remove                 -> [4242]         <- the orphan survives removal
//
// The DB only ever names ONE card (`subscriptions.stripe_payment_method_id`), so
// these orphans are invisible in the app while accumulating at the provider — one
// test customer reached 4 attached PMs through routine testing alone.
//
// WHY A SHARED HELPER
// -------------------
// Four EFs attach a card and each would otherwise need its own copy of this logic
// (`attach-payment-method`, `create-subscription-payment`,
// `create-subscription-from-payment-method`, `renew-subscription`). One helper
// keeps the skip rules and the failure semantics identical everywhere.
//
// SAFETY RULES (all deliberate)
// -----------------------------
//  * NEVER detach the card we just attached (`previous === new` is a no-op).
//  * Only detach a card that is actually attached to THIS customer — Stripe
//    rejects detaching a detached/foreign PM, and a needless failure would be
//    logged as noise on every replace.
//  * Best-effort: a detach failure must NEVER fail the user's action (the new card
//    is already attached and persisted by the time this runs), so every outcome is
//    returned and nothing is thrown.
//  * Detaching is IRREVERSIBLE for that token: Stripe permanently refuses to
//    re-attach a card that was detached from a customer
//    ("...may not be used again"). That is acceptable here precisely because the
//    card is being REPLACED — but it is why this must never run against the
//    currently-stored card.

export interface StripePreviousPaymentMethodClient {
  paymentMethods: {
    retrieve(id: string): Promise<unknown>;
    detach(id: string): Promise<unknown>;
  };
}

export interface RetireResult {
  /** True only when Stripe confirmed the detach. */
  detached: boolean;
  /** Why nothing was detached (a legitimate no-op, not an error). */
  skipped_reason?:
    | 'no_customer'
    | 'no_previous_pm'
    | 'unchanged'
    | 'not_attached_to_customer';
  /** Present only when the detach was attempted and failed — never thrown. */
  error?: string;
}

/**
 * Detach the PaymentMethod that `newPaymentMethodId` replaced on `customerId`.
 *
 * Call this AFTER the new card is attached and the default has been synced, so the
 * provider never has a window where the customer has no usable default.
 *
 * @param stripe               an initialised Stripe client
 * @param opts.customerId      `cus_...` — skipped when falsy
 * @param opts.previousPaymentMethodId  the `pm_...` the DB named BEFORE the
 *                             replace (read it before overwriting the column)
 * @param opts.newPaymentMethodId       the `pm_...` just attached
 */
export async function retirePreviousPaymentMethod(
  stripe: StripePreviousPaymentMethodClient,
  opts: {
    customerId?: string | null;
    previousPaymentMethodId?: string | null;
    newPaymentMethodId?: string | null;
  },
): Promise<RetireResult> {
  const { customerId, previousPaymentMethodId, newPaymentMethodId } = opts;

  if (!customerId) return { detached: false, skipped_reason: 'no_customer' };
  if (!previousPaymentMethodId) return { detached: false, skipped_reason: 'no_previous_pm' };
  if (previousPaymentMethodId === newPaymentMethodId) {
    return { detached: false, skipped_reason: 'unchanged' };
  }

  try {
    // Confirm the PM really belongs to this customer before touching it. A PM that
    // is already detached reports `customer: null`, and `detach` would 400 — that
    // is a normal no-op on a repeat run, not a failure worth logging as an error.
    const pm = (await stripe.paymentMethods.retrieve(previousPaymentMethodId)) as {
      customer?: string | { id?: string } | null;
    };
    const rawCustomer = pm?.customer ?? null;
    const attachedCustomerId =
      typeof rawCustomer === 'string' ? rawCustomer : (rawCustomer?.id ?? null);

    if (attachedCustomerId !== customerId) {
      return { detached: false, skipped_reason: 'not_attached_to_customer' };
    }

    await stripe.paymentMethods.detach(previousPaymentMethodId);
    console.log(
      `[retire-payment-method] detached replaced ${previousPaymentMethodId} from ${customerId} (replaced by ${newPaymentMethodId})`,
    );
    return { detached: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[retire-payment-method] detach FAILED for ${previousPaymentMethodId} on ${customerId}:`,
      msg,
    );
    return { detached: false, error: msg };
  }
}
