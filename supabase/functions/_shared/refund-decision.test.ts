// File: supabase/functions/_shared/refund-decision.test.ts
//
// FIX-Task-32 item 3 regression guard — the void-vs-refund discriminator.
//
// Run with:
//   deno test --allow-env --no-config --no-lock supabase/functions/_shared/refund-decision.test.ts
//
// WHY THIS TEST EXISTS
// --------------------
// The O2-C12 defect (uncaptured money booked as a refund + a `needs_review` tax
// row) is LATENT: it had never fired on staging, so it could not be "verified by
// a QA pass" — the only honest check is a pure assertion on the decision itself.
// Extracting the decision also means the test runs in the DEFAULT suite, so a
// future edit that re-routes the uncaptured case back to the refund RPC fails
// immediately instead of two rounds later on a live probe.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  CANCELLED_REFUND_ID_PREFIX,
  classifyRefundLedgerLeg,
  isCancelledRefundId,
  shouldVoidFromRefundId,
  STRIPE_ACTION_CANCELLED_UNCAPTURED,
} from "./refund-decision.ts";

Deno.test("item 3: an uncaptured cancellation takes the VOID leg", () => {
  assertEquals(
    classifyRefundLedgerLeg(STRIPE_ACTION_CANCELLED_UNCAPTURED),
    "void_uncaptured",
  );
  assertEquals(
    classifyRefundLedgerLeg("cancelled_uncaptured"),
    "void_uncaptured",
  );
});

Deno.test(
  "item 3: every other Stripe action keeps the recorded-refund leg unchanged",
  () => {
    // A real partial refund of captured money.
    assertEquals(classifyRefundLedgerLeg("refunded"), "record_refund");
    // issue_refund=false but a PI exists — DB-side record only (pre-existing behaviour).
    assertEquals(classifyRefundLedgerLeg("skip"), "record_refund");
    // Zero-cash / donate trade with no PI — DB-side record only.
    assertEquals(classifyRefundLedgerLeg("no_pi"), "record_refund");
    // The PI was already cancelled/void at Stripe.
    assertEquals(classifyRefundLedgerLeg("none"), "record_refund");
    // Defensive: an unknown/empty action must not silently become a void.
    assertEquals(classifyRefundLedgerLeg(""), "record_refund");
    assertEquals(classifyRefundLedgerLeg("SOMETHING_NEW"), "record_refund");
  },
);

Deno.test(
  "item 3: the cancelled_ refund-id sentinel mirrors the DB guard",
  () => {
    assertEquals(CANCELLED_REFUND_ID_PREFIX, "cancelled_");

    assertEquals(isCancelledRefundId("cancelled_pi_3Nxj2"), true);
    assertEquals(isCancelledRefundId("cancelled_"), true);
    assertEquals(isCancelledRefundId("re_3Nxj2"), false);
    assertEquals(isCancelledRefundId(""), false);
    assertEquals(isCancelledRefundId(null), false);
    assertEquals(isCancelledRefundId(undefined), false);
    // Must not match a real refund id that merely CONTAINS the word.
    assertEquals(isCancelledRefundId("re_cancelled_123"), false);
  },
);

Deno.test(
  "item 3: shouldVoidFromRefundId agrees with the action and the id sentinel",
  () => {
    assertEquals(shouldVoidFromRefundId("cancelled_uncaptured", null), true);
    assertEquals(shouldVoidFromRefundId("refunded", "re_123"), false);
    assertEquals(shouldVoidFromRefundId("refunded", "cancelled_pi_123"), true);
    assertEquals(shouldVoidFromRefundId("no_pi", null), false);
  },
);
