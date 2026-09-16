-- FIX-Task-40 phase 3 — schema fingerprint part 1 of 3: COLUMNS.
--
-- Used by `scripts/migrations/fidelity-check.mjs` to compare the schema rebuilt
-- locally by replaying supabase/migrations against the captured staging
-- fingerprint files under /tmp/staging-fp*.txt.
--
-- IMPORTANT: this must be the SAME query that captured the staging side,
-- otherwise a query change masquerades as a schema difference. It deliberately
-- does NOT filter extension-owned objects — the checker removes those by name
-- from BOTH sides instead, because PostGIS lives in `public` locally but in a
-- different schema on staging.
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -At -f <this file> > /tmp/local-fp1.txt
select 'COLUMN|' || c.table_schema || '|' || c.table_name || '|' ||
       lpad(c.ordinal_position::text, 3, '0') || '|' || c.column_name || '|' ||
       c.data_type || '|' || coalesce(c.udt_name, '-') || '|' ||
       coalesce(c.character_maximum_length::text, '-') || '|' ||
       coalesce(c.numeric_precision::text, '-') || '|' ||
       coalesce(c.numeric_scale::text, '-') || '|' || c.is_nullable || '|' ||
       coalesce(c.column_default, '-') as line
from information_schema.columns c
where c.table_schema = 'public'
order by 1;
