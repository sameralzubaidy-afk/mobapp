-- DEPRECATED: PROD-P005 COPPA Enforcement — Removed per product decision
--
-- Removes the COPPA compliance server-side enforcement triggers and functions.
-- COPPA is no longer a product requirement for this platform. Users of any age
-- can create listings and initiate trades without parental consent gates.
--
-- Rollback: Apply 20260601000001_coppa_enforcement.sql again.

-- ----------------------------------------------------------------------------
-- 1) Drop triggers (order matters: drop before functions they call)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_coppa_check_trade_insert ON public.trades;
DROP TRIGGER IF EXISTS trigger_coppa_check_item_insert ON public.items;

-- ----------------------------------------------------------------------------
-- 2) Drop functions
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.enforce_coppa(UUID, TEXT);
DROP FUNCTION IF EXISTS public.is_coppa_compliant(UUID);

-- ----------------------------------------------------------------------------
-- Verification
-- ----------------------------------------------------------------------------
SELECT 'coppa_enforcement' AS migration,
       'dropped' AS status,
       'COPPA enforcement triggers and functions removed per product decision (deprecated)' AS note;
