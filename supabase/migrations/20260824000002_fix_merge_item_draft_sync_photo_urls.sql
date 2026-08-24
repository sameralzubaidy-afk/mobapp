-- ================================================================
-- Migration: Keep item_drafts.photo_urls column in sync (Group J Fix 3)
-- Date: 2026-08-24
-- Task: Group J closure — Fix 3 (item_drafts.photo_urls column drift)
--
-- Description:
--   merge_item_draft only merged draft_data, so the separate photo_urls
--   column went stale after reorder/remove/update. The column IS a real
--   consumer (draftService.publishDraft reads it directly to create the
--   listing; resume/banner use it as a fallback), so it must be kept in
--   sync — NOT deprecated. This migration:
--     1) rewrites the RPC to refresh photo_urls from p_updates->'photo_urls'
--        when present (canonical source: draft_data.photo_urls)
--     2) backfills existing rows from draft_data->'photo_urls' (idempotent)
--
-- Mode: B (idempotent rerunnable — CREATE OR REPLACE + safe backfill)
-- ================================================================

-- ------------------------------------------------------------------
-- BLOCK 1 — Schema: refresh photo_urls column from p_updates when present
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_item_draft(
  p_draft_id uuid,
  p_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.item_drafts
  SET
    draft_data = COALESCE(draft_data, '{}'::jsonb) || p_updates,
    photo_urls = CASE
      WHEN p_updates ? 'photo_urls' AND jsonb_typeof(p_updates->'photo_urls') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_updates->'photo_urls'))
      ELSE photo_urls
    END,
    updated_at = NOW()
  WHERE id = p_draft_id
    AND seller_id = auth.uid();
END;
$$;

-- ------------------------------------------------------------------
-- BLOCK 2 — Data repair: backfill the column from draft_data (canonical
-- source) for existing drafts, so stale rows are corrected in one pass.
-- Idempotent: rows without a photo_urls array in draft_data are skipped.
-- ------------------------------------------------------------------
UPDATE public.item_drafts
SET photo_urls = ARRAY(
  SELECT jsonb_array_elements_text(draft_data->'photo_urls')
)
WHERE draft_data ? 'photo_urls'
  AND jsonb_typeof(draft_data->'photo_urls') = 'array';

-- ================================================================
-- VERIFICATION QUERIES (run in the Supabase SQL Editor, one per call):
-- ================================================================
-- 1) Function body now contains the photo_urls sync:
--    SELECT pg_get_functiondef('public.merge_item_draft(p_draft_id uuid, p_updates jsonb)'::regprocedure);
--
-- 2) Column in sync with draft_data for any remaining stale rows (expect 0):
--    SELECT count(*)
--    FROM public.item_drafts
--    WHERE draft_data ? 'photo_urls'
--      AND jsonb_typeof(draft_data->'photo_urls') = 'array'
--      AND photo_urls IS DISTINCT FROM ARRAY(
--        SELECT jsonb_array_elements_text(draft_data->'photo_urls')
--      );
--
-- 3) RPC smoke test (run as an authenticated seller; p_draft_id = a row the
--    seller owns):
--    SELECT public.merge_item_draft('<draft_id>'::uuid, '{"photo_urls":["a.png","b.png"]}'::jsonb);
--    SELECT photo_urls, draft_data->'photo_urls' AS dd_photo_urls
--    FROM public.item_drafts
--    WHERE id = '<draft_id>'::uuid;
--
-- Common failure modes:
--   - jsonb_array_elements_text on a non-array value → guarded by the
--     jsonb_typeof(...) = 'array' check in both the CASE and the backfill.
--   - SECURITY DEFINER with SET search_path = public (documented why: RPC
--     runs as the draft owner via auth.uid(), matching the RLS policy).
