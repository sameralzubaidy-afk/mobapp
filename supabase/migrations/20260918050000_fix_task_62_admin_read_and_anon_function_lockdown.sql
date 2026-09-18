-- =============================================================================
-- FIX-Task-62 — Part 1 of 2: identity + EXECUTE lockdown for the remaining
-- anonymous-reachable functions on the admin / profile surfaces
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B).
--
-- NUMBERING (reserved 2026091805000x block — do NOT renumber to 20260918000010):
--   A separate payout workstream was writing `20260918000010_*` / `20260918000011_*`
--   files into this same working tree while this task ran. A migration filename is an
--   order key (BP-99), and two files sharing one is an undefined-order hazard, so the two
--   FIX-Task-62 migrations were moved into a reserved block instead.
-- =============================================================================
--
-- THE DEFECT
-- ----------
-- `20260916000077_admin_user_management.sql` created the admin READ surfaces
-- `admin_list_users` (a 7-parameter overload), `admin_get_user_analytics` and
-- `admin_get_user_detail` as SECURITY DEFINER functions whose ONLY authorization
-- check trusted a SELF-DECLARED parameter:
--
--     IF NOT EXISTS (SELECT 1 FROM role_based_access_control rbac
--                    WHERE rbac.user_id = p_admin_id
--                      AND rbac.role = 'admin') THEN
--       RAISE EXCEPTION 'User % is not an admin', p_admin_id;
--     END IF;
--
-- `p_admin_id` is chosen by the CALLER, so the check proves only that *some* admin
-- exists somewhere in the table — never that the caller is one. On top of that,
-- none of these signatures has a GRANT or a REVOKE anywhere in the migration chain,
-- so each carries Postgres' built-in PUBLIC EXECUTE and is therefore callable by the
-- unauthenticated `anon` role.
--
-- Quoted from the FIX-Task-59 audit, which read the LIVE ACL on staging (2026-09-18):
--     has_function_privilege('anon', 'public.admin_get_user_detail(uuid,uuid)', 'EXECUTE') = TRUE
-- This migration re-measures the whole ACL live as part of its own pre-flight rather
-- than relying on that quote (a claim about a live object must be read from the live
-- object, not from the migration chain).
--
-- `admin_get_user_detail` returns the FULL PII record: name, email, phone, date of
-- birth, account status, suspension reason, SP wallet balances, subscription state
-- and recent admin activity. `admin_list_users` returns the same identity fields for
-- every user, paginated and searchable. "Gate trusts a caller-chosen id" plus
-- "reachable with no credential at all" is the highest-severity combination on this
-- surface.
--
-- WHAT THIS FILE DOES
-- -------------------
-- 1. Replaces ONLY the authorization predicate inside those four bodies, in place
--    (BP-90: anchor on the full expression, re-assert survival guards in a
--    fail-loud check, and invoke the patched object immediately). Every other byte
--    of each body — including the entire PII projection — is preserved verbatim,
--    because the predicate is the only part that is wrong. Rewriting 200+ lines of
--    PII SQL by hand to change one line would be the larger risk.
-- 2. Pins `SET search_path = public` on each (BP-5). These are SECURITY DEFINER
--    functions that reference `profiles`, `role_based_access_control`, `trades` and
--    `subscriptions` UNQUALIFIED, so a caller-controlled search_path could shadow
--    those tables. (`ALTER FUNCTION` does NOT fire the DT-61 guard, which only
--    listens for CREATE FUNCTION / CREATE PROCEDURE.)
-- 3. Re-asserts the grants AFTER the replace: `REVOKE ... FROM PUBLIC, anon` then
--    `GRANT ... TO authenticated, service_role` (BP-79 — `CREATE OR REPLACE` strips
--    the PUBLIC/anon/authenticated grants, and `REVOKE ... FROM anon` alone is a
--    SILENT NO-OP while an inherited PUBLIC grant remains).
-- 4. Locks `setup_user_profile(uuid,text,text)` — an anonymous "rename anyone" RPC —
--    down to `service_role`.
-- 5. Removes anonymous access from two class-adjacent surfaces: the
--    `profiles_with_auth` view grant and `debug_auth_context()`.
-- 6. SCOPE ADDITION (disclosed): fixes a pre-existing runtime defect in
--    `admin_get_user_analytics` that BP-90's "invoke the patched object immediately"
--    step exposed — see BLOCK 1b. It is NOT caused by this migration (the predicate
--    patch cannot reach the broken statement), and it is fixed here rather than only
--    reported because this file already rewrites that function's authorization.
--
-- THE NEW PREDICATE
-- -----------------
--     rbac.role = 'admin'
--     AND (rbac.user_id = auth.uid()
--          OR COALESCE(current_setting('role', true), '') = 'service_role')
--
--   * `auth.uid()` is the real caller identity and takes precedence, so a
--     self-declared p_admin_id can no longer be used to impersonate an admin.
--   * `current_setting('role')` — NOT `request.jwt.claim.role`, which this
--     Supabase/PostgREST never sets (BP-78) — keeps the service-role paths alive
--     (admin API routes, seeds/fixtures, E2E harnesses, apply_migration tooling).
--     Same gate shape as `upsert_admin_config_setting` (DT-59 identity fixes).
--   * `anon` fails closed: `auth.uid()` is NULL and the role is `anon`.
--   * `p_admin_id` is RETAINED in every signature (BP-12 — no signature change, so
--     no DROP FUNCTION, so the COMMENTs and the admin portal's named-argument calls
--     keep working). It is now ADVISORY ONLY; `admin_suspend_user`,
--     `admin_unsuspend_user` and `admin_delete_user` still use it for audit rows and
--     are already service_role-only (DT-59).
--   * The RAISE keeps the `'User % is not an admin'` text that
--     `p2p-kids-admin/src/__tests__/integration/admin-user-management.e2e.test.ts:449`
--     asserts with `toContain('not an admin')`. Only the ERRCODE is added, so a
--     denial is a 401/403 instead of a 500.
--
-- CALLER ANALYSIS (verified against live code, 2026-09-18)
-- -------------------------------------------------------
--   * admin_get_user_detail    -> p2p-kids-admin/src/app/api/admin/users/[id]/route.ts:35
--   * admin_get_user_analytics -> p2p-kids-admin/src/app/api/admin/users/analytics/route.ts:29
--   * admin_list_users         -> p2p-kids-admin/src/app/api/admin/users/route.ts:52
--     All three route handlers first resolve `supabase.auth.getUser()` and 401 when
--     it is absent (`createRouteHandlerClient` — i.e. the admin's USER JWT), then
--     pass `p_admin_id: user.id`, which equals `auth.uid()`. They keep working
--     unchanged. `p2p-kids-admin/test_admin_rpcs.mjs` and the repo's
--     `apply_migration.mjs` use service_role, which still passes.
--   * `admin_list_users` has TWO live overloads. The admin portal calls the
--     9-parameter one (`p_sort_by` / `p_sort_order`, added by
--     `20260703000002_admin_list_users_sort_by_sp.sql`); the 7-parameter one from
--     `20260916000077` is unreferenced in app code but is still callable, so BOTH are
--     gated — leaving one open would have been the same hole under a different
--     signature.
--   * `setup_user_profile` -> ZERO callers. No Edge Function references it; the
--     mobile `setupUserProfile` (p2p-kids-marketplace/src/services/profile.ts) writes
--     `profiles` over PostgREST directly (an upsert carrying the user's own JWT), so
--     it never calls this RPC. The only other references are jest mocks
--     (src/services/__tests__/profile.test.ts), and those mock the TS function, not
--     the RPC.
--
-- NOT IN SCOPE (deliberately)
-- --------------------------
--   * `admin_suspend_user` / `admin_unsuspend_user` / `admin_delete_user` carry the
--     same self-declared-p_admin_id predicate but are ALREADY locked to service_role
--     by `20260916000136_dev_task_59_grant_lockdown.sql:168-175`, so they are not
--     anonymously reachable and are left untouched.
--   * `admin_has_role(uuid)` is granted to anon (`20260903000001:622`). It is a
--     read-only boolean role check that RLS policies reference, and a policy's
--     expression must be executable by the QUERYING role — revoking anonymous
--     EXECUTE could turn a clean "0 rows" into "permission denied for function".
--     Left as-is and reported as a residual instead.
--   * The `admin_config` anon SELECT grant is load-bearing for p2p-kids-web
--     (`lib/publicConfig.ts`) and is NOT touched here or in Part 2.
--
-- ROLLBACK (one-line reverse per statement)
-- -----------------------------------------
--   * Bodies — re-apply the previous definitions (restores the old predicate):
--       `20260916000077_admin_user_management.sql` (analytics, detail, 7-arg list)
--       `20260703000002_admin_list_users_sort_by_sp.sql` (9-param list)
--   * Grants — `GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO anon;`
--     (the built-in PUBLIC grant cannot be restored by GRANT and is not needed to
--     re-open the hole).
--   * search_path — `ALTER FUNCTION public.<name>(<args>) RESET search_path;`
--   * `setup_user_profile` — `GRANT EXECUTE ON FUNCTION public.setup_user_profile(uuid,text,text) TO anon, authenticated;`
--   * `admin_get_user_analytics` aggregate — restore `COALESCE(s.status, 'none'), cnt`
--     inside `jsonb_object_agg(...)` (only useful to re-prove the attribution; it
--     re-introduces the runtime failure on purpose).
--   * `profiles_with_auth` — `GRANT SELECT ON public.profiles_with_auth TO anon;`
--   * `debug_auth_context` — `GRANT EXECUTE ON FUNCTION public.debug_auth_context() TO anon;`
--
-- COMMON FAILURE MODES
-- --------------------
--   * If NONE of the three names is found, the DO block RAISEs instead of silently
--     succeeding — a no-op "lockdown" is exactly the failure this task is fixing.
--   * If a body no longer contains the expected predicate, the DO block RAISEs
--     rather than guessing. A future migration that already fixed the gate is
--     recognised by the `rbac.user_id = auth.uid()` marker and skipped as a no-op.
--   * `p_admin_id` staying in the signature is intentional. Do not remove it without
--     a DROP FUNCTION first (BP-12).
-- =============================================================================

-- =============================================================================
-- BLOCK 1 — Gate the four admin READ signatures in place
-- =============================================================================
DO $fix62_gate$
DECLARE
  -- The vulnerable predicate, verbatim in all four live bodies.
  v_old_predicate CONSTANT TEXT := 'rbac.user_id = p_admin_id AND rbac.role = ''admin''';
  -- The identity-derived replacement. Single expression, so no DECLARE-block patch
  -- is needed and the surrounding IF NOT EXISTS/RAISE stays byte-identical.
  v_new_predicate CONSTANT TEXT := 'rbac.role = ''admin'' AND (rbac.user_id = auth.uid() OR COALESCE(current_setting(''role'', true), '''') = ''service_role'')';
  -- Idempotency marker: present once the predicate has been replaced.
  v_marker        CONSTANT TEXT := 'rbac.user_id = auth.uid()';
  v_names         CONSTANT TEXT[] := ARRAY['admin_get_user_detail', 'admin_get_user_analytics', 'admin_list_users'];
  v_rec           RECORD;
  v_new_def       TEXT;
  v_gated         INTEGER := 0;
  v_seen          TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_rec IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS idargs,
           pg_get_functiondef(p.oid)                 AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (v_names)
    ORDER BY p.proname, p.oid
  LOOP
    v_seen := v_seen || v_rec.proname;

    IF position(v_marker IN v_rec.def) > 0 THEN
      RAISE NOTICE '[FIX-62] public.%(%) already gated — no-op', v_rec.proname, v_rec.idargs;
    ELSE
      IF position(v_old_predicate IN v_rec.def) = 0 THEN
        RAISE EXCEPTION
          '[FIX-62] public.%(%) carries no recognizable self-declared admin predicate — refusing to guess',
          v_rec.proname, v_rec.idargs;
      END IF;

      v_new_def := replace(v_rec.def, v_old_predicate, v_new_predicate);

      -- Survival guards (BP-90): the OLD predicate must be gone, the NEW one must be
      -- present, and the body must not have shrunk. Anything else means the anchored
      -- replacement did something other than what this migration intends.
      IF position(v_old_predicate IN v_new_def) > 0
         OR position(v_marker IN v_new_def) = 0
         OR length(v_new_def) <= length(v_rec.def) THEN
        RAISE EXCEPTION
          '[FIX-62] public.%(%) predicate replacement failed its survival guards',
          v_rec.proname, v_rec.idargs;
      END IF;

      EXECUTE v_new_def;
      RAISE NOTICE '[FIX-62] public.%(%) gated on auth.uid()', v_rec.proname, v_rec.idargs;
    END IF;

    -- Pin search_path (BP-5). These bodies reference profiles / trades /
    -- subscriptions / role_based_access_control unqualified.
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', v_rec.proname, v_rec.idargs);

    -- Re-assert the grants AFTER the replace (BP-79). Both statements are required:
    -- the REVOKE FROM PUBLIC is what removes the inherited built-in grant.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', v_rec.proname, v_rec.idargs);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', v_rec.proname, v_rec.idargs);

    v_gated := v_gated + 1;
  END LOOP;

  IF v_gated = 0 THEN
    RAISE EXCEPTION '[FIX-62] no admin read function was found — the lockdown would have been a silent no-op';
  END IF;

  IF NOT (v_names <@ v_seen) THEN
    RAISE EXCEPTION '[FIX-62] expected % but only found % — investigate before trusting this migration',
      array_to_string(v_names, ', '), array_to_string(v_seen, ', ');
  END IF;
END
$fix62_gate$;

-- =============================================================================
-- BLOCK 1b — pre-existing runtime defect in `admin_get_user_analytics` (disclosed)
-- =============================================================================
--
-- BP-90 requires INVOKING a patched object immediately, and that step surfaced a
-- defect unrelated to authorization: the function's `subscription_breakdown`
-- aggregate references `s.status`, an alias owned by the INNER subquery, which is not
-- in scope in the outer aggregate. Every call therefore raises
--
--     ERROR: missing FROM-clause entry for table "s"
--
-- It was introduced by `20260916000077_admin_user_management.sql`, which superseded the
-- CORRECT form in `20260328000024_fix_admin_get_user_analytics_alias_scope.sql:71`
-- (`jsonb_object_agg(sub.status, sub.cnt)`), so the admin portal's
-- `/api/admin/users/analytics` route fails on any database built from this chain — and
-- the schema-fidelity gate cannot see it, because it fingerprints shape, never the body
-- (BP-100's named blind spot).
--
-- NOT attributable to this migration: the predicate patch above edits the WHERE clause of
-- the authorization probe, a different statement. The attribution evidence is in the
-- FIX-Task-62 report, which is why this is called out explicitly rather than fixed
-- silently.
--
-- Fixed in BOTH places, per BP-96 ("prefer creating the object correctly at its creator"):
-- at the creator file, and here as an idempotent anchored convergence patch so an
-- already-built database (staging) converges without a rebuild.
-- Rollback: replace `sub.status, sub.cnt` inside `jsonb_object_agg(...)` with
-- `COALESCE(s.status, 'none'), cnt`.
DO $fix62_analytics$
DECLARE
  -- Whitespace-tolerant so it matches both the chain's stored body and staging's, which
  -- came from a different history. Only the OUTER aggregate matches: the inner
  -- `COALESCE(s.status, 'none') AS status` is correct and must stay.
  v_broken   CONSTANT TEXT := 'jsonb_object_agg\(\s*COALESCE\(s\.status, ''none''\),\s*cnt\s*\)';
  v_corrected CONSTANT TEXT := E'jsonb_object_agg(\n        sub.status,\n        sub.cnt\n      )';
  v_ok_marker CONSTANT TEXT := 'jsonb_object_agg(' || chr(10) || '        sub.status,';
  v_rec      RECORD;
  v_new_def  TEXT;
  v_matches  INTEGER;
  v_fixed    INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS idargs,
           pg_get_functiondef(p.oid)                 AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = 'admin_get_user_analytics'
  LOOP
    IF position(v_ok_marker IN v_rec.def) > 0 THEN
      RAISE NOTICE '[FIX-62] %.% already carries the corrected aggregate — no-op',
        v_rec.proname, v_rec.idargs;
    ELSE
      SELECT count(*) INTO v_matches FROM regexp_matches(v_rec.def, v_broken, 'g');

      IF v_matches = 0 THEN
        RAISE EXCEPTION
          '[FIX-62] %.%: neither the broken nor the corrected subscription_breakdown aggregate was found — refusing to guess',
          v_rec.proname, v_rec.idargs;
      END IF;
      IF v_matches > 1 THEN
        RAISE EXCEPTION
          '[FIX-62] %.%: % candidate aggregates found, expected exactly 1 — investigate before patching',
          v_rec.proname, v_rec.idargs, v_matches;
      END IF;

      v_new_def := regexp_replace(v_rec.def, v_broken, v_corrected, 'g');

      -- Survival guard (BP-90): the corrected form must now be present.
      IF position(v_ok_marker IN v_new_def) = 0 THEN
        RAISE EXCEPTION '[FIX-62] %.%: aggregate replacement failed its survival guard',
          v_rec.proname, v_rec.idargs;
      END IF;

      EXECUTE v_new_def;
      RAISE NOTICE '[FIX-62] %.%: subscription_breakdown aggregate scoped to sub.*',
        v_rec.proname, v_rec.idargs;
    END IF;

    -- Re-assert the grants: CREATE OR REPLACE fires the DT-61 guard (BP-79).
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', v_rec.proname, v_rec.idargs);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', v_rec.proname, v_rec.idargs);

    v_fixed := v_fixed + 1;
  END LOOP;

  IF v_fixed = 0 THEN
    RAISE EXCEPTION '[FIX-62] admin_get_user_analytics was not found — the analytics fix would have been a silent no-op';
  END IF;
END
$fix62_analytics$;

-- =============================================================================
-- BLOCK 2 — `setup_user_profile`: the anonymous "rename anyone" RPC
-- =============================================================================
-- `20260916000093_ultimate_test_alignment_fix.sql:792` created it as SECURITY
-- DEFINER with NO identity check at all, and line 905 granted it to
-- `anon, authenticated` — so an unauthenticated caller could rename ANY account and
-- read that account's whole profile row back as JSON.
-- Caller analysis found ZERO callers (see the header), so the grant is pure surface
-- area: it is locked to `service_role` outright. The identity gate is kept as
-- defence-in-depth for the day a caller appears, and it is the same shape FIX-Task-59
-- used for `verify_user_phone`.
CREATE OR REPLACE FUNCTION public.setup_user_profile(
  p_user_id      UUID,
  p_display_name TEXT,
  p_zip_code     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- FIX-Task-62 identity gate: auth.uid() takes precedence (a user JWT may only
  -- touch its own row); a NULL auth.uid() must prove it is service_role.
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'You can only update your own profile' USING ERRCODE = '42501';
    END IF;
  ELSIF COALESCE(current_setting('role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'You do not have permission to update this profile' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles AS pr
  SET    name     = p_display_name,
         zip_code = p_zip_code
  WHERE  pr.user_id = p_user_id;

  RETURN (SELECT row_to_json(pr) FROM public.profiles AS pr WHERE pr.user_id = p_user_id);
END;
$$;

-- Must follow the CREATE: `CREATE OR REPLACE FUNCTION` fires the DT-61 guard, which
-- re-REVOKEs PUBLIC/anon/authenticated (BP-79). Locked to service_role only.
REVOKE EXECUTE ON FUNCTION public.setup_user_profile(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.setup_user_profile(UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- BLOCK 3 — Two class-adjacent anonymous surfaces
-- =============================================================================

-- `profiles_with_auth` joins `profiles` to `auth.users`, so it exposes email, phone
-- and last sign-in. It is granted to `anon` (`20241214000003:70`) but NOTHING in the
-- chain, the mobile app, the admin portal or the Edge Functions reads it — the only
-- remaining references are in `archive/misc./`. The grant is also inert-but-
-- misleading: the view is `security_invoker = true`, so an anonymous reader would
-- additionally need SELECT on `auth.users`, which it does not have.
DO $fix62_view$
BEGIN
  IF to_regclass('public.profiles_with_auth') IS NOT NULL THEN
    REVOKE SELECT ON public.profiles_with_auth FROM anon;
    GRANT  SELECT ON public.profiles_with_auth TO authenticated, service_role;
    RAISE NOTICE '[FIX-62] profiles_with_auth: anon SELECT revoked';
  ELSE
    RAISE NOTICE '[FIX-62] profiles_with_auth absent — skipped';
  END IF;
END
$fix62_view$;

-- `debug_auth_context()` (`20241214000004:115`) is an anon-granted SECURITY DEFINER
-- debug helper returning auth.uid()/role/email/jwt, created without a search_path.
-- Nothing outside `archive/misc./` docs calls it.
DO $fix62_debug$
BEGIN
  IF to_regprocedure('public.debug_auth_context()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.debug_auth_context() FROM PUBLIC, anon;
    GRANT  EXECUTE ON FUNCTION public.debug_auth_context() TO authenticated, service_role;
    ALTER FUNCTION public.debug_auth_context() SET search_path = public;
    RAISE NOTICE '[FIX-62] debug_auth_context: anon EXECUTE revoked';
  ELSE
    RAISE NOTICE '[FIX-62] debug_auth_context absent — skipped';
  END IF;
END
$fix62_debug$;

-- =============================================================================
-- BLOCK 4 — Verification (run each statement SEPARATELY; execute_sql returns only
--           the LAST statement's result set)
-- =============================================================================
-- V1) Live ACL for all four signatures — EXPECT: anon_can_execute = false,
--     authenticated / service_role = true.
--
--   SELECT p.proname,
--          pg_get_function_identity_arguments(p.oid) AS args,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can_execute,
--          (SELECT string_agg(CASE WHEN x.grantee = 0 THEN 'PUBLIC'
--                                  ELSE x.grantee::regrole::text END, ', ' ORDER BY x.grantee)
--             FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) x) AS grantees
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('admin_get_user_detail','admin_get_user_analytics','admin_list_users')
--   ORDER BY p.proname, args;
--
-- V2) The body really is gated, and search_path really is pinned.
--     EXPECT: 4 rows, all `gated = true`, all `search_path -> public`.
--
--   SELECT p.proname,
--          pg_get_function_identity_arguments(p.oid) AS args,
--          position('rbac.user_id = auth.uid()' in p.prosrc) > 0 AS gated,
--          position('rbac.user_id = p_admin_id' in p.prosrc) > 0 AS still_self_declared,
--          p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('admin_get_user_detail','admin_get_user_analytics','admin_list_users');
--
-- V3) `setup_user_profile` — EXPECT: anon/authenticated false, service_role true,
--     body contains 'auth.uid()'.
--
--   SELECT p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can_execute,
--          position('auth.uid()' in p.prosrc) > 0 AS has_identity_gate
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'setup_user_profile';
--
-- V4) The two class-adjacent surfaces — EXPECT: no `anon` row in the ACL, and the
--     view has no anon grant.
--
--   SELECT has_function_privilege('anon', 'public.debug_auth_context()', 'EXECUTE');
--   SELECT has_table_privilege('anon', 'public.profiles_with_auth', 'SELECT');
--
-- V5) Regression check for the deliberately-locked money functions — EXPECT: all
--     three false for both anon and authenticated (no change is made by this file;
--     this is the standing assertion the FIX-Task-62 probe also drives live).
--
--   SELECT p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('award_challenge_sp','refund_sp_for_cancelled_trade','extend_trial_period');
--
-- V6) Invoke the patched object immediately (BP-90) — a successful CREATE OR REPLACE
--     proves nothing, because plpgsql resolves names at run time. As service_role:
--
--   SELECT public.admin_get_user_analytics(p_admin_id => (SELECT user_id
--            FROM public.role_based_access_control WHERE role = 'admin' LIMIT 1));
--
--     EXPECT: a JSONB body with total_users/active_users/... (NOT a 42P01/42703).
--     As `anon` the same call MUST now fail with 42501.
