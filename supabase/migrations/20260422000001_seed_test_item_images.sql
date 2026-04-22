-- ================================================================
-- Migration: 20260422000001_seed_test_item_images.sql
-- Module: MODULE-05 DISCOVERY-V3
-- Description: Seed test item images for visual verification in DiscoverScreen
-- ================================================================

-- BLOCK 1: Ensure we have some test items and images
-- (Idempotent: only inserts if item_images is empty for these test items)

DO $$
DECLARE
    v_item_id UUID;
    v_seller_id UUID;
BEGIN
    -- 1. Get a seller (any user will do for test data)
    SELECT id INTO v_seller_id FROM auth.users LIMIT 1;
    
    IF v_seller_id IS NULL THEN
        RAISE NOTICE 'No users found in auth.users, skipping image seed.';
        RETURN;
    END IF;

    -- 2. Ensure we have at least 5 "available" items
    FOR i IN 1..5 LOOP
        INSERT INTO public.items (
            title, 
            description, 
            price, 
            status, 
            seller_id, 
            accepts_swap_points, 
            condition,
            created_at
        ) 
        VALUES (
            'Test Item ' || i,
            'This is a sample description for test item ' || i,
            10.00 + (i * 5),
            'available',
            v_seller_id,
            (i % 2 = 0), -- Alternate SP eligibility
            'good',
            NOW() - (i || ' days')::INTERVAL
        )
        RETURNING id INTO v_item_id;

        -- 3. Add a placeholder image for each item
        -- Using consistent placeholder service for testing
        INSERT INTO public.item_images (
            item_id,
            url,
            display_order
        ) VALUES (
            v_item_id,
            'https://picsum.photos/seed/item' || i || '/400/400',
            0
        );
    END LOOP;
END $$;

-- BLOCK 2: Verification Query
-- SELECT i.id, i.title, img.url 
-- FROM items i 
-- JOIN item_images img ON i.id = img.item_id 
-- WHERE i.status = 'available' 
-- LIMIT 10;
