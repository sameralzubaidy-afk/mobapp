-- File: supabase/migrations/20260729000002_get_listing_by_id_tax_category.sql
-- Follow-up to 20260729000001_tax_category_aware_preview.sql.
-- get_listing_by_id() (the RLS-bypass fallback used when a listing is viewed
-- from another node) built its JSONB response field-by-field and never
-- included tax_category_id, so ItemDetailScreen's tax preview had no way to
-- know the item's category when it hit this fallback path.
--
-- Mode B: idempotent rerunnable migration. Same UUID arg + JSONB return type
-- as before, so CREATE OR REPLACE is safe (no DROP needed — see BP-12).

CREATE OR REPLACE FUNCTION public.get_listing_by_id(
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_category JSONB;
  v_seller JSONB;
  v_images JSONB;
BEGIN
  SELECT row_to_json(i)::JSONB INTO v_item
  FROM public.items i
  WHERE i.id = p_listing_id;

  IF v_item IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_item->>'category_id' IS NOT NULL THEN
    SELECT row_to_json(c)::JSONB INTO v_category
    FROM public.categories c
    WHERE c.id = (v_item->>'category_id')::UUID;
  END IF;

  SELECT row_to_json(p)::JSONB INTO v_seller
  FROM public.profiles p
  WHERE p.user_id = (v_item->>'seller_id')::UUID;

  SELECT COALESCE(jsonb_agg(row_to_json(img)::JSONB ORDER BY img.display_order ASC), '[]'::JSONB) INTO v_images
  FROM public.item_images img
  WHERE img.item_id = p_listing_id;

  RETURN jsonb_build_object(
    'id', v_item->>'id',
    'seller_id', v_item->>'seller_id',
    'title', v_item->>'title',
    'description', v_item->>'description',
    'price', v_item->>'price',
    'category_id', v_item->>'category_id',
    'tax_category_id', v_item->>'tax_category_id',
    'condition', v_item->>'condition',
    'status', v_item->>'status',
    'accepts_swap_points', v_item->>'accepts_swap_points',
    'seller_subscription_status_at_creation', v_item->>'seller_subscription_status_at_creation',
    'brand', v_item->>'brand',
    'color', v_item->>'color',
    'age_group', v_item->>'age_group',
    'gender', v_item->>'gender',
    'requested_category_name', v_item->>'requested_category_name',
    'flagged_at', v_item->>'flagged_at',
    'flagged_reason', v_item->>'flagged_reason',
    'rejected_at', v_item->>'rejected_at',
    'rejection_reason', v_item->>'rejection_reason',
    'moderation_note', v_item->>'moderation_note',
    'appeal_count', COALESCE((v_item->>'appeal_count')::INT, 0),
    'appeal_reason', v_item->>'appeal_reason',
    'appealed_at', v_item->>'appealed_at',
    'edited_since_rejection', (v_item->>'edited_since_rejection')::BOOLEAN,
    'edited_since_rejection_at', v_item->>'edited_since_rejection_at',
    'created_at', v_item->>'created_at',
    'updated_at', v_item->>'updated_at',
    'sold_at', v_item->>'sold_at',
    'category', v_category,
    'seller', CASE WHEN v_seller IS NOT NULL THEN
      jsonb_build_object(
        'id', v_seller->>'user_id',
        'name', v_seller->>'name',
        'avatar_url', v_seller->>'avatar_url'
      )
    ELSE NULL END,
    'images', v_images
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_listing_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_by_id(UUID) TO service_role;

-- Verification:
-- SELECT get_listing_by_id((SELECT id FROM items LIMIT 1)) -> 'tax_category_id';
-- -- expect a non-null UUID string (or null if that item has no category assigned)
