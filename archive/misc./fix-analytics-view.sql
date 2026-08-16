-- ================================================================
-- FIX: Analytics View - Correct Status Values
-- ================================================================
-- Problem: View was using status = 'active' and 'paused'
--          But database has: 'available', 'pending', 'draft', 'sold', 'deleted'
-- Solution: Update view to use correct status values
-- ================================================================

-- Step 1: Drop existing view
DROP VIEW IF EXISTS listing_admin_analytics CASCADE;

-- Step 2: Recreate view with CORRECT status values
CREATE VIEW listing_admin_analytics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'available') as active_listings,
  COUNT(*) FILTER (WHERE status = 'deleted') as deleted_listings,
  COUNT(*) FILTER (WHERE status = 'pending') as paused_listings,
  COUNT(*) FILTER (WHERE accepts_swap_points = true) as sp_eligible_listings,
  COUNT(*) FILTER (WHERE accepts_swap_points = true AND status = 'available') as active_sp_listings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE accepts_swap_points = true) / NULLIF(COUNT(*), 0), 2) as sp_adoption_rate,
  AVG(CAST(price AS DECIMAL)) as avg_listing_price,
  MIN(price) as min_listing_price,
  MAX(price) as max_listing_price,
  COUNT(DISTINCT seller_id) as total_sellers,
  COUNT(DISTINCT DATE(created_at)) as days_active
FROM items
WHERE created_at > NOW() - INTERVAL '30 days';

-- Step 3: Verify view created
SELECT viewname FROM pg_views WHERE viewname = 'listing_admin_analytics';

-- Step 4: Test query - check results
SELECT * FROM listing_admin_analytics;
