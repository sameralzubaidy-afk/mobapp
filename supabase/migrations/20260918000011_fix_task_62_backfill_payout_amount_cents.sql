-- ============================================================================
-- FIX-Task-62 (Fix A, part 2) — repair NULL trades.payout_amount_cents
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- Classification: A (migration / data repair) + F (money) → Tier 2
-- ============================================================================
-- DISCOVERED DURING PHASE-2 VERIFICATION — this is a SECOND, independent
-- stranding mechanism, not a variant of the first.
--
-- After Fix A was applied, the sanctioned `release-due-payouts` Edge Function was
-- invoked for real and returned HTTP 200 with `trade_ids: []` and `dispatched: 0`
-- — the 6 known-payable payouts were still not dispatched. Diagnosis (per-trade
-- predicate evaluation) showed ALL SIX trades carry `payout_amount_cents = NULL`
-- while `cash_amount_cents` holds the real proceeds. That NULL excludes them from:
--   * pass 2 of `rpc_release_due_payouts`  (the new self-heal)
--   * pass 1 of `rpc_release_due_payouts`  (the pre-existing release sweep)
--   * `initiate-payout` entirely — it has a deliberate DEV-TASK-48 guard that
--     refuses a NULL amount and re-parks the trade (`409 PAYOUT_AMOUNT_MISSING`,
--     "needs admin review").
-- So these rows were unreachable by EVERY payout path, for a reason neither
-- FIX-Task-37 nor FIX-Task-56 had identified.
--
-- WHY THIS REPAIR IS SAFE (measured, not assumed)
--   * The value is not invented: `seller_payouts.gross_amount_cents` was written by
--     the completion path from the same basis. Live measurement over the whole set:
--     **67 rows repairable, $3,669.91, and 0 rows where the two independent records
--     disagree.** The equality guard below therefore excludes nothing today and
--     protects the future: if the two ever disagree, the row is left NULL for review
--     rather than silently paid at a guessed amount.
--   * Only `> 0` amounts are written, so the DT48 "never mint a $0 payout" invariant
--     is preserved.
--   * Only non-terminal payouts (`requires_action` / `pending` / `processing`) are
--     touched — never a paid or failed history row.
--   * Idempotent: a second run matches nothing.
--
-- ROLLBACK
--   Capture the affected ids first (`SELECT t.id ... WHERE payout_amount_cents IS NULL`
--   before applying), then restore with:
--     UPDATE public.trades SET payout_amount_cents = NULL WHERE id IN (<captured ids>);
--   No money moves as a result of this statement — it only makes the amount the
--   existing dispatch paths already expect.
-- ============================================================================

UPDATE public.trades t
SET payout_amount_cents = sp.gross_amount_cents,
    updated_at          = now()
FROM public.seller_payouts sp
WHERE sp.trade_id = t.id
  AND t.payout_amount_cents IS NULL
  AND t.status = 'completed'
  AND sp.status IN ('requires_action', 'pending', 'processing')
  AND sp.gross_amount_cents > 0
  AND t.cash_amount_cents IS NOT NULL
  AND sp.gross_amount_cents = t.cash_amount_cents;  -- corroboration guard

-- ============================================================================
-- VERIFICATION QUERIES (one statement per call — result-granularity rule)
-- ============================================================================
-- V1 — nothing repairable remains in a non-terminal state (expect 0):
--   SELECT count(*) FROM public.trades t JOIN public.seller_payouts sp ON sp.trade_id = t.id
--   WHERE t.payout_amount_cents IS NULL AND t.status = 'completed'
--     AND sp.status IN ('requires_action','pending','processing')
--     AND sp.gross_amount_cents > 0 AND t.cash_amount_cents IS NOT NULL
--     AND sp.gross_amount_cents = t.cash_amount_cents;
-- V2 — the newly-payable set is now visible to pass 2 (expect the payable rows):
--   SELECT count(*) FROM public.trades t
--   WHERE t.status='completed' AND t.payout_status='requires_action'
--     AND COALESCE(t.payout_release_at, t.completed_at) <= now()
--     AND COALESCE(t.payout_amount_cents,0) > 0
--     AND EXISTS (SELECT 1 FROM public.seller_payout_methods m
--                 WHERE m.user_id = t.seller_id AND m.is_primary AND m.is_verified);
-- ============================================================================
