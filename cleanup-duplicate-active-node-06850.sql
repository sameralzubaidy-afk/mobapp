-- cleanup-duplicate-active-node-06850.sql
-- FIX-Task-2 (QA Task 43c, Finding #1) — staging data cleanup, EXECUTED 2026-09-07.
--
-- PROBLEM: two ACTIVE nodes shared zip_code '06850' — "Norwalk Central"
-- (550e8400-e29b-41d4-a716-446655440001) and the diagnostic "Diag Test Node"
-- (6bf728cf-c962-47d2-aa89-920b2cd83ce0). checkZipCodeHasActiveNode()
-- (p2p-kids-marketplace/src/services/location.ts) used .maybeSingle(), which
-- threw PGRST116 on 2+ rows → returned false → any user applying their active
-- home ZIP 06850 in Discover filters got a false "We're not live here yet"
-- waitlist ask (the 43c MODERATE Finding #1).
--
-- SCOPE / QA-SAFETY (this was gated before execution):
--   * Impact assessment first (read-only): only 4 profiles were on Diag
--     (qa-payout-seller f2, qa-wallet f1, + 2 disposable QA personas). Historical
--     child-row node tags (items/trades/payments/sp_ledger/analytics/audit…) were
--     INTENTIONALLY left unchanged — they are data provenance and resolve via the
--     still-present (now inactive) Diag row. Re-tagging history would corrupt
--     audit/analytics attribution.
--   * Diag is DEACTIVATED, not deleted → FK references still resolve.
--   * Executed in a coordinated window (no QA run in flight).
--
-- EFFECTS ON QA BASELINES (tracker note added): Diag Test Node is no longer an
-- ACTIVE node; qa-payout-seller / qa-wallet (and 2 disposable personas) are now
-- members of Norwalk Central (the canonical 06850 node — a RESTORE of the
-- pre-diag baseline). Admin cases that used Diag as an active-node subject
-- (ADM-TC-E03 deactivate-with-members-warning, ADM-TC-E07 per-node KPI row,
-- N6/FG-1 write-trigger auto-pop assertions) must use another active node with
-- members (e.g. Norwalk Central) or re-derive expectations from the DB.

-- ============ EXECUTED (idempotent — safe to re-run) ============

-- 1) Re-home the 4 Diag members to Norwalk Central (guard: target node exists).
UPDATE public.profiles
SET node_id = '550e8400-e29b-41d4-a716-446655440001',
    updated_at = now()
WHERE node_id = '6bf728cf-c962-47d2-aa89-920b2cd83ce0'
  AND EXISTS (SELECT 1 FROM public.nodes WHERE id = '550e8400-e29b-41d4-a716-446655440001');

-- 2) Deactivate (NOT delete) the Diag Test Node.
UPDATE public.nodes
SET is_active = false,
    updated_at = now()
WHERE id = '6bf728cf-c962-47d2-aa89-920b2cd83ce0'
  AND is_active = true;

-- ============ VERIFICATION (post-execution, all confirmed 2026-09-07) ============
--   SELECT id, name, zip_code, is_active FROM public.nodes WHERE zip_code='06850';
--     → Norwalk Central is_active=true ; Diag Test Node is_active=false
--   SELECT count(*) FROM public.profiles WHERE node_id='6bf728cf-c962-47d2-aa89-920b2cd83ce0';
--     → 0
--   SELECT zip_code, count(*) FROM public.nodes WHERE is_active GROUP BY zip_code HAVING count(*)>1;
--     → 0 rows
--   (index added separately via migration 20260907000001_fix_unique_active_node_zip.sql)

-- ============ ROLLBACK (if ever needed) ============
-- UPDATE public.nodes SET is_active = true, updated_at = now()
--   WHERE id = '6bf728cf-c962-47d2-aa89-920b2cd83ce0';
-- UPDATE public.profiles SET node_id = '6bf728cf-c962-47d2-aa89-920b2cd83ce0', updated_at = now()
--   WHERE user_id IN (
--     'a1234567-0000-0000-0000-0000000000f2',  -- qa-payout-seller
--     'a1234567-0000-0000-0000-0000000000f1',  -- qa-wallet
--     'ad056449-a079-4ba8-b9cb-fdecadeee9ee',  -- qa.alice.17884399976227073
--     'a833ab5c-a50a-4ef6-9375-7ed2ec38bfa0'   -- test433qa.bob.17884321960608022
--   );
-- DROP INDEX IF EXISTS idx_nodes_unique_active_zip;  -- matches migration rollback
