-- =============================================================================
-- Dev Task 121 (2026-09-06): billing_history dedupe — one row per Stripe invoice
-- -----------------------------------------------------------------------------
-- MODE: B (idempotent rerunnable — safe to re-run)
--
-- Problem (QA Task-36 / DT-121): a single subscription renewal can produce TWO
-- billing_history rows for the same Stripe invoice:
--   * `renew-subscription` (app EF) writes its row keyed to the real detached
--     charge id (`ch_...`) it discovers after charging.
--   * `stripe-webhook-subscriptions`' `invoice.payment_succeeded` handler writes
--     a separate row keyed to the invoice id (`in_...`) because, in this
--     environment, the invoice payload exposes `charge`/`payment_intent` as null.
-- The existing `UNIQUE(charge_id)` constraint cannot catch the pair because the
-- two rows carry different charge_id values for the same invoice.
--
-- Fix: make `stripe_invoice_id` the idempotency key (every writer already sets it
-- to the same real invoice id for the same charge). This migration (1) collapses
-- any pre-existing duplicates and (2) adds a PLAIN unique index on
-- `stripe_invoice_id`. A plain (non-partial) unique index is deliberate:
--   * Postgres unique semantics treat NULLs as distinct, so the nullable column
--     still permits rows without an invoice id (e.g. some initial activations).
--   * PostgREST `onConflict: 'stripe_invoice_id'` requires a NON-partial unique
--     index to be usable as a conflict arbiter.
-- Companion code change (same task): every billing_history writer upserts with
-- `{ onConflict: 'stripe_invoice_id', ignoreDuplicates: true }`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOCK 1 — Data: collapse duplicate rows (idempotent; no-op when none exist).
-- Keeper per stripe_invoice_id: the row whose charge_id is a real charge
-- (`ch_...`) when one exists, else the earliest-created row.
-- -----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    bh.id,
    row_number() OVER (
      PARTITION BY bh.stripe_invoice_id
      ORDER BY
        (LEFT(bh.charge_id, 3) = 'ch_') DESC,
        bh.created_at ASC,
        bh.id ASC
    ) AS rn
  FROM public.billing_history bh
  WHERE bh.stripe_invoice_id IS NOT NULL
)
DELETE FROM public.billing_history bh
USING ranked r
WHERE bh.id = r.id
  AND r.rn > 1;

-- -----------------------------------------------------------------------------
-- BLOCK 2 — Constraint: enforce one row per invoice going forward.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_history_stripe_invoice_id
  ON public.billing_history(stripe_invoice_id);

-- -----------------------------------------------------------------------------
-- Verification queries (SQL-3) — run after the two blocks above
-- -----------------------------------------------------------------------------
-- (1) No remaining duplicates (expected: 0 rows):
--   SELECT stripe_invoice_id, count(*)
--   FROM public.billing_history
--   WHERE stripe_invoice_id IS NOT NULL
--   GROUP BY 1
--   HAVING count(*) > 1;
--
-- (2) Index present (expected: 1 row):
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'billing_history'
--     AND indexname = 'uq_billing_history_stripe_invoice_id';
--
-- Rollback:
--   DROP INDEX IF EXISTS uq_billing_history_stripe_invoice_id;
