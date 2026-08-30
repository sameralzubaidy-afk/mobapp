-- ============================================================================
-- supabase/migrations/20260830000013_dev_task_61_event_trigger.sql
-- Dev Task 61 — Systemic Default-Privilege Posture (Option A: event trigger)
-- ============================================================================
-- Mode: B (idempotent rerunnable migration)
--
-- Owner-approved 2026-08-30. DT-59 fixed the 33 EXISTING money-function grants;
-- DT-61 makes NEW functions fail-closed. The ALTER DEFAULT PRIVILEGES approach
-- was PROVEN non-functional on this Supabase PG 17.6 (built-in PUBLIC-execute
-- baseline is always applied to new functions; pg_default_acl can only ADD
-- grants) and was reverted. Per owner decision (2026-08-30), Option A is the
-- working replacement: an EVENT TRIGGER that auto-REVOKEs PUBLIC EXECUTE on
-- every public-schema function/procedure at creation.
--
-- GRANT-DISCIPLINE AUDIT (required by owner, done 2026-08-30, live + repo):
--   - 429 public functions; 370 PUBLIC-executable (built-in default), BUT
--     0 rely on built-in PUBLIC without an explicit anon/authenticated grant.
--     => Every function clients (anon/authenticated) call is ALREADY explicitly
--        granted to anon/authenticated. Revoking PUBLIC does NOT break the
--        existing discipline.
--   - 349 migration files CREATE functions; 133 contain explicit GRANT EXECUTE
--     (322 statements). Client functions carry explicit grants; money/internal
--     functions carry service_role-only grants (DT-59).
--   - Conclusion: the trigger is safe for all EXISTING functions (no retroactive
--     effect) and consistent with the codebase's existing practice.
--
-- NEW DISCIPLINE (MANDATORY from this migration forward):
--   Every new public-schema function/procedure MUST carry an explicit
--   GRANT EXECUTE ON FUNCTION ... TO <anon|authenticated|service_role>
--   in the SAME migration that creates it. Without it, the function will be
--   executable only by its owner (postgres) — fail-closed by design.
--   (Fits BP-78: treat default-PUBLIC client access as a Tier-0 finding.)
--
-- WHY the trigger revokes anon + authenticated too (not just PUBLIC):
--   This Supabase project's default-ACL row directly grants anon + authenticated
--   EXECUTE to every new function (grantor postgres, pg_default_acl objtype 'f').
--   A PUBLIC-only REVOKE leaves that direct grant in place — proven live
--   (post-apply probe still anon/authenticated-executable). The event trigger
--   fires at CREATE time, so any intended client access is restored by the
--   migration's own explicit GRANT that follows. service_role keeps its default
--   EXECUTE (privileged backend role, deliberate — EFs call via service key).
--
-- ROLLBACK (stated pre-execution):
--   DROP EVENT TRIGGER IF EXISTS dt61_guard_revoke_fn_public;
--   DROP FUNCTION IF EXISTS public._dt61_guard_revoke_fn_public();
--   (Non-destructive: removing the guard only stops future auto-REVOKEs; it
--    does not touch any existing function. Re-run this migration to re-install.)
-- ============================================================================

-- 1) Event-trigger function: best-effort REVOKE of PUBLIC + anon + authenticated
--    EXECUTE on every newly created public-schema function/procedure.
CREATE OR REPLACE FUNCTION public._dt61_guard_revoke_fn_public()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
        SELECT object_type, object_identity
        FROM pg_event_trigger_ddl_commands()
        WHERE command_tag IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
          AND object_type IN ('function', 'procedure')
          AND object_identity LIKE 'public.%'
    LOOP
        BEGIN
            EXECUTE format('REVOKE EXECUTE ON %s %s FROM PUBLIC, anon, authenticated',
                           upper(obj.object_type), obj.object_identity);
        EXCEPTION WHEN others THEN
            NULL; -- best-effort: never block the underlying DDL
        END;
    END LOOP;
END;
$$;

-- 2) The event trigger (DROP+CREATE for rerun-safety / idempotency).
DROP EVENT TRIGGER IF EXISTS dt61_guard_revoke_fn_public;
CREATE EVENT TRIGGER dt61_guard_revoke_fn_public
ON ddl_command_end
WHEN TAG IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
EXECUTE FUNCTION public._dt61_guard_revoke_fn_public();
