-- FILE: supabase/migrations/20260420000009_reorder_categories_rpc.sql
-- ADMIN-V3-001: Create reorder_categories() RPC
-- Module: MODULE-12-ADMIN-V3-CATEGORIES
-- Dependencies: categories, admin_has_role(UUID)

-- ===========================================================================
-- STEP 1: Create RPC Function
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.reorder_categories(
  p_category_orders JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_order_record RECORD;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required'
      USING HINT = 'User must be logged in to reorder categories';
  END IF;

  -- Verify user has admin role
  v_is_admin := public.admin_has_role(v_user_id);

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required'
      USING HINT = 'Only admins can reorder categories';
  END IF;

  -- Validate input is an array
  IF jsonb_typeof(p_category_orders) != 'array' THEN
    RAISE EXCEPTION 'Invalid input: category_orders must be a JSONB array'
      USING HINT = 'Expected format: [{"id": "uuid", "display_order": 1}, ...]';
  END IF;

  -- Update display_order for each category
  FOR v_order_record IN
    SELECT
      (elem->>'id')::UUID AS category_id,
      (elem->>'display_order')::INT AS new_display_order
    FROM jsonb_array_elements(p_category_orders) AS elem
  LOOP
    -- Validate category_id and display_order are present
    IF v_order_record.category_id IS NULL OR v_order_record.new_display_order IS NULL THEN
      RAISE EXCEPTION 'Invalid input: Each array element must have id and display_order'
        USING HINT = 'Ensure all elements have both id (UUID) and display_order (integer)';
    END IF;

    -- Update the category display_order
    UPDATE public.categories
    SET display_order = v_order_record.new_display_order,
        updated_at = NOW()  -- Assuming updated_at column exists
    WHERE id = v_order_record.category_id;

    -- Note: If category doesn't exist, UPDATE will silently skip it
    -- This is acceptable as front-end should only send valid IDs
  END LOOP;

  -- Success (no return value for void function)
  RETURN;
END;
$$;

-- ===========================================================================
-- STEP 2: Add Function Comment
-- ===========================================================================

COMMENT ON FUNCTION public.reorder_categories(JSONB) IS 
  'Admin-only RPC to batch-update category display_order. Input: [{"id": "uuid", "display_order": 1}, ...]';

-- ===========================================================================
-- STEP 3: Grant Execute Permission
-- ===========================================================================

-- Grant execute to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION public.reorder_categories(JSONB) TO authenticated;

-- ===========================================================================
-- VERIFICATION QUERIES (Commented)
-- ===========================================================================

/*
-- Verify function exists and is SECURITY DEFINER
SELECT 
  proname,
  prosecdef,
  proargnames,
  pg_get_function_arguments(oid) AS arguments,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname = 'reorder_categories';

-- Verify function permissions
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'reorder_categories'
  AND routine_schema = 'public';

-- Test function with admin user
/*
-- First, ensure your user resolves as admin via admin_has_role(auth.uid())
-- Then call as that user:

SELECT public.reorder_categories(
  '[
    {"id": "category-uuid-1", "display_order": 1},
    {"id": "category-uuid-2", "display_order": 2},
    {"id": "category-uuid-3", "display_order": 3}
  ]'::JSONB
);

-- Verify updated display_order
SELECT id, name, display_order
FROM public.categories
ORDER BY display_order;
*/

-- Test function with non-admin user (should fail)
/*
-- Switch to a non-admin user context and try:
SELECT public.reorder_categories('[]'::JSONB);
-- Expected: ERROR - Unauthorized: Admin role required
*/

-- Test with invalid input (should fail)
/*
SELECT public.reorder_categories('{"not": "an array"}'::JSONB);
-- Expected: ERROR - Invalid input: category_orders must be a JSONB array
*/
*/
