-- =============================================================================
-- FIX-Task-56 — LOCAL rule harness, part 2 of 2 (ASSERTIONS).
--
-- Assumes 00-setup.sql and the FIX-Task-56 migration have already been applied to
-- this throwaway local database. Each block records a PASS/FAIL verdict into
-- public.fix56_results; the driver prints them at the end.
--
-- Every scenario gets its own user_id so the cases cannot contaminate each other.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- T1 — THE core rule: a seller's SOLE VERIFIED method, with nothing primary,
--      must be promoted automatically.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid      UUID := gen_random_uuid();
  v_primary  BOOLEAN;
  v_verified BOOLEAN;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, TRUE, FALSE);

  SELECT spm.is_primary, spm.is_verified
    INTO v_primary, v_verified
  FROM public.seller_payout_methods spm
  WHERE spm.user_id = v_uid;

  INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
  VALUES (
    'T1',
    'sole verified + no primary  =>  promoted to primary',
    format('is_primary=%s is_verified=%s', v_primary, v_verified),
    CASE WHEN v_primary AND v_verified THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T2 — the guard the brief called out explicitly: an UNVERIFIED method must NEVER
--      be promoted, even when it is the seller's only method.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid      UUID := gen_random_uuid();
  v_primary  BOOLEAN;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, FALSE, FALSE);

  SELECT spm.is_primary INTO v_primary
  FROM public.seller_payout_methods spm
  WHERE spm.user_id = v_uid;

  INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
  VALUES (
    'T2',
    'sole UNVERIFIED + no primary  =>  NOT promoted (never promote unverified)',
    format('is_primary=%s', v_primary),
    CASE WHEN NOT v_primary THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T3 — an existing primary is left alone when a second verified method arrives.
--      (Regression guard: the rule must not steal the slot from a chosen method.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid       UUID := gen_random_uuid();
  v_chosen_id UUID;
  v_primary_ids UUID[];
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, TRUE, TRUE)
  RETURNING id INTO v_chosen_id;

  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, TRUE, FALSE);

  SELECT array_agg(spm.id) INTO v_primary_ids
  FROM public.seller_payout_methods spm
  WHERE spm.user_id = v_uid AND spm.is_primary;

  INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
  VALUES (
    'T3',
    'existing primary + another verified  =>  still exactly 1 primary, unchanged',
    format('primary_count=%s chosen_still_primary=%s',
           coalesce(array_length(v_primary_ids, 1), 0),
           v_chosen_id = ANY (coalesce(v_primary_ids, ARRAY[]::UUID[]))),
    CASE WHEN array_length(v_primary_ids, 1) = 1
              AND v_chosen_id = ANY (v_primary_ids)
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T4 — TWO verified methods and no primary is a genuine ambiguity, so the rule
--      must leave it ALONE (the seller picks; the withdraw guard offers the
--      picker).
--
--      This state cannot be built through the trigger (the first verified method
--      would be promoted immediately, which is the rule working). So the trigger
--      is disabled to seed it, and the rule is then invoked DIRECTLY — a cleaner
--      test of the rule itself than going through a write.
-- ---------------------------------------------------------------------------
ALTER TABLE public.seller_payout_methods
  DISABLE TRIGGER trg_auto_promote_sole_verified_payout_method;

DO $$
DECLARE
  v_uid          UUID := gen_random_uuid();
  v_primary_cnt  INTEGER;
  v_promoted_id  UUID;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, TRUE, FALSE), (v_uid, TRUE, FALSE);

  v_promoted_id := public.promote_sole_verified_payout_method(v_uid);

  SELECT count(*) INTO v_primary_cnt
  FROM public.seller_payout_methods spm
  WHERE spm.user_id = v_uid AND spm.is_primary;

  INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
  VALUES (
    'T4',
    'TWO verified + no primary  =>  NOT promoted (ambiguous; seller must choose)',
    format('primary_count=%s promote_returned=%s',
           v_primary_cnt, coalesce(v_promoted_id::TEXT, 'NULL')),
    CASE WHEN v_primary_cnt = 0 AND v_promoted_id IS NULL
         THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

ALTER TABLE public.seller_payout_methods
  ENABLE TRIGGER trg_auto_promote_sole_verified_payout_method;

-- ---------------------------------------------------------------------------
-- T5 — an EXPLICIT unset must not be instantly undone. A seller clearing the
--      primary flag (updatePayoutMethod({ is_primary: false })) sends an UPDATE
--      that does not mention is_verified, so the trigger must stay out of the way.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid            UUID := gen_random_uuid();
  v_after_promote  BOOLEAN;
  v_after_unset    BOOLEAN;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, TRUE, FALSE);

  SELECT spm.is_primary INTO v_after_promote
  FROM public.seller_payout_methods spm WHERE spm.user_id = v_uid;

  UPDATE public.seller_payout_methods
     SET is_primary = FALSE
   WHERE user_id = v_uid;

  SELECT spm.is_primary INTO v_after_unset
  FROM public.seller_payout_methods spm WHERE spm.user_id = v_uid;

  INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
  VALUES (
    'T5',
    'explicit unset (is_verified untouched)  =>  stays unset, not re-promoted',
    format('after_promote=%s after_unset=%s', v_after_promote, v_after_unset),
    CASE WHEN v_after_promote AND NOT v_after_unset THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T6 — the rule is a no-op when a primary already exists (idempotency of the
--      helper itself, which is what makes the migration safe to re-run).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid         UUID := gen_random_uuid();
  v_promoted_id UUID;
BEGIN
  INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary)
  VALUES (v_uid, TRUE, TRUE);

  v_promoted_id := public.promote_sole_verified_payout_method(v_uid);

  INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
  VALUES (
    'T6',
    'primary already present  =>  helper returns NULL and changes nothing',
    format('promote_returned=%s', coalesce(v_promoted_id::TEXT, 'NULL')),
    CASE WHEN v_promoted_id IS NULL THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ---------------------------------------------------------------------------
-- T7 (SEED ONLY) — the BACKFILL. The trigger only covers writes from here on, so
--      sellers already stuck must be repaired by the migration's backfill.
--
--      Seed a "legacy" row with the trigger DISABLED, so it sits in the broken
--      state exactly as a pre-existing row would. The driver then RE-APPLIES the
--      migration (which also proves Mode B rerun safety) and the final check
--      records whether the backfill promoted it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.seller_payout_methods
  DISABLE TRIGGER trg_auto_promote_sole_verified_payout_method;

INSERT INTO public.seller_payout_methods (user_id, is_verified, is_primary, method_type)
VALUES ('00000000-0000-0000-0000-0000000000f7', TRUE, FALSE, 'stripe_connect');

ALTER TABLE public.seller_payout_methods
  ENABLE TRIGGER trg_auto_promote_sole_verified_payout_method;

INSERT INTO public.fix56_results (test_id, expectation, observed, verdict)
VALUES (
  'T7-seed',
  'legacy row seeded in the broken state, trigger ON again',
  (SELECT format('is_primary=%s (expected FALSE before re-apply)', spm.is_primary)
   FROM public.seller_payout_methods spm
   WHERE spm.user_id = '00000000-0000-0000-0000-0000000000f7'),
  'INFO'
);
