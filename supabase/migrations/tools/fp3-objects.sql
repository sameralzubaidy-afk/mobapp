-- FIX-Task-40 phase 3 — schema fingerprint part 3 of 3:
-- FUNCTIONS / ACLs / ENUMS / POLICIES / RLS flags / VIEWS / STORAGE BUCKETS.
-- See fp1-columns.sql for the usage note (must stay byte-identical to the query
-- that captured the staging side).
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -At -f <this file> > <reports>/local-fp3.txt
--
-- ============================================================================
-- v2 (FIX-Task-63, 2026-09-18) — three fields added, because the v1 gate was
-- STRUCTURALLY BLIND to three defect classes this repo actually shipped:
--
--   1. `md5(prosrc)` on the FUNCTION line. v1 captured identity (name, args,
--      result, security, proconfig) but NOT the body, so a later migration could
--      re-install an OLDER body with an identical signature and the gate stayed
--      green. Measured instance: `admin_get_user_analytics` raised
--      `missing FROM-clause entry for table "s"` on EVERY call
--      (20260916000077 regressed 20260328000024) and no gate run ever saw it.
--   2. ACLs. `proacl` was not fingerprinted at all, so 21 client-facing RPCs were
--      left uncallable by `authenticated` on a rebuilt database with a green gate
--      (`dt61_guard_revoke_fn_public` strips the default PUBLIC grant on every
--      create, and every replay file runs after that guard).
--   3. Storage bucket properties. `allowed_mime_types` / `file_size_limit` appear
--      ZERO times in v1 and there were no `storage` rows at all — a bucket
--      security control could drift with no signal.
--
-- Because a query change invalidates every captured fingerprint, the queries'
-- own sha is recorded (`fpQueriesSha` in the fidelity report and in
-- tools/staging-fp/snapshot.json) and the gate refuses to compare across
-- different query sets. Prose in this header asking for byte-identity is not
-- enforcement; the sha is.
--
-- NOTE ON PROVENANCE: `STORAGE` rows are deliberately exempt from the gate's
-- rule-2 provenance check (a bucket row is seeded with an INSERT, not created by a
-- `CREATE ...` statement the provenance index can see). See PROVENANCE_EXEMPT_KINDS
-- in scripts/migrations/fidelity-check.mjs.
-- ============================================================================
select 'FUNCTION|' || n.nspname || '|' || p.proname || '|' ||
       pg_get_function_identity_arguments(p.oid) || '|' ||
       pg_get_function_result(p.oid) || '|' ||
       (case when p.prosecdef then 'SECURITY_DEFINER' else 'INVOKER' end) || '|' ||
       coalesce(array_to_string(p.proconfig, ','), '-') || '|' ||
       md5(coalesce(p.prosrc, '')) as line
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
-- Function grants. `grantee = 0` is PUBLIC, which is the default for functions and
-- the exact thing `dt61_guard_revoke_fn_public` removes on every create.
select 'ACL|' || n.nspname || '|' || p.proname || '|FUNCTION|' ||
       (case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end) || '|' ||
       a.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as a
where n.nspname = 'public'
union all
-- Table/view grants.
select 'ACL|' || n.nspname || '|' || c.relname || '|RELATION|' ||
       (case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end) || '|' ||
       a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) as a
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
union all
select 'ENUM|' || n.nspname || '|' || t.typname || '|' || e.enumlabel || '|' || e.enumsortorder::text
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
union all
select 'POLICY|' || schemaname || '|' || tablename || '|' || policyname || '|' ||
       coalesce(cmd, '-') || '|' || coalesce(array_to_string(roles, ','), '-') || '|' ||
       coalesce(qual, '-') || '|' || coalesce(with_check, '-')
from pg_policies
where schemaname = 'public'
union all
select 'RLS|' || n.nspname || '|' || c.relname || '|' || c.relrowsecurity::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
union all
select 'VIEW|' || schemaname || '|' || viewname || '|' || md5(definition)
from pg_views
where schemaname = 'public'
union all
-- Storage bucket controls. `id` is stable across a bucket rename, so it carries the key.
select 'STORAGE|storage|buckets|' || b.id || '|' || b.name || '|' ||
       coalesce(b.public::text, '-') || '|' ||
       coalesce(array_to_string(b.allowed_mime_types, ','), '-') || '|' ||
       coalesce(b.file_size_limit::text, '-')
from storage.buckets b
order by 1;
