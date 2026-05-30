-- BADGES-V2-007: Pre-Testing SQL Verification
-- Run this in Supabase SQL Editor BEFORE manual testing
-- Date: January 12, 2026

-- =============================================================================
-- STEP 1: Verify badge-icons storage bucket exists
-- =============================================================================

SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'badge-icons';

-- Expected: 1 row
-- id = 'badge-icons'
-- public = true
-- file_size_limit = 5242880 (5MB)
-- allowed_mime_types = {image/png, image/jpeg, image/jpg, image/webp, image/svg+xml}

-- =============================================================================
-- STEP 2: Verify RLS policies on badge-icons bucket
-- =============================================================================

SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%badge icon%'
ORDER BY policyname;

-- Expected: 4 policies
-- 1. Public read access for badge icons (SELECT)
-- 2. Admin users can upload badge icons (INSERT)
-- 3. Admin users can update badge icons (UPDATE)
-- 4. Admin users can delete badge icons (DELETE)

-- =============================================================================
-- STEP 3: Verify badges table schema
-- =============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'badges'
ORDER BY ordinal_position;

-- Expected columns:
-- id, name, description, category, icon_url, threshold, 
-- is_active, sort_order, is_archived, created_at, updated_at

-- =============================================================================
-- STEP 4: Count existing badges
-- =============================================================================

SELECT 
  category,
  COUNT(*) as badge_count,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN icon_url IS NOT NULL THEN 1 ELSE 0 END) as with_icon_count
FROM badges
GROUP BY category
ORDER BY category;

-- Shows badge distribution by category and icon status

-- =============================================================================
-- STEP 5: Verify manual_award_badge RPC exists
-- =============================================================================

SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'manual_award_badge';

-- Expected: 1 function
-- Arguments: p_user_id uuid, p_badge_id uuid, p_reason text
-- Returns: json

-- =============================================================================
-- STEP 6: Verify badge_audit_logs table exists
-- =============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'badge_audit_logs'
ORDER BY ordinal_position;

-- Expected columns:
-- id, badge_id, user_id, admin_id, action_type, reason, created_at

-- =============================================================================
-- STEP 7: Test badge icon public URL access
-- =============================================================================

-- Get a badge with icon_url (if any exist)
SELECT 
  id,
  name,
  icon_url,
  CASE 
    WHEN icon_url IS NOT NULL THEN 'Test URL in browser'
    ELSE 'No icon yet'
  END as test_instruction
FROM badges
WHERE icon_url IS NOT NULL
LIMIT 1;

-- If icon_url exists, copy the URL and test in browser (should load without auth)

-- =============================================================================
-- STEP 8: Verify admin user exists
-- =============================================================================

SELECT 
  id,
  email,
  raw_user_meta_data->>'is_admin' as is_admin,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'is_admin' = 'true'
LIMIT 5;

-- Expected: At least 1 admin user
-- is_admin should be 'true'

-- =============================================================================
-- STEP 9: Sample test data for manual award
-- =============================================================================

-- Get a test user for manual award testing
SELECT 
  p.user_id,
  p.email,
  p.display_name,
  COUNT(ub.id) as current_badge_count
FROM profiles p
LEFT JOIN user_badges ub ON p.user_id = ub.user_id
GROUP BY p.user_id, p.email, p.display_name
ORDER BY current_badge_count ASC
LIMIT 3;

-- Use one of these users for TC-008 and TC-009

-- =============================================================================
-- STEP 10: Recent uploads check
-- =============================================================================

SELECT 
  name,
  created_at,
  (metadata->>'size')::bigint / 1024 as size_kb,
  metadata->>'mimetype' as mime_type
FROM storage.objects
WHERE bucket_id = 'badge-icons'
ORDER BY created_at DESC
LIMIT 10;

-- Shows recent icon uploads

-- =============================================================================
-- VERIFICATION COMPLETE
-- =============================================================================

-- ✅ All checks passed? You're ready to test!
-- ❌ Any checks failed? Fix before proceeding:
--
-- Missing bucket? Run: supabase/migrations/20260111000001_badge_icons_storage.sql
-- Missing RPC? Run: supabase/migrations/085_admin_badge_rpc.sql (if exists)
-- Missing admin user? Create via auth.users or Supabase Dashboard

-- =============================================================================
-- POST-TESTING VERIFICATION QUERIES
-- =============================================================================

-- After TC-003 (Icon Upload), verify:
SELECT 
  id,
  name,
  icon_url,
  updated_at
FROM badges
WHERE icon_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- After TC-009 (Manual Award), verify:
SELECT 
  ub.id,
  ub.user_id,
  b.name as badge_name,
  ub.awarded_at,
  bal.reason
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
LEFT JOIN badge_audit_logs bal ON bal.user_id = ub.user_id AND bal.badge_id = ub.badge_id
WHERE bal.action_type = 'manual_award'
ORDER BY ub.awarded_at DESC
LIMIT 5;
