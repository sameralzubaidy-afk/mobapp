-- File: supabase/migrations/20260819000001_enforce_phone_verification_on_items_insert.sql
-- AUTH-V3-008 (server-side backstop): Block items INSERT from phone-unverified sellers
--
-- Mode: B (idempotent rerunnable migration)
--
-- WHY (owner summary):
--   QA (E05, 2026-08-18) triple-corroborated that the phone-verification gate
--   protecting first listings was dead code on the client: the `isPhoneRequired`
--   check lived inside `if (!canPublish())` while the Publish button is
--   `disabled={!canPublish()}`, so the gate never fired — an unverified seller
--   could publish listings with zero phone verification. This migration adds the
--   server-side belt-and-suspenders: a BEFORE INSERT trigger on `public.items`
--   that REJECTS the insert for a non-admin seller lacking `phone_verified_at`.
--
-- DESIGN / SCOPING (which insert paths are gated vs allowed):
--   * GATED: normal seller-authenticated inserts ONLY — when
--       auth.uid() IS NOT NULL AND auth.uid() = NEW.seller_id
--     (the app's createListing / bulk-publish path, which uses the user JWT).
--   * ALLOWED (bypass): every service_role insert — auth.uid() is NULL, so the
--     gate branch is skipped. This covers admin-portal writes, seed scripts
--     (scripts/seed-staging-data.ts inserts via adminSupabase service key),
--     and Edge Functions using the service role.
--   * ALLOWED: admin users (public.admin_has_role) even when acting as an
--     authenticated seller in the mobile app — they manage listings via the
--     admin portal and must not be locked out.
--   * NOT GATED: UPDATE/DELETE (verification is a listing-creation gate only).
--
-- Enforcement mechanism chosen: TRIGGER (not an RLS `with check` policy).
--   Rationale: (1) matches the established items-insert guard pattern
--   (`fn_items_enforce_pending_for_starter_pack`, COPPA `check_coppa_before_item_insert`);
--   (2) a SECURITY DEFINER trigger can read `public.profiles.phone_verified_at`
--   regardless of the caller's RLS context; (3) it raises a structured, parseable
--   exception (SQLSTATE P0001) that the mobile client can surface verbatim,
--   instead of a generic RLS "new row violates row-level security policy".
--
-- Common failure modes (and how this avoids them):
--   * Breaking seed/admin/Edge Function inserts -> scoped to auth.uid() present
--     AND equal to NEW.seller_id (service_role has no auth.uid()).
--   * admin_has_role missing in an env -> guarded with to_regprocedure before call.
--   * Audit-log failure swallowing the block -> best-effort BEGIN/EXCEPTION that
--     re-raises a WARNING, never prevents the RAISE (COPPA precedent).
--   * Client error copy referencing a hardcoded rule -> the exception code
--     PHONE_VERIFICATION_REQUIRED lets the client show the right message.

-- ---------------------------------------------------------------------------
-- BLOCK 1 — Helper: is the seller's phone verified? (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_phone_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER required: must read public.profiles regardless of caller RLS.
DECLARE
  v_phone_verified_at TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.phone_verified_at
    INTO v_phone_verified_at
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  -- No profile row / no verified phone -> not verified (fail closed).
  RETURN v_phone_verified_at IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.is_phone_verified(UUID) IS
  'AUTH-V3-008: Returns TRUE when the user has a verified phone (profiles.phone_verified_at IS NOT NULL). Fail-closed when profile/phone missing.';

GRANT EXECUTE ON FUNCTION public.is_phone_verified(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 1 (cont) — Gate trigger: reject items INSERT for unverified sellers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_phone_verified_on_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Scope: normal authenticated seller inserts only. service_role (admin portal,
  -- seed scripts, Edge Functions) has no auth.uid() and bypasses this gate.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.seller_id THEN
    -- Admins are exempt (they manage listings via the admin portal anyway).
    IF to_regprocedure('public.admin_has_role(uuid)') IS NOT NULL
       AND public.admin_has_role(NEW.seller_id) THEN
      RETURN NEW;
    END IF;

    IF NOT public.is_phone_verified(NEW.seller_id) THEN
      -- Best-effort audit log (must NEVER prevent the block from firing).
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'phone_verification_gate',
          'items INSERT blocked: seller has no verified phone',
          jsonb_build_object(
            'user_id', NEW.seller_id,
            'item_id', NEW.id,
            'title', NEW.title,
            'blocked_at', NOW()
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'phone_verification_gate audit log failed: %', SQLERRM;
      END;

      RAISE EXCEPTION 'PHONE_VERIFICATION_REQUIRED: Please verify your phone number before publishing a listing.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_phone_verified_on_item_insert() IS
  'AUTH-V3-008: BEFORE INSERT trigger on public.items. Rejects inserts from non-admin, phone-unverified sellers (PHONE_VERIFICATION_REQUIRED, SQLSTATE P0001). Scoped to auth.uid() = NEW.seller_id; service_role and admins bypass.';

DROP TRIGGER IF EXISTS trg_items_enforce_phone_verified ON public.items;
CREATE TRIGGER trg_items_enforce_phone_verified
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_phone_verified_on_item_insert();

-- ---------------------------------------------------------------------------
-- BLOCK 2 — Verification queries (run one statement per call)
-- ---------------------------------------------------------------------------
-- 1) Trigger live + enabled:
--    SELECT tgname, tgenabled
--    FROM pg_trigger
--    WHERE tgrelid = 'public.items'::regclass AND tgname = 'trg_items_enforce_phone_verified';
--
-- 2) Helper function exists:
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('is_phone_verified', 'enforce_phone_verified_on_item_insert');
--
-- 3) Allowed-insert case (verified seller): expect the insert to succeed
--    (swap in a seller whose profiles.phone_verified_at IS NOT NULL):
--    SELECT public.is_phone_verified('<verified-seller-uuid>');  -- expect true
--
-- 4) Blocked-insert case (unverified seller): expect PHONE_VERIFICATION_REQUIRED.
--    NOTE: auth.uid() must be set to the seller for the gate to fire, so this is
--    best exercised from the app (or a test that sets the request JWT):
--    SELECT count(*) FROM public.items WHERE seller_id = '<unverified-seller-uuid>';
--
-- 5) Rerun safety: re-running this whole file is a no-op (CREATE OR REPLACE +
--    DROP TRIGGER IF EXISTS + CREATE TRIGGER).
