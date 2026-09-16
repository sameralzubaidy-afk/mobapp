-- FIX-Task-40 phase 3 — schema fingerprint part 3 of 3:
-- FUNCTIONS / ENUMS / POLICIES / RLS flags / VIEWS.
-- See fp1-columns.sql for the usage note (must stay byte-identical to the query
-- that captured the staging side).
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -At -f <this file> > /tmp/local-fp3.txt
select 'FUNCTION|' || n.nspname || '|' || p.proname || '|' ||
       pg_get_function_identity_arguments(p.oid) || '|' ||
       pg_get_function_result(p.oid) || '|' ||
       (case when p.prosecdef then 'SECURITY_DEFINER' else 'INVOKER' end) || '|' ||
       coalesce(array_to_string(p.proconfig, ','), '-') as line
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
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
order by 1;
