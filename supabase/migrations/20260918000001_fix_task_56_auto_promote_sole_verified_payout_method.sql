-- =============================================================================
-- FIX-Task-56 item 2 (2026-09-18) — auto-promote a seller's SOLE VERIFIED payout
-- method to primary.
--
-- PROBLEM
--   Nothing in the system ever promoted a seller's only payout method to primary:
--     * create-stripe-connect-account   inserts is_primary = false, always
--     * sync-stripe-connect-status      sets is_verified, never is_primary
--     * both AddPayoutMethodModal call sites pass set_as_primary: false
--     * set_primary_payout_method       is the ONLY writer of TRUE, and it is
--                                       caller-initiated — it needs a tap the
--                                       user has no reason to know exists
--   A seller who finishes Stripe Connect onboarding therefore lands in
--   "VERIFIED but NOT primary", which breaks TWO things:
--
--     (a) the withdraw guard finds no primary and offers "Add Payout Method" —
--         inviting a DUPLICATE method (the same hazard class FIX-Task-53 item 5
--         fixed on the sibling branch); and
--     (b) the MONEY paths miss them entirely. rpc_create_payout_on_trade_complete
--         looks up `is_primary = TRUE AND is_verified = TRUE` and parks EVERY
--         payout as `requires_action` when it finds none
--         (20260916000110_wire_payout_on_trade_complete.sql:63-90).
--
--   (b) is why this rule lives in the DATABASE and not only in a screen or an
--   Edge Function: a client-side fix would make the UI claim the seller is set
--   up while their earnings kept stranding in `requires_action`.
--
-- THE RULE — the SAME rule set_primary_payout_method already enforces (a payout
-- method may only become primary when it is VERIFIED), extended to the case
-- where exactly one such method exists and nothing is primary yet:
--
--     IF the seller has NO primary
--       AND exactly ONE verified method,
--     THEN that method becomes primary.
--
--   * An UNVERIFIED method is NEVER promoted (asserted in the same pass).
--   * A seller with 2+ verified methods and no primary is deliberately left
--     ALONE — that is an ambiguity only they can resolve, and the withdraw guard
--     already offers them the picker.
--
-- MODE: B — idempotent / rerunnable.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_auto_promote_sole_verified_payout_method
--     ON public.seller_payout_methods;
--   DROP FUNCTION IF EXISTS public.fn_auto_promote_sole_verified_payout_method();
--   DROP FUNCTION IF EXISTS public.promote_sole_verified_payout_method(UUID);
--   The backfill's DATA change is intentionally NOT reverted: every row it moved
--   is now in the state the product wants, and un-promoting them would re-strand
--   their payouts as `requires_action`.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 — the rule, expressed once
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_sole_verified_payout_method(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_count    INTEGER;
  v_verified_count   INTEGER;
  v_sole_verified_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) FILTER (WHERE spm.is_primary),
         count(*) FILTER (WHERE spm.is_verified)
    INTO v_primary_count, v_verified_count
  FROM public.seller_payout_methods spm
  WHERE spm.user_id = p_user_id;

  -- Nothing to do: a primary already exists, or there is no single unambiguous
  -- verified method to promote (0 = nothing verified yet; 2+ = the seller must
  -- choose, and picking one for them is a product decision we are not making).
  IF v_primary_count > 0 OR v_verified_count <> 1 THEN
    RETURN NULL;
  END IF;

  SELECT spm.id
    INTO v_sole_verified_id
  FROM public.seller_payout_methods spm
  WHERE spm.user_id = p_user_id
    AND spm.is_verified = TRUE
  ORDER BY spm.created_at ASC NULLS LAST, spm.id ASC
  LIMIT 1;

  IF v_sole_verified_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Belt-and-braces idempotency: the guard above already established that no
  -- primary exists for this user, so this WHERE can only be false if the row
  -- changed inside this same statement — in which case not writing is correct.
  UPDATE public.seller_payout_methods spm
     SET is_primary = TRUE,
         updated_at = NOW()
   WHERE spm.id = v_sole_verified_id
     AND spm.is_primary IS DISTINCT FROM TRUE;

  RETURN v_sole_verified_id;
END;
$$;

-- BP-78: explicit minimal grants. BP-79: the dt61_guard_revoke_fn_public event
-- trigger fires on CREATE OR REPLACE as well, so these grants must be RE-ASSERTED
-- here rather than assumed to survive from a previous create.
-- service_role only — this is an invariant enforcer reached through the trigger,
-- not a client-callable endpoint.
REVOKE ALL ON FUNCTION public.promote_sole_verified_payout_method(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_sole_verified_payout_method(UUID)
  TO service_role;


-- ---------------------------------------------------------------------------
-- STEP 2 — wire the rule to every write that can create the state
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_promote_sole_verified_payout_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_sqlstate TEXT;
  v_sqlerrm  TEXT;
BEGIN
  -- DELETE is not one of our trigger events, but OLD is still the safe fallback
  -- if this event list is ever widened.
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- SECURITY DEFINER so this runs as its owner even when the write came from a
  -- user JWT: the promotion needs EXECUTE on a service_role-only function and
  -- needs to UPDATE a row the caller's RLS would otherwise constrain.
  BEGIN
    PERFORM public.promote_sole_verified_payout_method(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    -- BP-4: never swallow silently. But also never let an invariant helper break
    -- the caller's write — a raise here would fail the seller's Stripe-onboarding
    -- sync (the very write that just verified them). Log it and carry on; the
    -- next write re-evaluates the rule.
    v_sqlstate := SQLSTATE;
    v_sqlerrm  := SQLERRM;

    -- RAISE WARNING first: it cannot itself fail, so the failure is surfaced even
    -- if the audit write below is what is broken on this database.
    RAISE WARNING 'FIX-Task-56: auto-promote failed for user % — % (%)',
      v_user_id, v_sqlerrm, v_sqlstate;

    BEGIN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'fn_auto_promote_sole_verified_payout_method',
        'auto-promote failed; is_primary left unchanged',
        jsonb_build_object(
          'user_id',  v_user_id,
          'sqlstate', v_sqlstate,
          'sqlerrm',  v_sqlerrm
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- The audit write is best-effort; the RAISE WARNING above already recorded
      -- the original failure, so this cannot hide it.
      NULL;
    END;
  END;

  RETURN NULL;  -- AFTER trigger
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auto_promote_sole_verified_payout_method()
  FROM PUBLIC, anon, authenticated;

-- Events:
--   INSERT              — a method can arrive ALREADY verified (operator writes,
--                         the QA fixture, a restored backup), so the rule has to
--                         apply at creation too, not only on a later flip.
--   UPDATE OF is_verified — the automatic path: sync-stripe-connect-status
--                         turning verification on.
--
-- Fires on the column being in the SET list, which is what makes this safe:
--   * the promotion below sets only is_primary + updated_at, so the
--     `UPDATE OF is_verified` branch cannot re-fire — no recursion by
--     construction. Even if a future edit added is_verified to that SET, the
--     re-entry would find v_primary_count > 0 and return: bounded, not a loop.
--   * deliberately NOT on `UPDATE OF is_primary`, so an explicit unset
--     (updatePayoutMethod({ is_primary: false })) keeps working as asked instead
--     of being instantly undone.
--
-- Interplay with the unique partial index seller_payout_methods_one_primary_idx:
-- this promotion can occupy the single primary slot for a user. Every existing
-- writer that inserts is_primary = TRUE frees the slot first
-- (createPayoutMethod calls unsetPrimaryMethod before inserting), so no conflict
-- arises from shipped code paths.
DROP TRIGGER IF EXISTS trg_auto_promote_sole_verified_payout_method
  ON public.seller_payout_methods;
CREATE TRIGGER trg_auto_promote_sole_verified_payout_method
  AFTER INSERT OR UPDATE OF is_verified
  ON public.seller_payout_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_promote_sole_verified_payout_method();


-- ---------------------------------------------------------------------------
-- STEP 3 — backfill sellers ALREADY sitting in the state (the trigger only
-- covers writes from here on)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_rec            RECORD;
  v_promoted_id    UUID;
  v_promoted_count INTEGER := 0;
  v_user_count     INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT spm.user_id
    FROM public.seller_payout_methods spm
    GROUP BY spm.user_id
    HAVING count(*) FILTER (WHERE spm.is_primary) = 0
       AND count(*) FILTER (WHERE spm.is_verified) = 1
    ORDER BY spm.user_id
  LOOP
    v_user_count := v_user_count + 1;

    v_promoted_id := public.promote_sole_verified_payout_method(v_rec.user_id);

    IF v_promoted_id IS NOT NULL THEN
      v_promoted_count := v_promoted_count + 1;
      RAISE NOTICE 'FIX-Task-56 backfill: promoted method % for user %',
        v_promoted_id, v_rec.user_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'FIX-Task-56 backfill: % seller(s) evaluated, % method(s) promoted',
    v_user_count, v_promoted_count;
END $$;


-- =============================================================================
-- VERIFICATION (SQL-3) — run each statement and read the result.
-- =============================================================================
-- V1. The trigger is attached and enabled.
SELECT tg.tgname AS trigger_name, tg.tgenabled AS enabled
FROM pg_trigger tg
WHERE tg.tgrelid = 'public.seller_payout_methods'::regclass
  AND NOT tg.tgisinternal
  AND tg.tgname = 'trg_auto_promote_sole_verified_payout_method';

-- V2. Both functions exist with the expected signature and are SECURITY DEFINER
--     with a pinned search_path (BP-5).
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef                                AS security_definer,
       p.proconfig                                AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('promote_sole_verified_payout_method',
                    'fn_auto_promote_sole_verified_payout_method');

-- V3. INVARIANT — after this migration NO seller may have "exactly one verified
--     method and no primary". Expect ZERO rows.
SELECT spm.user_id,
       count(*) FILTER (WHERE spm.is_primary)  AS primaries,
       count(*) FILTER (WHERE spm.is_verified) AS verifieds
FROM public.seller_payout_methods spm
GROUP BY spm.user_id
HAVING count(*) FILTER (WHERE spm.is_primary) = 0
   AND count(*) FILTER (WHERE spm.is_verified) = 1;

-- V4. LIVE grants — must be service_role only, with no anon / authenticated /
--     PUBLIC entry (BP-78 / BP-79: audit via aclexplode, never a migration grep).
SELECT p.proname,
       coalesce(array_to_string(p.proacl, ' | '), '(default — REVIEW)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('promote_sole_verified_payout_method',
                    'fn_auto_promote_sole_verified_payout_method');
