// File: supabase/functions/_shared/competing-offer-cancel.ts
//
// FIX-Task-32 items 1 + 2 (2026-09-14) — the SINGLE implementation of the
// competing-offer cancellation side effects.
//
// WHY THIS EXISTS
// ---------------
// When a seller accepts one of two competing offers on the same listing, the
// rival ("losing") trades are auto-cancelled. Two writers did that:
//   * `transactions-update` (single accept)
//   * `transactions-accept-bundle` (batch accept)
// …and BOTH only wrote `status` / `cancellation_reason` / `updated_at` — so the
// losing buyer's UNCAPTURED Stripe authorization hold was never released and
// their tax record stayed `quoted` forever (nothing repairs it: the
// `check-authorization-expiry` cron selects `status='pending'` only). They also
// never stamped `cancelled_at`.
//
// FIX-Task-24 backfilled 52 rows of exactly this leak but never changed the
// writer, so it kept re-leaking. To make a third regression impossible the logic
// lives HERE, once, and both writers call it:
//   * item 1 — cancel each rival's uncaptured PaymentIntent (`paymentIntents
//     .cancel`) and void its tax via `rpc_void_tax_for_trade` (the sanctioned
//     lifecycle RPC, the same one `admin-trade-action` / `resolve-dispute` /
//     `cancel-trade` / `process-expired-offers` already use);
//   * item 2 — return an update patch that INCLUDES `cancelled_at`.
//
// Mirrors the reference pattern in `admin-trade-action` (retrieve the PI, cancel
// it when it is still an uncaptured hold). All side effects are NON-BLOCKING: a
// Stripe or tax failure must never prevent the rival trade from being cancelled
// (the buyer must not keep a live hold AND a live offer).
//
// NOTE: `cancelled_at` is stamped on the trade row, which is why the callers must
// use the patch returned by `buildCompetingOfferCancelPatch` rather than inline
// literals — that is what keeps the two writers from drifting again.

/** Canonical machine literal stored in `trades.cancellation_reason` (BP-76). */
export const COMPETING_OFFER_CANCELLATION_REASON = "offer_expired_competing";

/**
 * Stripe PaymentIntent statuses where the money was never captured and the
 * authorization can still be released. Same set the expiry / authorization-expiry
 * writers use; `processing` is included because Stripe can hold an auth there.
 */
export const RELEASABLE_PI_STATUSES = [
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "requires_payment_method",
  "processing",
] as const;

/** Minimal shape of a rival trade needed for the release + void legs. */
export interface RivalTrade {
  id: string;
  stripe_payment_intent_id: string | null;
  cash_amount_cents: number | null;
}

/** Minimal Stripe surface (keeps the helper unit-testable without the SDK). */
export interface StripeLike {
  paymentIntents: {
    retrieve(id: string): PromiseLike<{ status: string }>;
    cancel(id: string, params?: Record<string, unknown>): PromiseLike<unknown>;
  };
}

/**
 * Minimal supabase-js surface for the tax void RPC. `PromiseLike` (not `Promise`)
 * because supabase-js query builders are thenables, not native promises.
 */
export interface SvcClientLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data?: unknown; error?: { message?: string } | null }>;
}

/**
 * FIX-Task-32 item 2 — the patch both writers must apply to the rival rows.
 * `cancelled_at` is the field the retired `trigger_auto_decline_competing_offers`
 * used to stamp before D-30 retired the `payment_processing` status it keyed on.
 */
export function buildCompetingOfferCancelPatch(cancelledAt: string): {
  status: "cancelled";
  cancellation_reason: string;
  cancelled_at: string;
  updated_at: string;
} {
  return {
    status: "cancelled",
    cancellation_reason: COMPETING_OFFER_CANCELLATION_REASON,
    cancelled_at: cancelledAt,
    updated_at: cancelledAt,
  };
}

/**
 * FIX-Task-32 item 1 — release ONE rival's uncaptured Stripe hold and void its
 * tax record. Never throws; returns what happened so the caller can log it.
 */
export async function releaseRivalHoldAndVoidTax(
  svcClient: SvcClientLike,
  stripe: StripeLike | null,
  rival: RivalTrade,
): Promise<{
  piCancelled: boolean;
  piSkippedReason: string | null;
  taxVoided: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let piCancelled = false;
  let piSkippedReason: string | null = null;

  const piId = rival.stripe_payment_intent_id;

  // ── Stripe leg ────────────────────────────────────────────────────────────
  // `cash_amount_cents > 0` mirrors the decline path: a zero-cash (donate /
  // SP-only) offer never had a hold to release.
  if (!piId) {
    piSkippedReason = "no_payment_intent";
  } else if ((rival.cash_amount_cents ?? 0) <= 0) {
    piSkippedReason = "no_cash_amount";
  } else if (!stripe) {
    piSkippedReason = "stripe_not_configured";
  } else {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      if ((RELEASABLE_PI_STATUSES as readonly string[]).includes(pi.status)) {
        await stripe.paymentIntents.cancel(piId, {
          cancellation_reason: "requested_by_customer",
        });
        piCancelled = true;
      } else {
        piSkippedReason = `not_releasable:${pi.status}`;
      }
    } catch (stripeErr: unknown) {
      const msg =
        stripeErr instanceof Error ? stripeErr.message : "Stripe cancel error";
      errors.push(`stripe: ${msg}`);
    }
  }

  // ── Tax leg ───────────────────────────────────────────────────────────────
  // Non-blocking, like every other cancellation writer. A trade with no tax
  // record returns `noop` from the RPC (not an error).
  let taxVoided = false;
  try {
    const { data, error } = await svcClient.rpc("rpc_void_tax_for_trade", {
      p_trade_id: rival.id,
      p_reason: COMPETING_OFFER_CANCELLATION_REASON,
    });
    if (error) {
      errors.push(`tax: ${error.message ?? "unknown error"}`);
    } else {
      const result = data as {
        success?: boolean;
        data?: { action?: string };
      } | null;
      // Success includes the `noop` action (no tax record) — the wanted state.
      taxVoided = result?.success !== false;
      if (!taxVoided) {
        const detail = (result as { error?: { message?: string } } | null)
          ?.error?.message;
        errors.push(`tax: ${detail ?? "rpc returned success=false"}`);
      }
    }
  } catch (taxErr: unknown) {
    const msg = taxErr instanceof Error ? taxErr.message : "Unknown error";
    errors.push(`tax: ${msg}`);
  }

  return { piCancelled, piSkippedReason, taxVoided, errors };
}

/**
 * FIX-Task-32 item 1 — run the release + void legs for EVERY rival, then return
 * the shared update patch for the caller to apply with a single bulk UPDATE.
 *
 * Deliberately returns the patch instead of performing the trade UPDATE itself:
 * the caller already scopes the UPDATE with its own `listing_id` / `status`
 * predicates, and keeping the write at the call site preserves the existing
 * query semantics exactly.
 */
export async function releaseCompetingOfferHolds(
  svcClient: SvcClientLike,
  stripe: StripeLike | null,
  rivals: RivalTrade[],
  cancelledAt: string,
  logPrefix: string,
): Promise<{
  patch: ReturnType<typeof buildCompetingOfferCancelPatch>;
  releasedCount: number;
  rivalsProcessed: number;
}> {
  let releasedCount = 0;

  for (const rival of rivals) {
    const outcome = await releaseRivalHoldAndVoidTax(svcClient, stripe, rival);
    if (outcome.piCancelled) releasedCount++;
    if (outcome.errors.length > 0 || outcome.piSkippedReason) {
      console.log(
        `${logPrefix} competing-offer release for rival ${rival.id}:`,
        JSON.stringify({
          pi_cancelled: outcome.piCancelled,
          pi_skipped_reason: outcome.piSkippedReason,
          tax_voided: outcome.taxVoided,
          errors: outcome.errors,
        }),
      );
    } else {
      console.log(
        `${logPrefix} competing-offer release for rival ${rival.id}: PI cancelled + tax voided`,
      );
    }
  }

  return {
    patch: buildCompetingOfferCancelPatch(cancelledAt),
    releasedCount,
    rivalsProcessed: rivals.length,
  };
}
