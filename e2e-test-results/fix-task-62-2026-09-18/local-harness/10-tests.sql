-- =============================================================================
-- FIX-Task-62 — LOCAL harness, part 2 of 2 (ASSERTIONS).
--
-- Assumes 00-setup.sql and the FIX-Task-62 migration have already been applied to
-- this throwaway local database. Every scenario uses its own user_id so cases
-- cannot contaminate each other.
--
-- NOTE ON ISOLATION: the sweep is cumulative — a trade left in `requires_action`
-- correctly reappears on every later call (that is the whole point: it is
-- re-evaluated hourly until initiate-payout pays it). Assertions therefore test
-- MEMBERSHIP and PER-ROW EFFECT, never a global count.
--
-- FIX-Task-62 (D2): pass 2 is fail-closed behind `payout_requeue_enabled`, seeded
-- '0' by the gated migration. T0-T10 exercise the sweep's behaviour, so they run
-- with the switch ON; T11/T12 prove the switch itself (off/on); T13/T14 prove the
-- D2 "proceeds already settled" precondition (skip-on-exact-match / still-pay on
-- non-match).
-- =============================================================================

UPDATE public.admin_config SET value = '1' WHERE key = 'payout_requeue_enabled';

-- ---------------------------------------------------------------------------
-- T0 — the COALESCE guard: with nothing eligible, `trade_ids` must still be an
--      ARRAY (a NULL there would silently stop pass-1 dispatch in the EF).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T0',
    'no eligible trades  =>  trade_ids is an empty ARRAY (never NULL), both counts 0',
    format('trade_ids=%s type=%s released=%s requeued=%s',
           v_result->'trade_ids', jsonb_typeof(v_result->'trade_ids'),
           v_result->>'released_count', v_result->>'requeued_count'),
    CASE WHEN jsonb_typeof(v_result->'trade_ids') = 'array'
              AND jsonb_array_length(v_result->'trade_ids') = 0
              AND (v_result->>'released_count')::int = 0
              AND (v_result->>'requeued_count')::int = 0
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T1 — THE core fix: a parked payout whose seller is NOW payable and whose release
--      date has passed is handed to the dispatcher, and the descriptive columns are
--      backfilled — WITHOUT changing the payout status (Fix B makes it payable).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid    UUID := gen_random_uuid();
  v_mid    UUID;
  v_trade  UUID := gen_random_uuid();
  v_result jsonb;
  v_row    RECORD;
  v_listed BOOLEAN;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_qa_payable') RETURNING id INTO v_mid;

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() - interval '10 weeks',
          now() - interval '10 weeks', 5000, 5000);

  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents)
  VALUES (v_uid, v_trade, 'requires_action', 5000, 5000);

  INSERT INTO public.seller_balance (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_uid, 0, 0);

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
    WHERE e = v_trade::text
  ) AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_result->'trade_ids') AS e
    WHERE e = v_trade::text
  ) INTO v_listed;

  SELECT sp.payout_method_id, sp.provider, sp.status INTO v_row
  FROM public.seller_payouts sp WHERE sp.trade_id = v_trade;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T1',
    'payable seller + requires_action + due  =>  dispatched, method backfilled, status untouched',
    format('listed=%s method_backfilled=%s provider=%s status=%s',
           v_listed, v_row.payout_method_id IS NOT NULL, v_row.provider, v_row.status),
    CASE WHEN v_listed
              AND v_row.payout_method_id = v_mid
              AND v_row.provider = 'stripe'
              AND v_row.status = 'requires_action'
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T2 — NEGATIVE CONTROL: a seller with NO method must stay parked (this is the
--      test-seller case, and it is CORRECT behaviour, not a bug).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid    UUID := gen_random_uuid();
  v_trade  UUID := gen_random_uuid();
  v_result jsonb;
  v_listed BOOLEAN;
BEGIN
  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() - interval '1 day',
          now() - interval '1 day', 3000, 3000);

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
    WHERE e = v_trade::text
  ) INTO v_listed;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T2',
    'no payout method at all  =>  NOT requeued (stays parked)',
    format('listed=%s', v_listed),
    CASE WHEN NOT v_listed THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T3 — NEGATIVE CONTROL: an UNVERIFIED (or non-primary) method must not unlock a
--      payout. Mirrors the auto-promote guard (FIX-Task-56) — never pay an
--      unverified destination.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid     UUID := gen_random_uuid();
  v_trade_a UUID := gen_random_uuid();
  v_trade_b UUID := gen_random_uuid();
  v_result  jsonb;
  v_a       BOOLEAN;
  v_b       BOOLEAN;
BEGIN
  -- (a) a single method that is primary but NOT verified
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, FALSE, 'acct_unverified');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade_a, v_uid, 'completed', 'requires_action', now() - interval '1 day',
          now() - interval '1 day', 1000, 1000);

  -- (b) a verified but NON-primary method
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (gen_random_uuid(), FALSE, TRUE, 'acct_verified_not_primary');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  SELECT v_trade_b, spm.user_id, 'completed', 'requires_action', now() - interval '1 day',
         now() - interval '1 day', 1000, 1000
  FROM public.seller_payout_methods spm
  WHERE spm.stripe_account_id = 'acct_verified_not_primary';

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e WHERE e = v_trade_a::text) INTO v_a;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e WHERE e = v_trade_b::text) INTO v_b;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T3',
    'primary-but-unverified / verified-but-not-primary  =>  NEITHER requeued',
    format('unverified_listed=%s nonprimary_listed=%s', v_a, v_b),
    CASE WHEN NOT v_a AND NOT v_b THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T4 — never dispatch early: a payable seller whose release date is still in the
--      FUTURE must not be handed to the dispatcher.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid    UUID := gen_random_uuid();
  v_trade  UUID := gen_random_uuid();
  v_result jsonb;
  v_listed BOOLEAN;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_future_release');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() + interval '2 days',
          now(), 4000, 4000);

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e WHERE e = v_trade::text) INTO v_listed;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T4',
    'release date still in the future  =>  NOT requeued (no early payout)',
    format('listed=%s', v_listed),
    CASE WHEN NOT v_listed THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T5 — BALANCE NEUTRALITY (the double-credit trap). Pass 2 must not move a cent:
--      the completion trigger already credited these trades.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid        UUID := gen_random_uuid();
  v_trade      UUID := gen_random_uuid();
  v_before_a   INTEGER;
  v_before_p   INTEGER;
  v_after_a    INTEGER;
  v_after_p    INTEGER;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_balance_neutral');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() - interval '3 days',
          now() - interval '3 days', 7000, 7000);

  -- Deliberately a shape seen live: available 0, pending 0, lifetime 20500.
  INSERT INTO public.seller_balance (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_uid, 0, 0);

  SELECT sb.available_balance_cents, sb.pending_balance_cents
    INTO v_before_a, v_before_p
  FROM public.seller_balance sb WHERE sb.user_id = v_uid;

  PERFORM public.rpc_release_due_payouts(100);

  SELECT sb.available_balance_cents, sb.pending_balance_cents
    INTO v_after_a, v_after_p
  FROM public.seller_balance sb WHERE sb.user_id = v_uid;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T5',
    'pass 2 is balance-neutral  =>  available and pending UNCHANGED',
    format('available %s->%s  pending %s->%s', v_before_a, v_after_a, v_before_p, v_after_p),
    CASE WHEN v_before_a = v_after_a AND v_before_p = v_after_p THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T6 — REGRESSION: pass 1 must be untouched. A due `pending` payout is still
--      released (balance pending → available) and returned for dispatch.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid    UUID := gen_random_uuid();
  v_trade  UUID := gen_random_uuid();
  v_result jsonb;
  v_listed BOOLEAN;
  v_avail  INTEGER;
  v_pend   INTEGER;
BEGIN
  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'pending', now() - interval '1 hour',
          now() - interval '3 days', 2000, 2000);

  INSERT INTO public.seller_balance (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_uid, 0, 2000);

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'trade_ids') AS e WHERE e = v_trade::text) INTO v_listed;
  SELECT sb.available_balance_cents, sb.pending_balance_cents INTO v_avail, v_pend
  FROM public.seller_balance sb WHERE sb.user_id = v_uid;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T6',
    'pass 1 unchanged: due pending payout still released + dispatched',
    format('listed=%s available=%s pending=%s released_count=%s', v_listed, v_avail, v_pend, v_result->>'released_count'),
    CASE WHEN v_listed AND v_avail = 2000 AND v_pend = 0 THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T7 — IDEMPOTENCE: a second consecutive run must not duplicate, mutate state or
--      move balances. (Re-dispatch is intended until initiate-payout pays; the
--      transfer itself is guarded by the Stripe idempotency key `payout-<trade>`.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid       UUID := gen_random_uuid();
  v_trade     UUID := gen_random_uuid();
  v_rows      INTEGER;
  v_status    TEXT;
  v_avail     INTEGER;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_idempotence');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() - interval '5 days',
          now() - interval '5 days', 6000, 6000);

  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents)
  VALUES (v_uid, v_trade, 'requires_action', 6000, 6000);

  INSERT INTO public.seller_balance (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_uid, 0, 0);

  PERFORM public.rpc_release_due_payouts(100);
  PERFORM public.rpc_release_due_payouts(100);

  SELECT count(*) INTO v_rows FROM public.seller_payouts sp WHERE sp.trade_id = v_trade;
  SELECT sp.status INTO v_status FROM public.seller_payouts sp WHERE sp.trade_id = v_trade;
  SELECT sb.available_balance_cents INTO v_avail FROM public.seller_balance sb WHERE sb.user_id = v_uid;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T7',
    'two consecutive runs  =>  still exactly 1 payout row, no balance move',
    format('rows=%s status=%s available=%s', v_rows, v_status, v_avail),
    CASE WHEN v_rows = 1 AND v_status = 'requires_action' AND v_avail = 0
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T8 — Fix E (trigger): deleting a trade terminalises its never-submitted payouts
--      with reason 'trade_deleted', and leaves alone (i) a submitted 'processing'
--      row and (ii) any row that already carries a provider reference.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid   UUID := gen_random_uuid();
  v_trade UUID := gen_random_uuid();
  v_park  TEXT;
  v_proc  TEXT;
  v_ref   TEXT;
  v_fk    UUID;
BEGIN
  INSERT INTO public.trades (id, seller_id, status, payout_status, completed_at,
                             payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now(), 1000, 1000);

  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents)
  VALUES (v_uid, v_trade, 'requires_action', 1000, 1000);
  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents, provider)
  VALUES (v_uid, v_trade, 'processing', 2000, 2000, 'stripe');
  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents,
                                     provider, provider_reference_id)
  VALUES (v_uid, v_trade, 'pending', 3000, 3000, 'stripe', 'tr_already_sent');

  DELETE FROM public.trades WHERE id = v_trade;

  SELECT sp.status INTO v_park FROM public.seller_payouts sp WHERE sp.gross_amount_cents = 1000 AND sp.user_id = v_uid;
  SELECT sp.status INTO v_proc FROM public.seller_payouts sp WHERE sp.gross_amount_cents = 2000 AND sp.user_id = v_uid;
  SELECT sp.status INTO v_ref  FROM public.seller_payouts sp WHERE sp.gross_amount_cents = 3000 AND sp.user_id = v_uid;
  SELECT sp.trade_id INTO v_fk FROM public.seller_payouts sp WHERE sp.gross_amount_cents = 1000 AND sp.user_id = v_uid;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T8',
    'trade delete  =>  parked row failed/trade_deleted; processing + transferred rows untouched',
    format('parked=%s processing=%s transferred=%s trade_id=%s', v_park, v_proc, v_ref, v_fk),
    CASE WHEN v_park = 'failed' AND v_proc = 'processing' AND v_ref = 'pending' AND v_fk IS NULL
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T9 — Fix E (backfill, asserted on the PRE-SEEDED rows): the already-orphaned
--      parked payout is terminalised, while a legitimate trade-less MANUAL
--      withdrawal in 'processing' is left for `dispatch-manual-payouts`.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_orphan      TEXT;
  v_orphan_body TEXT;
  v_manual      TEXT;
BEGIN
  SELECT sp.status, sp.failure_reason INTO v_orphan, v_orphan_body
  FROM public.seller_payouts sp WHERE sp.id = '11111111-1111-1111-1111-111111111111';

  SELECT sp.status INTO v_manual
  FROM public.seller_payouts sp WHERE sp.id = '22222222-2222-2222-2222-222222222222';

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T9',
    'backfill: orphaned parked row => failed/trade_deleted; manual processing row UNTOUCHED',
    format('orphan=%s reason=%s manual=%s', v_orphan, v_orphan_body, v_manual),
    CASE WHEN v_orphan = 'failed' AND v_orphan_body = 'trade_deleted' AND v_manual = 'processing'
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T10 — BP-79: the replaced function must end up with service_role-only EXECUTE
--       (the dt61 guard strips the rest; this harness proves the RE-ASSERT works).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_acl TEXT;
BEGIN
  SELECT coalesce(array_to_string(p.proacl, ' | '), '(null = default PUBLIC EXECUTE)')
    INTO v_acl
  FROM pg_proc p
  WHERE p.oid = 'public.rpc_release_due_payouts(integer)'::regprocedure;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T10',
    'grants re-asserted: service_role only, no anon/authenticated/PUBLIC',
    v_acl,
    CASE WHEN v_acl LIKE '%service_role=%'
              AND v_acl NOT LIKE '%anon=%'
              AND v_acl NOT LIKE '%authenticated=%'
              AND v_acl NOT LIKE '%{=X%'
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T11 — D2 KILL SWITCH, off (the seeded default): a fully-eligible row must NOT be
--       dispatched. This is the assertion that would have prevented the $205
--       double-payment in report §12.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid     UUID := gen_random_uuid();
  v_trade   UUID := gen_random_uuid();
  v_result  jsonb;
  v_listed  BOOLEAN;
  v_flag    TEXT;
BEGIN
  UPDATE public.admin_config SET value = '0' WHERE key = 'payout_requeue_enabled';
  SELECT ac.value INTO v_flag FROM public.admin_config ac WHERE ac.key = 'payout_requeue_enabled';

  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_kill_switch');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() - interval '1 day',
          now() - interval '1 day', 9000, 9000);

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
                 WHERE e = v_trade::text) INTO v_listed;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T11',
    'kill switch OFF  =>  even a fully-eligible row is NOT dispatched',
    format('flag=%s listed=%s requeued_count=%s', v_flag, v_listed, v_result->>'requeued_count'),
    CASE WHEN v_flag = '0' AND NOT v_listed AND (v_result->>'requeued_count')::int = 0
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T12 — D2 KILL SWITCH, on: the same row is dispatched once the flag is set.
--       (Proves the gate is a switch, not a disablement of the feature.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid    UUID := gen_random_uuid();
  v_trade  UUID := gen_random_uuid();
  v_result jsonb;
  v_listed BOOLEAN;
BEGIN
  UPDATE public.admin_config SET value = '1' WHERE key = 'payout_requeue_enabled';

  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_kill_switch_on');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES (v_trade, v_uid, 'completed', 'requires_action', now() - interval '1 day',
          now() - interval '1 day', 9000, 9000);

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
                 WHERE e = v_trade::text) INTO v_listed;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T12',
    'kill switch ON  =>  the same eligible row IS dispatched',
    format('listed=%s', v_listed),
    CASE WHEN v_listed THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T13 — D2 NEGATIVE CONTROL (the shape that double-paid $205.00 in report §12).
--       A payable seller with 3 parked payouts totalling exactly $150.00 AND a
--       completed, trade-less manual payout of exactly $150.00 must be:
--         (a) NOT requeued at all,
--         (b) reported in `skipped_presumed_settled`,
--         (c) flagged ONCE on the audit journal (and still once after a re-run),
--         (d) left with every row parked and no balance movement.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid          UUID := gen_random_uuid();
  v_method       UUID;
  v_matched      UUID := gen_random_uuid();
  v_trade_a      UUID := gen_random_uuid();
  v_trade_b      UUID := gen_random_uuid();
  v_trade_c      UUID := gen_random_uuid();
  v_result       jsonb;
  v_dispatched   BOOLEAN;
  v_flag         jsonb;
  v_flags        INTEGER;
  v_audit_amount INTEGER;
  v_audit_entity UUID;
  v_audit_second INTEGER;
  v_parked_left  INTEGER;
  v_avail_before INTEGER;
  v_avail_after  INTEGER;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_d2_presumed_settled') RETURNING id INTO v_method;

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES
    (v_trade_a, v_uid, 'completed', 'requires_action', now() - interval '10 weeks',
     now() - interval '10 weeks', 5000, 5000),
    (v_trade_b, v_uid, 'completed', 'requires_action', now() - interval '10 weeks',
     now() - interval '10 weeks', 5000, 5000),
    (v_trade_c, v_uid, 'completed', 'requires_action', now() - interval '10 weeks',
     now() - interval '10 weeks', 5000, 5000);

  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents)
  VALUES
    (v_uid, v_trade_a, 'requires_action', 5000, 5000),
    (v_uid, v_trade_b, 'requires_action', 5000, 5000),
    (v_uid, v_trade_c, 'requires_action', 5000, 5000);

  -- The prior settlement: completed, trade_id NULL (a manual/aggregate payout),
  -- gross exactly equal to the parked total. Same shape as live row `082d46d6…`.
  INSERT INTO public.seller_payouts
    (id, user_id, trade_id, status, gross_amount_cents, net_amount_cents,
     completed_at, provider, provider_reference_id)
  VALUES
    (v_matched, v_uid, NULL, 'completed', 15000, 15000,
     now() - interval '12 days', 'stripe', 'tr_d2_manual_settlement');

  INSERT INTO public.seller_balance (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_uid, 0, 0);

  SELECT sb.available_balance_cents INTO v_avail_before
  FROM public.seller_balance sb WHERE sb.user_id = v_uid;

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
    WHERE e.value IN (v_trade_a::text, v_trade_b::text, v_trade_c::text)
  ) INTO v_dispatched;

  SELECT s.value INTO v_flag
  FROM jsonb_array_elements(v_result->'skipped_presumed_settled') AS s
  WHERE (s.value->>'seller_id')::uuid = v_uid
  LIMIT 1;

  SELECT count(*), min(fal.amount_cents), (array_agg(fal.entity_id))[1]
    INTO v_flags, v_audit_amount, v_audit_entity
  FROM public.financial_audit_log fal
  WHERE fal.mutation_type = 'payout_requeue_skipped'
    AND fal.idempotency_key = 'payout_requeue_skipped_' || v_uid::text;

  -- A second hourly run must not add a second flag row.
  PERFORM public.rpc_release_due_payouts(100);

  SELECT count(*) INTO v_audit_second
  FROM public.financial_audit_log fal
  WHERE fal.mutation_type = 'payout_requeue_skipped'
    AND fal.idempotency_key = 'payout_requeue_skipped_' || v_uid::text;

  SELECT count(*) INTO v_parked_left
  FROM public.seller_payouts sp
  WHERE sp.user_id = v_uid AND sp.status = 'requires_action';

  SELECT sb.available_balance_cents INTO v_avail_after
  FROM public.seller_balance sb WHERE sb.user_id = v_uid;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T13',
    'D2 negative control: parked $150 total + matching completed trade-less payout => NOT requeued, flagged once, nothing moved',
    format('dispatched=%s flagged=%s parked_total=%s matched_ok=%s audit_rows=%s audit_amount=%s audit_entity_ok=%s audit_after_rerun=%s parked_left=%s available %s->%s',
           v_dispatched,
           v_flag IS NOT NULL,
           v_flag->>'parked_total_cents',
           (v_flag->>'matched_payout_id')::uuid = v_matched,
           v_flags, v_audit_amount,
           v_audit_entity = v_matched,
           v_audit_second,
           v_parked_left,
           v_avail_before, v_avail_after),
    CASE WHEN NOT v_dispatched
              AND v_flag IS NOT NULL
              AND (v_flag->>'parked_total_cents')::int = 15000
              AND (v_flag->>'parked_count')::int = 3
              AND (v_flag->>'matched_payout_id')::uuid = v_matched
              AND v_flags = 1
              AND v_audit_amount IS NULL      -- no money moved => no amount on the journal row
              AND v_audit_entity = v_matched
              AND v_audit_second = 1          -- idempotent: the hourly re-run adds nothing
              AND v_parked_left = 3
              AND v_avail_before = v_avail_after
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T14 — D2 POSITIVE CONTROL: the guard must not become a blanket blocker. A
--       payable seller with the SAME parked total but NO matching manual payout
--       (here: a completed trade-less payout of a DIFFERENT amount) is still
--       requeued in full, with no flag raised.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid         UUID := gen_random_uuid();
  v_trade_a     UUID := gen_random_uuid();
  v_trade_b     UUID := gen_random_uuid();
  v_result      jsonb;
  v_a           BOOLEAN;
  v_b           BOOLEAN;
  v_flag        jsonb;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_primary, is_verified, stripe_account_id)
  VALUES (v_uid, TRUE, TRUE, 'acct_d2_partial_history');

  INSERT INTO public.trades (id, seller_id, status, payout_status, payout_release_at,
                             completed_at, payout_amount_cents, cash_amount_cents)
  VALUES
    (v_trade_a, v_uid, 'completed', 'requires_action', now() - interval '3 days',
     now() - interval '3 days', 4000, 4000),
    (v_trade_b, v_uid, 'completed', 'requires_action', now() - interval '3 days',
     now() - interval '3 days', 4000, 4000);

  INSERT INTO public.seller_payouts (user_id, trade_id, status, gross_amount_cents, net_amount_cents)
  VALUES
    (v_uid, v_trade_a, 'requires_action', 4000, 4000),
    (v_uid, v_trade_b, 'requires_action', 4000, 4000);

  -- Parked total = 8000; this manual payout is 2500 => NOT a presumed match.
  INSERT INTO public.seller_payouts
    (user_id, trade_id, status, gross_amount_cents, net_amount_cents, completed_at, provider)
  VALUES (v_uid, NULL, 'completed', 2500, 2500, now() - interval '30 days', 'stripe');

  SELECT public.rpc_release_due_payouts(100) INTO v_result;

  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
                 WHERE e.value = v_trade_a::text) INTO v_a;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_result->'requeued_trade_ids') AS e
                 WHERE e.value = v_trade_b::text) INTO v_b;

  SELECT s.value INTO v_flag
  FROM jsonb_array_elements(v_result->'skipped_presumed_settled') AS s
  WHERE (s.value->>'seller_id')::uuid = v_uid
  LIMIT 1;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T14',
    'D2 positive control: parked 8000 vs manual 2500 => STILL requeued (guard is not a blanket block)',
    format('a=%s b=%s flagged=%s', v_a, v_b, v_flag IS NOT NULL),
    CASE WHEN v_a AND v_b AND v_flag IS NULL THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T15 — the journal allow-list is WIDENED, never narrowed. Both directions are
--       proven: the new mutation type is accepted, every value the live
--       constraint already carried survives, and an invented type is still
--       REJECTED (proves the CHECK was extended rather than dropped to get green).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_def      text;
  v_accepts  boolean;
  v_rejects  boolean;
  v_witness  boolean;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE n.nspname = 'public' AND r.relname = 'financial_audit_log'
    AND c.conname = 'financial_audit_log_mutation_type_check';

  v_witness := v_def LIKE '%payout_scheduled%'
               AND v_def LIKE '%trade_extension_reauth%'
               AND v_def LIKE '%extension_requested%'
               AND v_def LIKE '%dispute_evidence_staged%';

  BEGIN
    INSERT INTO public.financial_audit_log (mutation_type, idempotency_key)
    VALUES ('payout_requeue_skipped', 'fix62_t15_probe_accepted');
    v_accepts := TRUE;
  EXCEPTION WHEN OTHERS THEN
    v_accepts := FALSE;
  END;

  BEGIN
    INSERT INTO public.financial_audit_log (mutation_type, idempotency_key)
    VALUES ('not_a_real_mutation_type', 'fix62_t15_probe_rejected');
    v_rejects := FALSE;   -- a successful insert means the CHECK is gone/gutted
  EXCEPTION WHEN check_violation THEN
    v_rejects := TRUE;
  END;

  INSERT INTO public.fix62_results (test_id, expectation, observed, verdict)
  VALUES (
    'T15',
    'journal allow-list WIDENED not narrowed: new type accepted, live-only witness values intact, unknown type still rejected',
    format('accepts_new=%s witnesses_intact=%s rejects_unknown=%s',
           v_accepts, v_witness, v_rejects),
    CASE WHEN v_accepts AND v_witness AND v_rejects THEN 'PASS' ELSE 'FAIL' END
  );
END $$;
