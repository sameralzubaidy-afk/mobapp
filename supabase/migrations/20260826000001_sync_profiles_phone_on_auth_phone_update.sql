-- =============================================================================
-- Migration: 20260826000001_sync_profiles_phone_on_auth_phone_update.sql
-- Mode: B (idempotent rerunnable migration)
-- Module: MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md -> ACC-TC-B03
-- Task: Dev Task — Fix profiles.phone cross-table staleness (recurring class,
--       prior Groups A/B/D findings; observed auth.users.phone=5551234002 vs
--       profiles.phone=5551234001 after the canonical B03 phone-verify stack).
--
-- ROOT CAUSE:
--   The on_auth_user_updated trigger's handler handle_user_update() (latest
--   body: 20260120000000_consolidated_profile_trigger.sql) syncs
--       profiles.phone = COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
--   i.e. it prefers the SIGNUP-TIME raw_user_meta_data.phone over the
--   authoritative auth.users.phone column. auth-update-phone (GoTrue admin
--   API) updates auth.users.phone but NEVER raw_user_meta_data, so the stale
--   metadata value wins the COALESCE and profiles.phone never catches up to
--   the verified account phone.
--
-- FIX:
--   * handle_user_update() now prefers NEW.phone (authoritative) with the
--     metadata value as a fallback for users whose phone lives only in
--     raw_user_meta_data (auth.users.phone NULL).
--   * The trigger is recreated idempotently (DROP IF EXISTS + CREATE) so it
--     self-heals on DBs where deployment lag dropped or never attached it
--     (BP-47: verify the deployed trigger, don't assume).
--   * One-time backfill reconciles existing divergent rows (auth.users.phone
--     is the source of truth when non-null; never nulls an existing value).
--
-- MIRRORS: auth-email-change (which syncs profiles.email right after the auth
-- email update). The Edge Function auth-update-phone also writes
-- profiles.phone explicitly (defense-in-depth) in the same deploy so the B03
-- persist path is deterministic regardless of trigger state.
--
-- SECURITY: handle_user_update() is SECURITY DEFINER (it must write profiles
-- for any user when auth.users changes, bypassing per-row RLS); explicit
-- `SET search_path = public` so the only schema it can touch is public.
-- =============================================================================

-- ==================================================
-- BLOCK 1 (Schema): correct + re-attach the sync trigger
-- ==================================================

-- Correct the sync precedence: auth.users.phone is authoritative; the
-- raw_user_meta_data value is only a fallback for phones that live in metadata
-- only (auth.users.phone NULL at signup). Before this fix the order was
-- reversed, which kept profiles.phone stale after every auth-update-phone call.
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    phone = COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone')
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach the trigger idempotently. Fires on email/phone/metadata updates to
-- auth.users so profiles stays in sync with the account-level identity — this
-- includes GoTrue admin updates (auth-update-phone) because the UPDATE's SET
-- list includes `phone`. AFTER UPDATE OF <cols> fires when a listed column is
-- in the SET list, regardless of whether the value changed.
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- ==================================================
-- BLOCK 2 (Data + Verify): reconcile existing divergence
-- ==================================================

-- Backfill: auth.users.phone is the source of truth when it is set. Only rows
-- that actually diverge are touched, so re-running this migration is a no-op.
-- Rows where auth.users.phone IS NULL are left alone (never null an existing
-- profile value).
UPDATE public.profiles p
SET phone = au.phone
FROM auth.users au
WHERE p.user_id = au.id
  AND au.phone IS NOT NULL
  AND p.phone IS DISTINCT FROM au.phone;

-- -----------------------------------------------------------------------------
-- Verification queries (run in Supabase SQL editor / migration check):
--
-- 1) Trigger attached (expect 1 row, tgenabled = 'O'):
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_updated';
--
-- 2) Handler body (expect `phone = COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone')`):
--    SELECT pg_get_functiondef('public.handle_user_update'::regproc);
--
-- 3) Residual divergence (expect 0):
--    SELECT count(*) FROM public.profiles p
--    JOIN auth.users au ON p.user_id = au.id
--    WHERE au.phone IS NOT NULL AND p.phone IS DISTINCT FROM au.phone;
--
-- 4) B03 spot check (test-buyer — both tables equal):
--    SELECT au.phone AS auth_phone, p.phone AS profile_phone
--    FROM auth.users au
--    JOIN public.profiles p ON p.user_id = au.id
--    WHERE au.phone IS NOT NULL AND p.phone IS DISTINCT FROM au.phone;
-- -----------------------------------------------------------------------------
