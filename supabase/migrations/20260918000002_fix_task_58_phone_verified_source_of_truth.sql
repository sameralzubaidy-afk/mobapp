-- File: supabase/migrations/20260918000002_fix_task_58_phone_verified_source_of_truth.sql
-- FIX-Task-58 item 1 — make `profiles.phone_verified_at` the SINGLE SOURCE OF TRUTH
-- for "this account's phone is verified", and turn the legacy `profiles.phone_verified`
-- boolean into a DERIVED MIRROR that can no longer drift away from it.
--
-- Mode: B (idempotent rerunnable migration)
--
-- WHY (owner summary):
--   A QA round found `test-free` with `profiles.phone_verified = true` while
--   `profiles.phone_verified_at IS NULL` — two signals that contradict each other.
--   The listing gate still blocked the account, which proves the two "verified"
--   fields are NOT interchangeable. Tracing every writer showed the boolean is
--   written ALONE (no timestamp) by: `seed:staging`, all 7 QA fixture scripts, and
--   the `verify_user_phone` RPC — while BOTH real gates (client `isPhoneRequired`,
--   server `public.is_phone_verified`) read only `phone_verified_at`.
--   So the boolean was a second, unenforced source of truth that lied to every
--   consumer reading it (admin user detail, the Edit Profile "already verified"
--   branch, the `AuthSession` signature).
--
-- DECISION (which field wins): `profiles.phone_verified_at`.
--   Rationale: it is already what both gates read, it is what the real
--   verification paths (`phoneService.verifyPhoneCode`, `profile.ts`) write, and a
--   non-null timestamp is self-consistent (the boolean cannot be checked against
--   itself). `auth.users.phone` is deliberately NOT part of this invariant — it is
--   GoTrue's own record of the number the phone-CHANGE flow set, it is written by a
--   different surface (`auth-update-phone` EF), and it is legitimately NULL for a
--   seed-provisioned account. Consumers must stop treating it as a verification
--   signal (fixed in the same change: `EditProfileScreen.startPhoneVerificationFlow`).
--
-- DESIGN (why a trigger that COERCES rather than a CHECK that REJECTS):
--   A `CHECK (phone_verified = (phone_verified_at IS NOT NULL))` would make any
--   writer that sets the boolean alone FAIL LOUDLY — but those writers include
--   seed/fixture provisioning paths, so a fresh `seed:staging` would abort
--   part-way and leave staging half-provisioned. A BEFORE trigger that derives the
--   mirror is self-healing instead: every existing writer automatically produces
--   the consistent combination with no ordering constraints, and a future writer
--   cannot reintroduce the drift even if it sets the boolean explicitly.
--
-- SCOPE / BLAST RADIUS:
--   * The trigger only ever OVERWRITES `phone_verified`. It never touches
--     `phone_verified_at`, `phone`, or any other column.
--   * `phone_verified` is display-only everywhere it is read today (admin user
--     detail, `AuthSession` signature, the Edit Profile branch) — no money, fee,
--     SP, payout or trade-state logic reads it.
--   * The backfill flips rows in BOTH directions so the invariant holds for
--     existing data, not just future writes.
--
-- ROLLBACK (one line, stated before execution per the Money-Path Fix Discipline):
--   DROP TRIGGER IF EXISTS trg_profiles_sync_phone_verified ON public.profiles;
--   (the boolean then stops being derived; no data repair is needed to roll back,
--    and the backfill is itself reversible from the same source of truth)
--
-- Common failure modes (and how this avoids them):
--   * Column missing in an env (schema drift) -> the whole block is guarded by a
--     DO block that checks BOTH columns in information_schema before creating
--     anything, so a partial schema cannot leave a half-applied trigger.
--   * `dt61_guard_revoke_fn_public` strips EXECUTE from PUBLIC/anon/authenticated on
--     every `CREATE OR REPLACE FUNCTION` (BP-79) -> the `verify_user_phone` grants
--     the app depends on are re-asserted at the end of Block 1, unchanged.
--   * Ambiguous column references -> every column reference is table-alias
--     qualified (`p.phone_verified_at`), params keep the `p_` prefix.

-- ---------------------------------------------------------------------------
-- BLOCK 1 — Schema (run this first)
-- ---------------------------------------------------------------------------

-- 1. Backfill — make existing rows satisfy the invariant, in BOTH directions.
--    Direction A (the QA finding): phone_verified = true while the timestamp is
--      NULL -> the account is NOT actually verified, so the mirror is cleared.
--    Direction B (defensive): a timestamp exists but the mirror says false -> the
--      account IS verified, so the mirror is set.
--    `IS DISTINCT FROM` keeps this a no-op on already-consistent rows.
UPDATE public.profiles p
SET phone_verified = (p.phone_verified_at IS NOT NULL)
WHERE p.phone_verified IS DISTINCT FROM (p.phone_verified_at IS NOT NULL);

-- 2. Derivation trigger — makes the mirror structurally unable to drift.
DO $do$
DECLARE
  v_has_phone_verified    BOOLEAN;
  v_has_phone_verified_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'phone_verified'
  ) INTO v_has_phone_verified;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'phone_verified_at'
  ) INTO v_has_phone_verified_at;

  IF NOT (v_has_phone_verified AND v_has_phone_verified_at) THEN
    RAISE WARNING
      'FIX-Task-58 SKIPPED: profiles.phone_verified (%) / profiles.phone_verified_at (%) not both present — cannot install the derivation trigger.',
      v_has_phone_verified, v_has_phone_verified_at;
    RETURN;
  END IF;

  -- SECURITY INVOKER is correct and deliberate: this function reads no table, so it
  -- needs no elevation, and keeping it un-elevated removes any definer/search_path
  -- surface from a trigger that fires on every profile write.
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.sync_profile_phone_verified()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $body$
    BEGIN
      -- `profiles.phone_verified` is a DERIVED MIRROR of `profiles.phone_verified_at`
      -- (FIX-Task-58). The timestamp is the single source of truth; this trigger is
      -- what makes it impossible for the two to disagree. Do NOT add logic here that
      -- reads or requires other tables.
      NEW.phone_verified := (NEW.phone_verified_at IS NOT NULL);
      RETURN NEW;
    END;
    $body$;
  $fn$;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_profiles_sync_phone_verified ON public.profiles';
  EXECUTE $tg$
    CREATE TRIGGER trg_profiles_sync_phone_verified
      BEFORE INSERT OR UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_profile_phone_verified()
  $tg$;

  RAISE NOTICE 'FIX-Task-58: profiles.phone_verified is now derived from profiles.phone_verified_at.';
END;
$do$;

-- 3. Document the invariant on the column itself, so the next session does not have
--    to re-derive it (BP-13 / BP-47 — the canonical source must be discoverable).
COMMENT ON COLUMN public.profiles.phone_verified IS
  'DERIVED MIRROR of profiles.phone_verified_at (FIX-Task-58, 2026-09-18). Maintained by the BEFORE INSERT OR UPDATE trigger trg_profiles_sync_phone_verified — never write this column directly, it will be overwritten. Single source of truth for "phone verified" is profiles.phone_verified_at IS NOT NULL (what public.is_phone_verified() and the client isPhoneRequired() both read).';

-- 4. Repair the live writer that set the boolean WITHOUT the timestamp.
--    `verify_user_phone(uuid, text)` was replaced by
--    20260916000093_ultimate_test_alignment_fix.sql with a body that set
--    `phone_verified = true` and dropped the `phone_verified_at = NOW()` line the
--    earlier 20251215000002/0003 versions had. With the derivation trigger live,
--    that body would become a silent NO-OP (the trigger would immediately re-derive
--    the mirror back to false) — so it MUST be corrected in the same migration.
--    Body otherwise preserved verbatim, including its debug_logs write.
CREATE OR REPLACE FUNCTION public.verify_user_phone(
    p_user_id UUID,
    p_phone TEXT
)
RETURNS JSONB AS $$
BEGIN
    UPDATE public.profiles p
    SET
        phone             = p_phone,
        -- COALESCE keeps the ORIGINAL verification time on a re-verify instead of
        -- moving it forward; a first-time verify stamps now().
        phone_verified_at = COALESCE(p.phone_verified_at, now()),
        phone_verified    = true,
        updated_at        = now()
    WHERE p.user_id = p_user_id;

    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('verify_user_phone', 'Success', jsonb_build_object('user_id', p_user_id, 'phone', p_phone));

    RETURN jsonb_build_object('success', true, 'message', 'Phone verified successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Re-assert the pre-existing grants. `CREATE OR REPLACE FUNCTION` in `public`
--    fires the `dt61_guard_revoke_fn_public` event trigger, which REVOKEs
--    PUBLIC/anon/authenticated on the replaced function (BP-79) — without this the
--    RPC would start returning `permission denied for function verify_user_phone`.
--    Grants are UNCHANGED from 20260916000093 (line 898) so this is not a
--    privilege change. NOTE (flagged separately, NOT changed here): this function
--    takes an arbitrary `p_user_id` with no identity check and is executable by
--    `anon`, which is a pre-existing authorization defect outside this task's scope
--    — see the FIX-Task-58 report.
GRANT EXECUTE ON FUNCTION public.verify_user_phone(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- BLOCK 2 — Verification (run each statement separately; ONE per call, because
--           execute_sql only returns the LAST statement's result set)
-- ---------------------------------------------------------------------------
-- V1) Invariant held for existing data — EXPECT: 0 rows
--    SELECT count(*) AS inconsistent_rows
--    FROM public.profiles p
--    WHERE p.phone_verified IS DISTINCT FROM (p.phone_verified_at IS NOT NULL);
--
-- V2) Trigger installed + enabled — EXPECT: 1 row, tgenabled = 'O'
--    SELECT tg.tgname, tg.tgenabled
--    FROM pg_trigger tg
--    WHERE tg.tgrelid = 'public.profiles'::regclass
--      AND tg.tgname = 'trg_profiles_sync_phone_verified';
--
-- V3) The repaired RPC actually stamps the timestamp (invoke it live — a successful
--     CREATE OR REPLACE proves nothing; plpgsql resolves names at RUN time, BP-90).
--     Use a throwaway target so no shared persona is touched:
--    SELECT public.verify_user_phone('<throwaway-user-uuid>'::uuid, '5550101010');
--    SELECT p.phone, p.phone_verified, p.phone_verified_at
--    FROM public.profiles p WHERE p.user_id = '<throwaway-user-uuid>'::uuid;
--    -- EXPECT: phone_verified = true AND phone_verified_at IS NOT NULL
--
-- V4) The mirror is genuinely derived (write the boolean alone; it must be
--     overwritten to false). Use the same throwaway user, then restore:
--    UPDATE public.profiles SET phone_verified = true WHERE user_id = '<throwaway-user-uuid>'::uuid;
--    SELECT p.phone_verified, p.phone_verified_at FROM public.profiles p
--    WHERE p.user_id = '<throwaway-user-uuid>'::uuid;
--    -- EXPECT: phone_verified = false (mirror re-derived from the timestamp)
--    UPDATE public.profiles
--    SET phone_verified_at = NULL, phone_verified = false, phone = NULL
--    WHERE user_id = '<throwaway-user-uuid>'::uuid;
--
-- V5) Grants survived the replace — EXPECT: true (per role that must call it)
--    SELECT has_function_privilege('authenticated', 'public.verify_user_phone(uuid,text)', 'EXECUTE');
