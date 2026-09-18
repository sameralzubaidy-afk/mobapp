-- File: supabase/migrations/20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql
-- FIX-Task-59 — `verify_user_phone` unauthenticated access hole, PLUS the two
--               anonymous / PUBLIC-role write rules on `profiles` that reach the
--               same field (`phone_verified_at`).
--
-- Mode: B (idempotent rerunnable migration) — every statement is
--       CREATE OR REPLACE / DROP ... IF EXISTS / REVOKE / GRANT.
--
-- WHY (owner summary):
--   `profiles.phone_verified_at` is the single source of truth for "this account's
--   phone is verified" (FIX-Task-58, 2026-09-18) and both real gates read it:
--   the server-side `public.is_phone_verified()` and the client `isPhoneRequired()`.
--   Three separate unauthenticated write paths could set it for ANY account:
--
--   1. `public.verify_user_phone(p_user_id, p_phone)` — SECURITY DEFINER, no identity
--      check of any kind, `GRANT EXECUTE ... TO anon, authenticated`.
--   2. `profiles_anon_update` (created by 20260916000093_ultimate_test_alignment_fix.sql)
--      — `FOR UPDATE TO anon USING (true)` with no WITH CHECK, i.e. an anonymous caller
--      may PATCH any profile row to any values.
--   3. `Allow phone verification updates` (20241214000004_phone_verification_rls_fix.sql)
--      — granted to PUBLIC (`roles = {-}`), and its anon branch is
--      `auth.role() = 'anon' AND user_id IS NOT NULL`, which is true for every row.
--
--   Fixing only (1) would have been security theatre: (2) and (3) reach the same
--   columns over plain PostgREST. All three are closed here.
--
-- MEASURED BEFORE (live staging read, 2026-09-18 — read-only pg_proc/pg_policy
-- introspection, no writes):
--   verify_user_phone(p_user_id uuid, p_phone text)
--     prosecdef = true, proconfig = {search_path=public},
--     proacl    = postgres=X/postgres | service_role=X/postgres | anon=X/postgres | authenticated=X/postgres
--     has_function_privilege: anon = true, authenticated = true, service_role = true
--     body      = UPDATE public.profiles ... WHERE p.user_id = p_user_id  (no auth.uid() check)
--   profiles policies:
--     profiles_anon_update              | UPDATE | anon   | USING true   | WITH CHECK (null)
--     Allow phone verification updates  | UPDATE | PUBLIC | USING (auth.uid() = user_id) OR (auth.role() = 'anon' AND user_id IS NOT NULL)
--
--   A completeness scan of every `public` function whose BODY mentions phone_verified
--   (same read, same day) found three more unauthenticated entry points to the same
--   signal, so this migration closes the whole class rather than the one function QA
--   named (Copy-Consistency Class Sweep):
--     verify_phone_code(p_user_id uuid, p_code text)                       anon=TRUE, SECURITY INVOKER
--     is_phone_verified(p_user_id uuid)                                    anon=TRUE, SECURITY DEFINER
--     check_phone_verification_status(p_user_id uuid)                      anon=TRUE, SECURITY DEFINER
--   `profiles.user_id` is UNIQUE, so the surviving anon INSERT rule cannot forge a
--   second profile row for an existing account — that path is not a bypass.
--
-- DESIGN (why an in-function identity gate rather than `service_role`-only):
--   The in-repo sibling precedent for "user-JWT caller must own the row" is
--   `20260916000135_dev_task_57_rpc_identity_lockdown.sql` (cancel_trade) and the
--   role signal it uses — `current_setting('role', true)`, never
--   `request.jwt.claim.role`, which this PostgREST never sets (BP-78).
--   Locking to `service_role` alone would work too, but it would break the DEV
--   OTP-bypass helper the QA workflow relies on. The gate below keeps that path
--   working while making the function impossible to use against another account.
--   Denials RAISE with ERRCODE 42501 (PostgREST maps 42501 to HTTP 401, BP-78) so a
--   rejected caller is unmistakable and can never be confused with the benign
--   `{success:false}` a "no profile found" result returns.
--
-- SCOPE / BLAST RADIUS:
--   * The successful RPC body is preserved VERBATIM from the live definition
--     (20260918000002_fix_task_58_phone_verified_source_of_truth.sql, lines 152-169),
--     including its `debug_logs` write and the COALESCE that preserves the original
--     verification time. Only the authorization gate is added.
--   * The two dropped policies are pure attack surface:
--       - `profiles_anon_update` is anon-only and grants nothing to real users.
--       - `Allow phone verification updates` grants to PUBLIC; its
--         `auth.uid() = user_id` branch is already covered by the surviving
--         `Users can update their own profile` policy (USING and WITH CHECK both
--         `auth.uid() = user_id`), so no legitimate access is lost by removing it.
--   * The signup path does not depend on either policy: the profile row is created by
--     the `handle_new_user()` trigger on auth.users (table owner, RLS-exempt) — the
--     client never inserts or updates `profiles` during signup (verified in
--     src/services/auth.ts, `signupWithTrial`, step 2).
--   * NOT changed here (out of this task's scope, flagged in the report):
--     `profiles_anon_insert`, `profiles_anon_select`, and the anon-callable
--     `public.setup_user_profile(uuid, text, text)` (20260916000093 line 792), which
--     lets an anonymous caller rewrite another user's name/zip_code. None of those
--     can reach `phone_verified_at`.
--   * `verify_phone_code` is SECURITY **INVOKER** (no elevation), so once the two anon
--     UPDATE rules above are dropped it cannot cross accounts either: its own
--     `UPDATE public.profiles` runs under the caller's RLS, where the surviving
--     `Users can update their own profile` policy is the only UPDATE path. The anon
--     REVOKE below is belt-and-braces so the entry point is not reachable at all.
--     It has NO live in-app caller: its only caller is `src/services/phone.ts`, which
--     is imported by nothing (the legacy flow registry already calls this RPC "stale").
--     `is_phone_verified` keeps working for the item-insert trigger because
--     `enforce_phone_verified_on_item_insert()` is SECURITY DEFINER (EXECUTE is checked
--     against the definer/owner, not against a grant).
--
-- ROLLBACK (one line per destructive change, stated before execution per the
-- Money-Path Fix Discipline):
--   1. GRANT EXECUTE ON FUNCTION public.verify_user_phone(UUID, TEXT) TO anon;
--      (the body change is reversed by re-applying 20260918000002)
--   2. CREATE POLICY "profiles_anon_update" ON public.profiles FOR UPDATE TO anon USING (true);
--   3. CREATE POLICY "Allow phone verification updates" ON public.profiles FOR UPDATE
--        USING ((auth.uid() = user_id) OR ((auth.role() = 'anon') AND (user_id IS NOT NULL)))
--        WITH CHECK ((auth.uid() = user_id) OR ((auth.role() = 'anon') AND (user_id IS NOT NULL)));
--   4. Restore the built-in PUBLIC grant on the three siblings (this is what they
--      had before — an anon-only GRANT would NOT restore anon's access, because anon
--      reaches these functions only through PUBLIC):
--      GRANT EXECUTE ON FUNCTION public.verify_phone_code(UUID, TEXT) TO PUBLIC;
--      GRANT EXECUTE ON FUNCTION public.is_phone_verified(UUID) TO PUBLIC;
--      GRANT EXECUTE ON FUNCTION public.check_phone_verification_status(UUID) TO PUBLIC;
--   NOTE: rolling back 2 or 3 REOPENS the phone-verification bypass. Only do it to
--   diagnose a proven regression, and re-apply this migration immediately after.
--
-- Common failure modes (and how this avoids them):
--   * The gate must not misfire for the legit service-role caller (seed scripts,
--     fixtures, admin API routes) -> `auth.uid()` is NULL there, so the
--     `current_setting('role') = 'service_role'` branch is what admits it.
--   * `CREATE OR REPLACE FUNCTION` fires `dt61_guard_revoke_fn_public`, which REVOKEs
--     PUBLIC/anon/authenticated on the replaced function (BP-79) -> the grants this
--     function is ALLOWED to keep are re-asserted immediately after the CREATE.
--   * plpgsql resolves names at RUN time, so a clean apply proves nothing (BP-90) ->
--     the verification block below invokes the function for real, plus the
--     `scripts/qa/fix-task-59-phone-rpc-lockdown.mjs` probe drives all three legs.
--   * Ambiguous column references -> every column is table-alias qualified and the
--     params keep the `p_` prefix (SQL naming convention).

-- ---------------------------------------------------------------------------
-- BLOCK 1 — Schema + Security (run this first)
-- ---------------------------------------------------------------------------

-- 1. `verify_user_phone` — same signature, same successful behaviour, now with an
--    authorization gate. Identity comes from `auth.uid()`; a NULL `auth.uid()`
--    (anon, or a service-role/DB context) must prove it is service_role.
CREATE OR REPLACE FUNCTION public.verify_user_phone(
    p_user_id UUID,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id   UUID;
    v_actor_role TEXT;
BEGIN
    -- ---------------------------------------------------------------------
    -- FIX-Task-59 authorization gate.
    -- Identity is auth.uid()-derived and takes precedence: a caller holding a
    -- user JWT may only verify THAT user's phone. Every other case must be
    -- service_role (seed/fixture/admin API routes), which is the only role that
    -- is allowed to act on behalf of an arbitrary p_user_id.
    -- `current_setting('role')` — NOT `request.jwt.claim.role`, which this
    -- Supabase/PostgREST never sets (BP-78); verified in DT-57 / DT-59.
    -- ---------------------------------------------------------------------
    v_actor_id := auth.uid();

    IF v_actor_id IS NOT NULL THEN
        IF v_actor_id <> p_user_id THEN
            RAISE EXCEPTION 'You can only verify your own phone number'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        v_actor_role := COALESCE(current_setting('role', true), '');
        IF v_actor_role <> 'service_role' THEN
            RAISE EXCEPTION 'You do not have permission to verify this phone number'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- ---------------------------------------------------------------------
    -- Unchanged success path (verbatim from the live 20260918000002 body).
    -- `phone_verified` is recomputed by the trg_profiles_sync_phone_verified
    -- BEFORE trigger from phone_verified_at (FIX-Task-58); it is still written
    -- here so the statement remains self-consistent on a database where that
    -- trigger is absent.
    -- ---------------------------------------------------------------------
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
$$;

-- 2. Grants — deny every unauthenticated caller, keep the two legitimate roles.
--    MUST follow the CREATE: dt61_guard_revoke_fn_public strips the grants above
--    on every CREATE OR REPLACE (BP-79).
REVOKE EXECUTE ON FUNCTION public.verify_user_phone(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_user_phone(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.verify_user_phone(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.verify_user_phone(UUID, TEXT) TO service_role;

-- 3. Remove the two anonymous / PUBLIC write rules on `profiles` that could set
--    `phone_verified_at` for any account over plain PostgREST. See the header for
--    why nothing legitimate depends on either.
DROP POLICY IF EXISTS "profiles_anon_update" ON public.profiles;
DROP POLICY IF EXISTS "Allow phone verification updates" ON public.profiles;

-- 4. Close the rest of the class — the other functions that read or write the same
--    signal and are reachable by an unauthenticated caller.
--
--    MUST revoke from `PUBLIC`, not just from `anon`: all three still carry the
--    built-in `=X/postgres` PUBLIC grant in their ACL, and `anon` INHERITS EXECUTE
--    through PUBLIC — so `REVOKE ... FROM anon` alone is a silent NO-OP (measured on
--    staging 2026-09-18: after the anon-only revoke, `has_function_privilege('anon',
--    ..., 'EXECUTE')` was still TRUE for all three, while the ACL showed
--    `=X/postgres | postgres=X | authenticated=X | service_role=X`). Same family as
--    BP-78's "GRANT without REVOKE FROM PUBLIC leaves PUBLIC executable".
--    `verify_user_phone` above is unaffected by this trap because the DT-61 guard had
--    already stripped PUBLIC from it, leaving an explicit `anon=X` to revoke.
--    The explicit re-GRANTs keep `authenticated`/`service_role` at exactly the access
--    they had before (their own explicit ACL entries survive the PUBLIC revoke; the
--    GRANT is re-asserted anyway per the BP-79 explicit-grant discipline).
REVOKE EXECUTE ON FUNCTION public.verify_phone_code(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_phone_verified(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_phone_verification_status(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.verify_phone_code(UUID, TEXT) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_phone_verified(UUID) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.check_phone_verification_status(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 2 — Verification (run each statement SEPARATELY; execute_sql returns only
--           the LAST statement's result set)
-- ---------------------------------------------------------------------------
-- V1) Grants + body after — EXPECT: anon_can_execute = false,
--     authenticated/service_role = true, definition contains 'auth.uid()'.
--    SELECT p.proname,
--           pg_get_function_identity_arguments(p.oid) AS signature,
--           has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
--           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
--           has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can_execute,
--           (pg_get_functiondef(p.oid) LIKE '%auth.uid()%')           AS has_identity_gate,
--           COALESCE(array_to_string(p.proacl, ' | '), '(default)')   AS acl
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'verify_user_phone';
--
-- V1b) The whole class, re-run — EXPECT: anon_exec = false on all four,
--      and no OTHER anon-reachable function mentions phone_verified.
--    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS object,
--           has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
--           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosrc ILIKE '%phone_verified%'
--    ORDER BY 1;
--
-- V2) Every UPDATE rule left on profiles — EXPECT: `profiles_anon_update` and
--     `Allow phone verification updates` ABSENT; `Users can update their own profile`
--     PRESENT; any PUBLIC-role row here must carry an `auth.uid() = user_id` predicate
--     (PUBLIC alone is not the defect — a predicate that is true for anon is).
--    SELECT pol.polname,
--           pol.polcmd,
--           pol.polroles::regrole[] AS roles,
--           pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
--           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
--    FROM pg_policy pol
--    JOIN pg_class c     ON c.oid = pol.polrelid
--    JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relname = 'profiles'
--      AND pol.polcmd = 'w'
--    ORDER BY pol.polname;
--
-- V3) The surviving self-update policy is intact — EXPECT: 1 row
--    SELECT pol.polname
--    FROM pg_policy pol
--    JOIN pg_class c ON c.oid = pol.polrelid
--    WHERE c.relname = 'profiles' AND pol.polname = 'Users can update their own profile';
--
-- V4) Invoke the function for real (a clean apply proves nothing, BP-90).
--     Run as service_role via a throwaway user, then confirm the timestamp landed:
--    SELECT public.verify_user_phone('<throwaway-user-uuid>'::uuid, '5550101010');
--    SELECT p.phone_verified, p.phone_verified_at
--    FROM public.profiles p WHERE p.user_id = '<throwaway-user-uuid>'::uuid;
--
-- V5) The negative legs (anon rejected, wrong-identity rejected, row unchanged) are
--     driven by: cd p2p-kids-marketplace && npm run qa:fix59-phone-lockdown
