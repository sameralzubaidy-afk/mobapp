-- ================================================================
-- PgTAP Test: item_drafts triggers
-- Task: LISTING-V3-010
-- Test file: supabase/tests/item_drafts.sql
-- Run: supabase test db
-- ================================================================

BEGIN;
SELECT plan(10);

-- ================================================================
-- TEST 1: updated_at trigger automatically updates timestamp
-- ================================================================

-- Insert test draft
INSERT INTO public.item_drafts (id, seller_id, draft_data, step)
VALUES ('draft-test-1', (SELECT id FROM auth.users LIMIT 1), '{"title":"Test"}'::jsonb, 'photos');

-- Store initial updated_at
SELECT updated_at INTO TEMP temp_initial_time FROM public.item_drafts WHERE id = 'draft-test-1';

-- Wait 1 second
SELECT pg_sleep(1);

-- Update the draft
UPDATE public.item_drafts
SET draft_data = '{"title":"Updated"}'::jsonb
WHERE id = 'draft-test-1';

-- Verify updated_at changed
SELECT ok(
  (SELECT updated_at FROM public.item_drafts WHERE id = 'draft-test-1') > 
  (SELECT updated_at FROM temp_initial_time),
  'updated_at should be automatically updated on UPDATE'
);

-- Clean up
DELETE FROM public.item_drafts WHERE id = 'draft-test-1';
DROP TABLE temp_initial_time;

-- ================================================================
-- TEST 2: max-5 drafts trigger enforces limit per seller
-- ================================================================

-- Get a test seller
DO $$
DECLARE
  v_seller_id UUID;
  v_draft_count INT;
BEGIN
  -- Create or get test seller
  SELECT id INTO v_seller_id FROM auth.users LIMIT 1;
  
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users found for testing';
  END IF;

  -- Clean up any existing drafts for this seller
  DELETE FROM public.item_drafts WHERE seller_id = v_seller_id;

  -- Insert 5 drafts (max allowed)
  FOR i IN 1..5 LOOP
    INSERT INTO public.item_drafts (seller_id, draft_data, step)
    VALUES (v_seller_id, jsonb_build_object('title', 'Draft ' || i), 'photos');
  END LOOP;

  -- Verify 5 drafts exist
  SELECT COUNT(*) INTO v_draft_count FROM public.item_drafts WHERE seller_id = v_seller_id;
  PERFORM ok(v_draft_count = 5, 'Should have exactly 5 drafts after inserting 5');

  -- Insert 6th draft (should trigger eviction of oldest)
  INSERT INTO public.item_drafts (seller_id, draft_data, step)
  VALUES (v_seller_id, '{"title":"Draft 6"}'::jsonb, 'photos');

  -- Wait for trigger to execute
  PERFORM pg_sleep(0.1);

  -- Verify still only 5 drafts
  SELECT COUNT(*) INTO v_draft_count FROM public.item_drafts WHERE seller_id = v_seller_id;
  PERFORM ok(v_draft_count = 5, 'Should still have exactly 5 drafts after inserting 6th (oldest evicted)');

  -- Verify newest draft exists and oldest was removed
  PERFORM ok(
    EXISTS(SELECT 1 FROM public.item_drafts WHERE seller_id = v_seller_id AND draft_data->>'title' = 'Draft 6'),
    'Newest draft (Draft 6) should exist'
  );

  PERFORM ok(
    NOT EXISTS(SELECT 1 FROM public.item_drafts WHERE seller_id = v_seller_id AND draft_data->>'title' = 'Draft 1'),
    'Oldest draft (Draft 1) should have been evicted'
  );

  -- Clean up
  DELETE FROM public.item_drafts WHERE seller_id = v_seller_id;
END;
$$;

-- ================================================================
-- TEST 3: Trigger does not affect drafts from other sellers
-- ================================================================

DO $$
DECLARE
  v_seller1_id UUID;
  v_seller2_id UUID;
  v_count_seller1 INT;
  v_count_seller2 INT;
BEGIN
  -- Get two different sellers
  SELECT id INTO v_seller1_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_seller2_id FROM auth.users WHERE id != v_seller1_id ORDER BY created_at LIMIT 1;

  IF v_seller2_id IS NULL THEN
    -- Create second test user if needed
    RAISE NOTICE 'Only one user found, test may be limited';
    v_seller2_id := v_seller1_id;
  END IF;

  -- Clean up
  DELETE FROM public.item_drafts WHERE seller_id IN (v_seller1_id, v_seller2_id);

  -- Seller 1: Insert 5 drafts
  FOR i IN 1..5 LOOP
    INSERT INTO public.item_drafts (seller_id, draft_data, step)
    VALUES (v_seller1_id, jsonb_build_object('seller', 1, 'draft', i), 'photos');
  END LOOP;

  -- Seller 2: Insert 3 drafts
  FOR i IN 1..3 LOOP
    INSERT INTO public.item_drafts (seller_id, draft_data, step)
    VALUES (v_seller2_id, jsonb_build_object('seller', 2, 'draft', i), 'photos');
  END LOOP;

  -- Verify counts
  SELECT COUNT(*) INTO v_count_seller1 FROM public.item_drafts WHERE seller_id = v_seller1_id;
  SELECT COUNT(*) INTO v_count_seller2 FROM public.item_drafts WHERE seller_id = v_seller2_id;

  PERFORM ok(v_count_seller1 = 5, 'Seller 1 should have 5 drafts');
  PERFORM ok(v_count_seller2 = 3, 'Seller 2 should have 3 drafts');

  -- Seller 1: Insert 6th draft
  INSERT INTO public.item_drafts (seller_id, draft_data, step)
  VALUES (v_seller1_id, '{"seller":1,"draft":6}'::jsonb, 'photos');

  PERFORM pg_sleep(0.1);

  -- Re-check counts
  SELECT COUNT(*) INTO v_count_seller1 FROM public.item_drafts WHERE seller_id = v_seller1_id;
  SELECT COUNT(*) INTO v_count_seller2 FROM public.item_drafts WHERE seller_id = v_seller2_id;

  PERFORM ok(v_count_seller1 = 5, 'Seller 1 should still have 5 drafts (oldest evicted)');
  PERFORM ok(v_count_seller2 = 3, 'Seller 2 should still have 3 drafts (unaffected)');

  -- Clean up
  DELETE FROM public.item_drafts WHERE seller_id IN (v_seller1_id, v_seller2_id);
END;
$$;

-- ================================================================
-- TEST 4: Expires_at default is 7 days from now
-- ================================================================

INSERT INTO public.item_drafts (id, seller_id, draft_data, step)
VALUES ('draft-expiry-test', (SELECT id FROM auth.users LIMIT 1), '{}'::jsonb, 'photos');

SELECT ok(
  (SELECT expires_at FROM public.item_drafts WHERE id = 'draft-expiry-test') >
  NOW() + INTERVAL '6 days 23 hours',
  'expires_at should be at least ~7 days from now'
);

SELECT ok(
  (SELECT expires_at FROM public.item_drafts WHERE id = 'draft-expiry-test') <
  NOW() + INTERVAL '7 days 1 hour',
  'expires_at should be no more than ~7 days from now'
);

DELETE FROM public.item_drafts WHERE id = 'draft-expiry-test';

SELECT * FROM finish();
ROLLBACK;
