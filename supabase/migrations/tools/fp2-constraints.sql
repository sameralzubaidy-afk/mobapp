-- FIX-Task-40 phase 3 — schema fingerprint part 2 of 3: CONSTRAINTS / INDEXES / TRIGGERS.
-- See fp1-columns.sql for the usage note (must stay byte-identical to the query
-- that captured the staging side).
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -At -f <this file> > /tmp/local-fp2.txt
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
order by 1;
