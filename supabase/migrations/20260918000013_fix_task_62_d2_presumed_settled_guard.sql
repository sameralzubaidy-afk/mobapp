-- ============================================================================
-- FIX-Task-62 (D2) — the "proceeds already settled" precondition for pass 2
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- Classification: A (migration / RPC / CHECK constraint) + F (money & state
--                 machine) → Tier 2 required.
-- ============================================================================
-- WHY (owner decision D2, 2026-09-18 — report §12)
--   `20260918000012` wrapped Fix A's pass 2 (the self-heal sweep that hands
--   long-parked `requires_action` payouts to the dispatcher) behind the
--   fail-closed kill switch `admin_config.payout_requeue_enabled`, because its
--   first live run double-paid $205.00 in test mode: the sweep correctly paid 6
--   long-parked rows, but the SAME seller had already been paid the same $205.00
--   ten days earlier through an aggregate MANUAL payout
--   (`seller_payouts` row `082d46d6…`, `status='completed'`, `trade_id IS NULL`,
--   `gross_amount_cents = 20500`, transfer `tr_1UChi74I6kCJlvXoCmZ5YSdS`).
--   The kill switch was a stop-gap: what was missing is the PRECONDITION that
--   makes requeueing safe. This migration defines and enforces it.
--
-- THE RULE (fail-closed, evaluated inside the sweep, impossible to bypass)
--   A seller is treated as PRESUMPTIVELY ALREADY SETTLED — and NONE of their
--   parked payouts are requeued — when a completed, trade-less (i.e. manual)
--   payout exists for that seller whose gross amount EQUALS the total gross of
--   that seller's currently-parked (`requires_action`) payouts.
--
--   * The comparison is against the seller's FULL parked set, not the batch, so
--     the decision is identical on every hourly run and cannot be re-ordered
--     into a payment by a batch boundary.
--   * It is a HARD CHECK inside `rpc_release_due_payouts` — not a pre-flight
--     query a human has to remember to run — so no caller (cron EF, admin
--     script, manual RPC) can requeue past it.
--   * A skipped seller is NOT silently dropped: one idempotent row is written to
--     the unified `financial_audit_log` journal with the new mutation type
--     `payout_requeue_skipped`, which surfaces on the admin `/audit` page under
--     the "Payouts" category (FLOW-20). One row per seller, not one per hour
--     (deterministic idempotency key), so a permanently-blocked seller cannot
--     flood the journal.
--   * `amount_cents` is deliberately left NULL on that row: no money moved, and
--     the `/audit` summary strip sums `amount_cents` — putting the parked total
--     there would inflate a money total with funds that never left the account.
--     The parked total lives in `after_state` instead (visible in the expanded
--     row).
--
-- KNOWN LIMIT (named, not hidden — owner review needed before widening)
--   The rule catches an EXACT total match. A PARTIAL manual settlement (e.g.
--   $100 withdrawn manually while $205 sits parked) does not match and would
--   still be requeued in full. Widening it requires subset-aware matching, which
--   is why it is NOT guessed at here: over-blocking is what stranded these
--   payouts in the first place (the whole point of FIX-Task-62). Recommended
--   follow-up: match on "sum of completed trade-less payouts >= parked total"
--   once the owners agree on the review workflow for a partially-settled seller.
--
-- ROLLBACK
--   Re-apply the body from `20260918000012` (the flag-gated pass 2 without this
--   guard). The CHECK-constraint widening is purely additive — the extra allowed
--   value is inert once nothing writes it — so it needs no rollback. No data is
--   modified by this migration.
--
-- INTERACTION WITH THE KILL SWITCH (do not "simplify" this away)
--   The D2 evaluation runs INSIDE the `IF fn_admin_config_int('payout_requeue_enabled',0) = 1`
--   branch. With the switch OFF, pass 2 does nothing at all, so there is nothing
--   to guard and nothing to flag. The switch remains the outer gate.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Allow the new audit mutation type on the unified journal.
--    ADDITIVE-ONLY, read from the LIVE object.
--
--    DO NOT "simplify" this into `DROP CONSTRAINT` + `ADD CONSTRAINT ... IN (<list
--    copied from 20260916000118>)`. The live constraint permits FOUR values that
--    no migration file in the chain lists — `payout_scheduled`,
--    `trade_extension_reauth`, `extension_requested`, `dispute_evidence_staged` —
--    so reconstructing the allow-list from a file NARROWS it, and the ADD then
--    fails `23514 ... is violated by some row` against the 1207 existing journal
--    rows. (Measured: the first attempt at this migration failed exactly that way.
--    It rolled back atomically — constraint intact, function unreplaced — so no
--    residue, but the lesson is the one BP-47/BP-96 keep teaching: the live object
--    is authoritative, never the file.)
--
--    Reading the live definition back and extending it in place makes narrowing
--    structurally impossible, and an unrecognised shape RAISEs instead of guessing
--    (a silently narrower allow-list is the failure this is guarding against).
-- ---------------------------------------------------------------------------
DO $fix62_d2$
DECLARE
  v_live text;
  v_new  text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_live
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE n.nspname = 'public'
    AND r.relname = 'financial_audit_log'
    AND c.conname = 'financial_audit_log_mutation_type_check';

  IF v_live IS NULL THEN
    RAISE EXCEPTION
      '[FIX-62 D2] financial_audit_log_mutation_type_check not found — refusing to guess its shape';
  END IF;

  IF position('payout_requeue_skipped' IN v_live) > 0 THEN
    RAISE NOTICE '[FIX-62 D2] mutation_type already allows payout_requeue_skipped — no-op';
  ELSE
    -- Append inside the ARRAY literal, preserving every value the live constraint
    -- already carries. The definition ends `...])))` for this `IN (...)` shape.
    v_new := regexp_replace(v_live, '\]\)\)\)$', ', ''payout_requeue_skipped''::text])))');

    IF v_new = v_live THEN
      RAISE EXCEPTION
        '[FIX-62 D2] could not extend the live constraint definition (unexpected shape): %', v_live;
    END IF;

    EXECUTE 'ALTER TABLE public.financial_audit_log DROP CONSTRAINT financial_audit_log_mutation_type_check';
    EXECUTE 'ALTER TABLE public.financial_audit_log ADD CONSTRAINT financial_audit_log_mutation_type_check ' || v_new;
    RAISE NOTICE '[FIX-62 D2] extended mutation_type allow-list with payout_requeue_skipped';
  END IF;
END
$fix62_d2$;

-- ---------------------------------------------------------------------------
-- 2. Re-create `rpc_release_due_payouts` with the D2 precondition enforced.
--    Pass 1 is byte-for-byte unchanged from `20260918000012`.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_release_due_payouts(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count   integer := 0;
  v_requeued_count   integer := 0;
  v_skipped_count    integer := 0;
  v_trade_ids        uuid[];
  v_requeue_ids      uuid[] := ARRAY[]::uuid[];
  v_settled_sellers  uuid[] := ARRAY[]::uuid[];
  v_settled_review   jsonb  := '[]'::jsonb;
  v_rec              record;
BEGIN
  -- ── PASS 1 (unchanged): due `pending` payouts — release pending → available ──
  v_trade_ids := ARRAY(
    SELECT t.id
    FROM public.trades t
    WHERE t.status = 'completed'
      AND t.dispute_status IS DISTINCT FROM 'reported'
      AND t.dispute_status IS DISTINCT FROM 'under_review'
      AND t.payout_status = 'pending'
      AND COALESCE(t.payout_release_at, t.completed_at) <= now()
      AND COALESCE(t.payout_amount_cents, 0) > 0
    ORDER BY t.payout_release_at ASC NULLS FIRST
    LIMIT p_batch_size
  );

  FOR v_rec IN
    SELECT t.id, t.seller_id, COALESCE(t.cash_amount_cents, 0) AS proceeds_cents
    FROM public.trades t
    WHERE t.id = ANY(v_trade_ids)
  LOOP
    UPDATE public.seller_balance sb
    SET available_balance_cents = sb.available_balance_cents + v_rec.proceeds_cents,
        pending_balance_cents = GREATEST(0, sb.pending_balance_cents - v_rec.proceeds_cents),
        updated_at = now()
    WHERE sb.user_id = v_rec.seller_id;

    v_released_count := v_released_count + 1;
  END LOOP;

  -- ── PASS 2 (FIX-Task-62 Fix A) — self-heal stranded `requires_action` rows ──
  -- FAIL-CLOSED kill switch (D2). Dispatches real money.
  IF COALESCE(public.fn_admin_config_int('payout_requeue_enabled', 0), 0) = 1 THEN

    -- ── D2 PRECONDITION ────────────────────────────────────────────────────
    -- Evaluate BEFORE the candidate selection, over each seller's FULL parked
    -- set (not the batch), so the outcome is stable across hourly runs and
    -- across batch boundaries.
    SELECT
      COALESCE(jsonb_agg(s.record), '[]'::jsonb),
      COALESCE(array_agg(s.seller_id), ARRAY[]::uuid[])
    INTO v_settled_review, v_settled_sellers
    FROM (
      SELECT
        pk.user_id AS seller_id,
        jsonb_build_object(
          'seller_id',            pk.user_id,
          'parked_count',         pk.parked_count,
          'parked_total_cents',   pk.parked_total_cents,
          'matched_payout_id',    man.id,
          'matched_amount_cents', man.gross_amount_cents,
          'matched_completed_at', man.completed_at,
          -- Names the WRITER of the matched row (`manual_withdrawal:<seller>:<ts>`
          -- when it came from the app's withdraw flow) — the fact a reviewer needs
          -- to tell a real prior settlement from a coincidence.
          'matched_idempotency_key', man.idempotency_key,
          'reason',               'completed trade-less payout equals the parked total — presumed prior settlement'
        ) AS record
      FROM (
        SELECT sp.user_id,
               SUM(sp.gross_amount_cents)::integer AS parked_total_cents,
               COUNT(*)::integer                   AS parked_count
        FROM public.seller_payouts sp
        WHERE sp.status = 'requires_action'
        GROUP BY sp.user_id
      ) pk
      JOIN LATERAL (
        SELECT m.id, m.gross_amount_cents, m.completed_at, m.idempotency_key
        FROM public.seller_payouts m
        WHERE m.user_id = pk.user_id
          AND m.status = 'completed'
          AND m.trade_id IS NULL          -- trade-less ⇒ a manual/aggregate payout
          AND m.gross_amount_cents > 0
          AND m.gross_amount_cents = pk.parked_total_cents
        ORDER BY m.completed_at DESC NULLS LAST, m.id
        LIMIT 1
      ) man ON TRUE
    ) s;

    v_skipped_count := COALESCE(array_length(v_settled_sellers, 1), 0);

    -- Flag every skipped seller for human review on the admin /audit journal.
    -- Idempotent per seller: the deterministic key means the hourly sweep writes
    -- exactly one row, no matter how long the seller stays blocked.
    IF v_skipped_count > 0 THEN
      FOR v_rec IN
        SELECT value AS record FROM jsonb_array_elements(v_settled_review)
      LOOP
        PERFORM public.fn_log_financial_audit(
          p_mutation_type   => 'payout_requeue_skipped',
          p_entity_type     => 'payout',
          p_entity_id       => (v_rec.record->>'matched_payout_id')::uuid,
          -- amount_cents intentionally NULL: nothing moved (see header note).
          p_after_state     => v_rec.record,
          p_idempotency_key => 'payout_requeue_skipped_' || (v_rec.record->>'seller_id')
        );
      END LOOP;
    END IF;

    -- ── candidate selection, minus the presumptively-settled sellers ───────
    v_requeue_ids := ARRAY(
      SELECT t.id
      FROM public.trades t
      WHERE t.status = 'completed'
        AND t.dispute_status IS DISTINCT FROM 'reported'
        AND t.dispute_status IS DISTINCT FROM 'under_review'
        AND t.payout_status = 'requires_action'
        AND COALESCE(t.payout_release_at, t.completed_at) <= now()
        AND COALESCE(t.payout_amount_cents, 0) > 0
        AND EXISTS (
          SELECT 1
          FROM public.seller_payout_methods m
          WHERE m.user_id = t.seller_id
            AND m.is_primary = TRUE
            AND m.is_verified = TRUE
        )
        -- D2: never requeue a seller whose parked proceeds were probably already
        -- paid out manually. `= ANY(empty array)` is FALSE, so an empty
        -- exclusion set leaves the selection exactly as it was.
        AND NOT (t.seller_id = ANY(v_settled_sellers))
      ORDER BY t.payout_release_at ASC NULLS FIRST
      LIMIT p_batch_size
    );

    v_requeued_count := COALESCE(array_length(v_requeue_ids, 1), 0);

    -- Descriptive backfill only (no status, amount or balance change).
    IF v_requeued_count > 0 THEN
      UPDATE public.seller_payouts sp
      SET payout_method_id = m.id,
          provider         = CASE m.method_type
                               WHEN 'stripe_connect' THEN 'stripe'
                               WHEN 'paypal'         THEN 'paypal'
                               WHEN 'venmo'          THEN 'paypal'
                               WHEN 'bank_ach'       THEN 'ach'
                             END,
          updated_at       = now()
      FROM public.trades t
      JOIN public.seller_payout_methods m
        ON m.user_id = t.seller_id
       AND m.is_primary = TRUE
       AND m.is_verified = TRUE
      WHERE t.id = ANY(v_requeue_ids)
        AND sp.trade_id = t.id
        AND sp.status = 'requires_action';
    END IF;

  ELSE
    RAISE NOTICE 'rpc_release_due_payouts: pass 2 DISABLED (payout_requeue_enabled=0); % requires_action trade(s) left parked — see FIX-Task-62 report §12',
      (SELECT count(*) FROM public.trades t
        WHERE t.status = 'completed'
          AND t.payout_status = 'requires_action'
          AND COALESCE(t.payout_amount_cents, 0) > 0);
  END IF;

  RETURN jsonb_build_object(
    'success',                  true,
    'released_count',           v_released_count,
    'requeued_count',           v_requeued_count,
    'skipped_count',            v_skipped_count,
    'skipped_presumed_settled', v_settled_review,
    'trade_ids',                COALESCE(v_trade_ids, ARRAY[]::uuid[]) || v_requeue_ids,
    'requeued_trade_ids',       v_requeue_ids,
    'processed_at',             now()
  );
END;
$$;

-- BP-79 — re-assert the grants stripped by the CREATE OR REPLACE above
-- (dt61_guard_revoke_fn_public fires on the replace path and the original
-- GRANTs are not replayed).
REVOKE ALL ON FUNCTION public.rpc_release_due_payouts(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_release_due_payouts(integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_release_due_payouts(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_release_due_payouts(integer) TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (one statement per call — result-granularity rule)
-- ============================================================================
-- V1 — the D2 guard is in the live body (expect true):
--   SELECT prosrc LIKE '%payout_requeue_skipped%' AS has_d2_guard,
--          prosrc LIKE '%v_settled_sellers%'      AS has_exclusion
--   FROM pg_proc WHERE oid = 'public.rpc_release_due_payouts(integer)'::regprocedure;
-- V2 — the new mutation type is accepted by the journal CHECK (expect 1 row, no error):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'financial_audit_log_mutation_type_check';
-- V3 — grants still service_role-only (BP-79):
--   SELECT array_to_string(proacl, ' | ') FROM pg_proc
--   WHERE oid = 'public.rpc_release_due_payouts(integer)'::regprocedure;
-- V4 — the presumptively-settled sellers in the B2 incident shape (expect the
--      seller only while parked rows remain; 0 after the manual payout is the
--      sole settlement record and the parked rows were paid):
--   SELECT pk.user_id, SUM(pk.gross_amount_cents) AS parked_total
--   FROM public.seller_payouts pk WHERE pk.status = 'requires_action'
--   GROUP BY pk.user_id
--   HAVING EXISTS (SELECT 1 FROM public.seller_payouts m
--                  WHERE m.user_id = pk.user_id AND m.status = 'completed'
--                    AND m.trade_id IS NULL
--                    AND m.gross_amount_cents = SUM(pk.gross_amount_cents));
-- V5 — any skip flags already raised (expect [] today; rows are one-per-seller):
--   SELECT created_at, entity_id, after_state FROM public.financial_audit_log
--   WHERE mutation_type = 'payout_requeue_skipped' ORDER BY created_at DESC;
-- NOTE: do NOT invoke this function by hand to "check" it. Pass 1 moves
-- seller_balance pending → available WITHOUT dispatching, so a manual call would
-- make the next Edge-Function run credit those trades twice. Gate + D2 behaviour
-- are proven in the local harness (local-harness/10-tests.sql T11–T14).
-- ============================================================================
