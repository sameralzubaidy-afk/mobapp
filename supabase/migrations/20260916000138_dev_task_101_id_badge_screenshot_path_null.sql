-- ============================================================================
-- Migration: 20260903120000_dev_task_101_id_badge_screenshot_path_null.sql
-- Task: DEV-TASK-101 item 6a — null dangling screenshot_path on decided rows
-- Mode B: Idempotent / rerunnable (UPDATE ... WHERE ... IS NOT NULL is a no-op
-- when the column is already NULL on every decided row).
--
-- Context: id_badge_verification_requests.screenshot_path stores the Supabase
-- Storage path of the uploaded ID photo (set by the mobile submit path in
-- src/services/idBadge.ts). When an admin makes a decision (approve/reject),
-- the admin decide route (p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/
-- decide/route.ts) deletes the storage OBJECT for privacy ("The ID screenshot was
-- permanently deleted following the review decision..."), but until DEV-TASK-101
-- the DB row kept the now-dangling path string (QA Task 25 finding #5).
--
-- Fix (two parts — decisions are inline client updates, not an RPC, so a SQL-only
-- backfill cannot keep FUTURE rows clean by itself):
--   1) CODE: decide/route.ts now writes screenshot_path: NULL in the same update
--      that sets status/reviewed_at.
--   2) THIS MIGRATION: backfills any pre-existing decided rows that still carry a
--      path string, so every approved/rejected row is consistent going forward.
--
-- Nulling is UI-safe: the admin details page never renders the image (it assumes
-- deletion), and the review page only fetches a signed URL while a request is
-- still pending.
-- ============================================================================

-- 1) Backfill — clear dangling screenshot paths on every decided request.
UPDATE public.id_badge_verification_requests
SET screenshot_path = NULL
WHERE status IN ('approved', 'rejected')
  AND screenshot_path IS NOT NULL;

-- 2) Verification — no decided row may still carry a screenshot_path.
--    Expected: 0 rows.
SELECT COUNT(*) AS dangling_decided_paths
FROM public.id_badge_verification_requests
WHERE status IN ('approved', 'rejected')
  AND screenshot_path IS NOT NULL;

-- 3) Cross-check (informational): any remaining non-NULL paths should be on
--    pending requests only.
SELECT status, COUNT(*) AS rows_with_path
FROM public.id_badge_verification_requests
WHERE screenshot_path IS NOT NULL
GROUP BY status
ORDER BY status;
