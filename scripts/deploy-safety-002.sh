#!/bin/bash
# SAFETY-002: Run Migration 305 - CPSC Recall Matching Logic
# This script provides verification queries to run BEFORE and AFTER the migration

set -e

echo "=============================================="
echo "SAFETY-002: Migration 305 Deployment Guide"
echo "=============================================="
echo ""
echo "This script provides SQL queries to run manually in Supabase SQL Editor."
echo "DO NOT run this script directly. Copy/paste the SQL blocks below."
echo ""

echo "=============================================="
echo "STEP 1: Pre-Migration Verification"
echo "=============================================="
echo ""
echo "Run these queries BEFORE applying migration 305:"
echo ""

cat <<'SQL1'
-- Verify SAFETY-001 (CPSC imports) is deployed
SELECT COUNT(*) as recall_count FROM cpsc_recalls;
-- Expected: > 0 (at least one recall imported)

-- Verify SAFETY-P003 (item statuses) is deployed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'items' AND column_name IN ('flagged_at', 'rejected_at');
-- Expected: 2 rows (flagged_at and rejected_at columns exist)

-- Check if item_safety_flags table already exists (should NOT exist)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'item_safety_flags'
) as table_exists;
-- Expected: false (table does not exist yet)

-- Check if check_cpsc_recalls function already exists (should NOT exist)
SELECT EXISTS (
  SELECT FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name = 'check_cpsc_recalls'
) as function_exists;
-- Expected: false (function does not exist yet)

-- Verify pg_trgm extension availability
SELECT * FROM pg_available_extensions WHERE name = 'pg_trgm';
-- Expected: 1 row (extension is available)

SQL1

echo ""
echo "✅ If all pre-checks pass, proceed to STEP 2."
echo ""

echo "=============================================="
echo "STEP 2: Run Migration 305"
echo "=============================================="
echo ""
echo "1. Open Supabase Dashboard → SQL Editor"
echo "2. Copy contents of: supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql"
echo "3. Paste into SQL Editor"
echo "4. Click 'Run'"
echo "5. Wait for 'Success' message"
echo ""
echo "Migration location:"
echo "  File: supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql"
echo ""

echo "=============================================="
echo "STEP 3: Post-Migration Verification"
echo "=============================================="
echo ""
echo "Run these queries AFTER applying migration 305:"
echo ""

cat <<'SQL2'
-- Verify pg_trgm extension enabled
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
-- Expected: 1 row (extension enabled)

-- Verify item_safety_flags table created
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'item_safety_flags'
ORDER BY ordinal_position;
-- Expected: 11 rows (all columns: id, item_id, flag_type, flag_reason, 
--   confidence_score, recall_id, status, reviewed_by, reviewed_at, 
--   created_at, updated_at)

-- Verify check_cpsc_recalls function created
SELECT routine_name, routine_type, data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'check_cpsc_recalls';
-- Expected: 1 row (function exists, returns SETOF record)

-- Verify indexes created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'item_safety_flags';
-- Expected: 4 rows (primary key + 3 performance indexes)

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'item_safety_flags';
-- Expected: 1 row with rowsecurity = true

-- Verify RLS policies created
SELECT policyname, cmd, permissive, roles
FROM pg_policies 
WHERE tablename = 'item_safety_flags'
ORDER BY policyname;
-- Expected: 4 rows (select_own, select_admin, insert_service, update_admin)

-- Test check_cpsc_recalls function with sample data
SELECT * FROM check_cpsc_recalls('Fisher-Price Rock n Play', NULL);
-- Expected: 0 or more rows with recall matches and similarity scores
-- If cpsc_recalls table has "Fisher-Price Rock 'n Play" recall, 
--   should return >= 1 row with similarity_score >= 0.3

-- Test function with safe product (should return no matches above threshold)
SELECT * FROM check_cpsc_recalls('wooden building blocks', 'safe toy');
-- Expected: 0 rows (no matches above threshold)

SQL2

echo ""
echo "✅ If all post-checks pass, migration deployed successfully!"
echo ""

echo "=============================================="
echo "STEP 4: Deploy Edge Function"
echo "=============================================="
echo ""
echo "Run this command from the project root:"
echo ""
echo "  cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace"
echo "  supabase functions deploy check-item-safety"
echo ""
echo "Verify deployment:"
echo ""
echo "  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-item-safety \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -H \"Authorization: Bearer YOUR_ANON_KEY\" \\"
echo "    -d '{\"itemId\":\"test\",\"title\":\"Wooden blocks\",\"description\":\"Safe toy\"}'"
echo ""
echo "Expected response:"
echo '  {"success":true,"flagged":false,"reason":null,"match":null,"confidence":null}'
echo ""

echo "=============================================="
echo "STEP 5: Optional - Configure Admin Settings"
echo "=============================================="
echo ""
echo "Run these queries to configure CPSC checking behavior:"
echo ""

cat <<'SQL3'
-- Enable CPSC checking (default: true)
INSERT INTO admin_config (key, value) 
VALUES ('cpsc_check_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- Set confidence threshold (default: 0.5)
-- Items with similarity_score >= this value will be auto-flagged
INSERT INTO admin_config (key, value) 
VALUES ('cpsc_match_threshold', '0.5')
ON CONFLICT (key) DO UPDATE SET value = '0.5';

-- Verify settings
SELECT key, value FROM admin_config 
WHERE key IN ('cpsc_check_enabled', 'cpsc_match_threshold');
-- Expected: 2 rows

SQL3

echo ""
echo "✅ Configuration complete!"
echo ""

echo "=============================================="
echo "NEXT STEPS"
echo "=============================================="
echo ""
echo "1. Review: SAFETY-002-MANUAL-TESTING-GUIDE.md"
echo "2. Run unit tests: npm run test:unit -- safety.test.ts"
echo "3. Run E2E tests: RUN_SUPABASE_E2E=true npm run test:e2e -- cpsc-recall-matching.e2e.test.ts"
echo "4. Run Maestro tests: npm run test:maestro:ios -- .maestro/safety-002-cpsc-recall-matching.yaml"
echo "5. Complete manual testing checklist (7 test cases)"
echo "6. Review: SAFETY-002-IMPLEMENTATION-SUMMARY.md for full details"
echo ""
echo "=============================================="
echo "END OF DEPLOYMENT GUIDE"
echo "=============================================="
