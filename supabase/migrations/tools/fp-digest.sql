-- ============================================================================
-- GENERATED FILE — do not edit by hand.
-- Produced by: node scripts/migrations/make-fp-digest.mjs
-- Source: tools/fp1-columns.sql + fp2-constraints.sql + fp3-objects.sql
--
-- Returns one row per object kind: the object count and an md5 over all of that
-- kind's lines in a canonical form.
--
-- The canonicalisation is load-bearing and must match `fidelity-check.mjs`'s
-- `toRecords()` exactly: that function TRIMS each physical line and rejoins the
-- continuations of one logical record with a SINGLE SPACE. So the SQL side collapses
-- newline-plus-surrounding-indentation to one space and trims the ends. Whitespace
-- INSIDE a line is preserved, so a genuine change is never normalised away.
--
-- Measured: the first version used a bare replace(line, chr(10), ' ') and disagreed
-- with the Node computation on POLICY only — the one kind whose `qual` carries
-- indentation around embedded newlines. The self-test caught it before it reached
-- staging, which is the whole reason the digest is verified locally first.
-- ============================================================================
WITH lines AS (
select 'COLUMN|' || c.table_schema || '|' || c.table_name || '|' ||
       lpad(c.ordinal_position::text, 3, '0') || '|' || c.column_name || '|' ||
       c.data_type || '|' || coalesce(c.udt_name, '-') || '|' ||
       coalesce(c.character_maximum_length::text, '-') || '|' ||
       coalesce(c.numeric_precision::text, '-') || '|' ||
       coalesce(c.numeric_scale::text, '-') || '|' || c.is_nullable || '|' ||
       coalesce(c.column_default, '-') as line
from information_schema.columns c
where c.table_schema = 'public'
union all
select 'CONSTRAINT|' || n.nspname || '|' || cl.relname || '|' || con.conname || '|' ||
       con.contype::text || '|' || pg_get_constraintdef(con.oid) as line
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
union all
select 'INDEX|' || schemaname || '|' || tablename || '|' || indexname || '|' || indexdef
from pg_indexes
where schemaname = 'public'
union all
select 'TRIGGER|' || n.nspname || '|' || cl.relname || '|' || t.tgname || '|' ||
       pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class cl on cl.oid = t.tgrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public' and not t.tgisinternal
union all
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
),
canon AS (
  select trim(regexp_replace(lines.line, '[[:space:]]*' || chr(10) || '[[:space:]]*', ' ', 'g')) as line
  from lines
),
-- Extension-owned objects and the one-off manual snapshot table are excluded BY NAME,
-- exactly as fidelity-check.mjs's loadSide() does. Measured: without this, PostGIS
-- (installed in `public` locally but NOT on staging) made FUNCTION read 1222 locally
-- vs 456 on staging, and every digest comparison was noise.
ext AS (
  select distinct p.proname as name from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  union
  select distinct c.relname from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  union
  select distinct t.typname from pg_type t
   join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e')
),
kept AS (
  select canon.line
  from canon
  where split_part(canon.line, '|', 3) <> '_orphan_image_snapshot_20260829'
    and not exists (select 1 from ext e where e.name = split_part(canon.line, '|', 3))
)
select split_part(kept.line, '|', 1)  as kind,
       count(*)                       as object_count,
       md5(string_agg(kept.line, E'\n' order by kept.line)) as kind_md5
from kept
group by 1
order by 1;

-- kinds covered: ACL, COLUMN, CONSTRAINT, ENUM, FUNCTION, INDEX, POLICY, RLS, STORAGE, TRIGGER, VIEW
