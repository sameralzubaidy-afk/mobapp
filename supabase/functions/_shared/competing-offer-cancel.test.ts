// File: supabase/functions/_shared/competing-offer-cancel.test.ts
//
// FIX-Task-32 items 1 + 2 regression guard.
//
// Run with:
//   deno test --allow-env --no-config --no-lock supabase/functions/_shared/competing-offer-cancel.test.ts
//
// WHY THIS TEST EXISTS
// --------------------
// The competing-offer leak recurred TWICE: FIX-Task-24 repaired 52 rows of data
// but never changed the writer, so the very next QA round reproduced it. The
// failure mode is a writer silently dropping one of the three legs
// (Stripe hold release / tax void / `cancelled_at`), which is invisible in a
// static review and only observable through a live uncaptured-PI drive.
//
// These are PURE unit tests (no staging, no Stripe, no feature flag) so they run
// in the default suite. They assert the invariant at the seam both writers share,
// which is what makes a third regression impossible to ship unnoticed.

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCompetingOfferCancelPatch,
  COMPETING_OFFER_CANCELLATION_REASON,
  releaseCompetingOfferHolds,
  releaseRivalHoldAndVoidTax,
  type RivalTrade,
  type StripeLike,
  type SvcClientLike,
} from "./competing-offer-cancel.ts";

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

function makeSvcClient(
  result: unknown = { success: true, data: { action: "voided" } },
) {
  const calls: RpcCall[] = [];
  const client: SvcClientLike & { calls: RpcCall[] } = {
    calls,
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: result, error: null });
    },
  };
  return client;
}

function makeStripe(
  piStatus: string,
  opts: { retrieveThrows?: Error; cancelThrows?: Error } = {},
) {
  const cancelled: string[] = [];
  const retrieved: string[] = [];
  const stripe: StripeLike & { cancelled: string[]; retrieved: string[] } = {
    cancelled,
    retrieved,
    paymentIntents: {
      retrieve(id: string) {
        retrieved.push(id);
        if (opts.retrieveThrows) return Promise.reject(opts.retrieveThrows);
        return Promise.resolve({ status: piStatus });
      },
      cancel(id: string) {
        if (opts.cancelThrows) return Promise.reject(opts.cancelThrows);
        cancelled.push(id);
        return Promise.resolve({ id, status: "canceled" });
      },
    },
  };
  return stripe;
}

function rival(overrides: Partial<RivalTrade> = {}): RivalTrade {
  return {
    id: "rival-trade-1",
    stripe_payment_intent_id: "pi_rival_1",
    cash_amount_cents: 1200,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 2 — `cancelled_at` must be part of the shared update patch
// ─────────────────────────────────────────────────────────────────────────────
Deno.test(
  "item 2: the cancel patch stamps cancelled_at, status and the canonical reason",
  () => {
    const cancelledAt = "2026-09-14T10:00:00.000Z";
    const patch = buildCompetingOfferCancelPatch(cancelledAt);

    assertEquals(patch.status, "cancelled");
    assertEquals(
      patch.cancellation_reason,
      COMPETING_OFFER_CANCELLATION_REASON,
    );
    assertEquals(
      COMPETING_OFFER_CANCELLATION_REASON,
      "offer_expired_competing",
    );
    // THE regression assertion: the two writers previously omitted this field, which
    // is why 60 rows carried NULL cancelled_at.
    assertEquals(patch.cancelled_at, cancelledAt);
    assertEquals(patch.updated_at, cancelledAt);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 1 — the Stripe hold release
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("item 1: an uncaptured hold is CANCELLED at Stripe", async () => {
  const svc = makeSvcClient();
  const stripe = makeStripe("requires_capture");

  const outcome = await releaseRivalHoldAndVoidTax(svc, stripe, rival());

  assertEquals(outcome.piCancelled, true);
  assertEquals(stripe.retrieved, ["pi_rival_1"]);
  assertEquals(stripe.cancelled, ["pi_rival_1"]);
  assertEquals(outcome.errors, []);
});

Deno.test(
  "item 1: a CAPTURED payment intent is left alone (not our money to release)",
  async () => {
    const svc = makeSvcClient();
    const stripe = makeStripe("succeeded");

    const outcome = await releaseRivalHoldAndVoidTax(svc, stripe, rival());

    assertEquals(outcome.piCancelled, false);
    assertEquals(outcome.piSkippedReason, "not_releasable:succeeded");
    assertEquals(
      stripe.cancelled,
      [],
      "a succeeded PI must never be cancelled",
    );
  },
);

Deno.test(
  "item 1: releasing is skipped when there is no PI or no cash portion",
  async () => {
    const noPi = await releaseRivalHoldAndVoidTax(
      makeSvcClient(),
      makeStripe("requires_capture"),
      rival({ stripe_payment_intent_id: null }),
    );
    assertEquals(noPi.piSkippedReason, "no_payment_intent");
    assertEquals(noPi.piCancelled, false);

    const noCash = await releaseRivalHoldAndVoidTax(
      makeSvcClient(),
      makeStripe("requires_capture"),
      rival({ cash_amount_cents: 0 }),
    );
    assertEquals(noCash.piSkippedReason, "no_cash_amount");
    assertEquals(noCash.piCancelled, false);

    const noStripe = await releaseRivalHoldAndVoidTax(
      makeSvcClient(),
      null,
      rival(),
    );
    assertEquals(noStripe.piSkippedReason, "stripe_not_configured");
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 1 — the tax void leg
// ─────────────────────────────────────────────────────────────────────────────
Deno.test(
  "item 1: the tax record is voided via the sanctioned lifecycle RPC",
  async () => {
    const svc = makeSvcClient();
    await releaseRivalHoldAndVoidTax(
      svc,
      makeStripe("requires_capture"),
      rival(),
    );

    assertEquals(svc.calls.length, 1);
    assertEquals(svc.calls[0].fn, "rpc_void_tax_for_trade");
    assertEquals(svc.calls[0].args, {
      p_trade_id: "rival-trade-1",
      p_reason: "offer_expired_competing",
    });
  },
);

Deno.test(
  "item 1: the tax leg runs even when the Stripe leg FAILS (non-blocking)",
  async () => {
    const svc = makeSvcClient();
    const stripe = makeStripe("requires_capture", {
      retrieveThrows: new Error("stripe exploded"),
    });

    const outcome = await releaseRivalHoldAndVoidTax(svc, stripe, rival());

    assertEquals(outcome.piCancelled, false);
    assertEquals(svc.calls.length, 1, "the tax void must still be attempted");
    assertEquals(outcome.errors.length, 1);
    assertEquals(outcome.errors[0].includes("stripe exploded"), true);
  },
);

Deno.test("item 1: a tax-RPC error is reported, never thrown", async () => {
  const svc: SvcClientLike = {
    rpc: () =>
      Promise.resolve({ data: null, error: { message: "permission denied" } }),
  };

  const outcome = await releaseRivalHoldAndVoidTax(
    svc,
    makeStripe("requires_capture"),
    rival(),
  );

  assertEquals(outcome.taxVoided, false);
  assertEquals(
    outcome.errors.some((e) => e.includes("permission denied")),
    true,
  );
});

Deno.test(
  "item 1: a zero-tax trade (noop) counts as the wanted state, not an error",
  async () => {
    const svc = makeSvcClient({
      success: true,
      data: { action: "noop", reason: "no_tax_record" },
    });

    const outcome = await releaseRivalHoldAndVoidTax(
      svc,
      makeStripe("requires_capture"),
      rival(),
    );

    assertEquals(outcome.taxVoided, true);
    assertEquals(outcome.errors, []);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THE WHOLE HANDOFF both writers use
// ─────────────────────────────────────────────────────────────────────────────
Deno.test(
  "both writers: every rival is processed and the returned patch carries cancelled_at",
  async () => {
    const svc = makeSvcClient();
    const stripe = makeStripe("requires_capture");
    const rivals: RivalTrade[] = [
      rival({ id: "rival-a", stripe_payment_intent_id: "pi_a" }),
      rival({ id: "rival-b", stripe_payment_intent_id: "pi_b" }),
      rival({
        id: "rival-c",
        stripe_payment_intent_id: null,
        cash_amount_cents: 0,
      }),
    ];

    const result = await releaseCompetingOfferHolds(
      svc,
      stripe,
      rivals,
      "2026-09-14T11:11:11.000Z",
      "[test]",
    );

    assertEquals(result.rivalsProcessed, 3);
    assertEquals(result.releasedCount, 2);
    assertEquals(stripe.cancelled, ["pi_a", "pi_b"]);
    assertEquals(svc.calls.length, 3, "the tax void must run for EVERY rival");
    assertEquals(
      svc.calls.map((c) => c.args.p_trade_id),
      ["rival-a", "rival-b", "rival-c"],
    );
    assertNotEquals(result.patch.cancelled_at, undefined);
    assertEquals(result.patch.cancelled_at, "2026-09-14T11:11:11.000Z");
  },
);

Deno.test(
  "both writers: no rivals is a clean no-op that still yields the patch",
  async () => {
    const svc = makeSvcClient();
    const stripe = makeStripe("requires_capture");

    const result = await releaseCompetingOfferHolds(
      svc,
      stripe,
      [],
      "2026-09-14T00:00:00.000Z",
      "[test]",
    );

    assertEquals(result.rivalsProcessed, 0);
    assertEquals(result.releasedCount, 0);
    assertEquals(svc.calls.length, 0);
    assertEquals(stripe.cancelled.length, 0);
    assertEquals(result.patch.cancellation_reason, "offer_expired_competing");
  },
);
