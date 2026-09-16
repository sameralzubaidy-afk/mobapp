-- 20260907000001_fix_unique_active_node_zip.sql
-- FIX-Task-2 (QA Task 43c, Finding #1): prevent duplicate ACTIVE nodes per ZIP.
-- Root cause: two ACTIVE nodes shared zip_code '06850' (Norwalk Central + a
-- staging "Diag Test Node" 6bf728cf-c962-47d2-aa89-920b2cd83ce0). The app's
-- checkZipCodeHasActiveNode() used .maybeSingle(), which threw PGRST116 on 2+
-- rows and silently returned false → any user applying their active home ZIP in
-- Discover filters got a false "We're not live here yet" waitlist ask.
--
-- Two-part fix:
--   1. CODE (mobile, p2p-kids-marketplace/src/services/location.ts): the lookup
--      is now multi-row tolerant (`.limit(1)`; any active node ⇒ ZIP is live).
--   2. DATA (staging, applied before this migration): Diag members were re-homed
--      to Norwalk Central (550e8400-...-0001) and the Diag node deactivated.
--   3. THIS INDEX: enforces the invariant so future test/diagnostic nodes can't
--      leak into the active set on the same ZIP (defense-in-depth).
--
-- MODE: B (idempotent / re-runnable)
-- Precondition: no zip has >1 ACTIVE node (the CREATE fails otherwise). If a
-- future duplicate appears, resolve it BEFORE re-running (deactivate/delete the
-- non-canonical row) — the index CREATE is not self-healing by design.
--
-- Rollback: DROP INDEX IF EXISTS idx_nodes_unique_active_zip;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_unique_active_zip
  ON public.nodes (zip_code)
  WHERE is_active = true;

-- Verification (SQL-3):
--   SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_nodes_unique_active_zip';
--   -- Expect: partial UNIQUE index on public.nodes(zip_code) WHERE is_active = true
--   SELECT zip_code, count(*) FROM public.nodes WHERE is_active GROUP BY zip_code HAVING count(*) > 1;
--   -- Expect: 0 rows
