-- verify_001_initial_schema.sql
-- Quick verification queries for the initial schema migration

-- 1) List tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2) Functions present
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname;

-- 3) Triggers present
SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY trigger_name;

-- 4) Basic function test: calculate_distance
SELECT calculate_distance(41.117447, -73.408230, 40.881893, -74.216759) AS miles_approx;

-- 5) Create test user / data (use service_role or SQL editor) to test triggers
-- NOTE: In production Supabase SQL Editor runs as service_role which bypasses RLS.

-- Create fake users for tests
INSERT INTO users (id, display_name, email) VALUES (uuid_generate_v4(), 'Test Seller', 'test-seller@example.com') RETURNING id;
INSERT INTO users (id, display_name, email) VALUES (uuid_generate_v4(), 'Test Buyer', 'test-buyer@example.com') RETURNING id;

-- 6) Create a test item and then favorite it to see trigger/favorites_count
WITH seller AS (
  SELECT id FROM users WHERE email = 'test-seller@example.com' LIMIT 1
), buyer AS (
  SELECT id FROM users WHERE email = 'test-buyer@example.com' LIMIT 1
)
INSERT INTO items (seller_id, title, price_cents, status) SELECT seller.id, 'Test Toy', 2000, 'active' FROM seller RETURNING id;

-- record a favorite (should increase favorites_count via trigger)
INSERT INTO favorites (user_id, item_id) SELECT (SELECT id FROM users WHERE email = 'test-buyer@example.com'), id FROM items WHERE title = 'Test Toy' LIMIT 1;

-- check favorites_count
SELECT title, favorites_count FROM items WHERE title = 'Test Toy';

-- 7) Points transaction -> release -> updates user balance
-- Create points tx (pending), then update to released and ensure sync_points_balance increments
INSERT INTO points_transactions (user_id, amount, reason, status) SELECT id, 100, 'signup bonus', 'pending' FROM users WHERE email = 'test-buyer@example.com' RETURNING id;

-- Release the transaction
UPDATE points_transactions SET status = 'released' WHERE user_id = (SELECT id FROM users WHERE email = 'test-buyer@example.com') AND status = 'pending';

-- Check user's swap_points_balance
SELECT id, display_name, swap_points_balance, lifetime_swap_points_earned FROM users WHERE email = 'test-buyer@example.com';

-- 8) Trade message expiry flow: create trade and update to completed to set messages.expires_at
-- Create a trade linked to item
INSERT INTO trades (item_id, buyer_id, seller_id, status) SELECT i.id, (SELECT id FROM users WHERE email = 'test-buyer@example.com'), (SELECT id FROM users WHERE email = 'test-seller@example.com'), 'initiated' FROM items i WHERE title = 'Test Toy' RETURNING id;

-- Add a message on the trade
INSERT INTO messages (trade_id, sender_id, recipient_id, content) SELECT id, (SELECT id FROM users WHERE email = 'test-buyer@example.com'), (SELECT id FROM users WHERE email = 'test-seller@example.com'), 'I want this' FROM trades t WHERE t.status = 'initiated' LIMIT 1 RETURNING id;

-- Now mark trade completed (trigger should set messages.expires_at to NOW() + interval '30 days')
UPDATE trades SET status = 'completed' WHERE status = 'initiated' AND id = (SELECT id FROM trades ORDER BY created_at DESC LIMIT 1);

-- Verify message expires_at
SELECT id, expires_at FROM messages WHERE content = 'I want this';

-- 9) Clean up: remove test data (optional)
-- DELETE FROM messages WHERE content = 'I want this';
-- DELETE FROM trades WHERE id IS NOT NULL AND created_at > NOW() - INTERVAL '1 hour';
-- DELETE FROM favorites WHERE created_at > NOW() - INTERVAL '1 hour';
-- DELETE FROM items WHERE title = 'Test Toy';
-- DELETE FROM points_transactions WHERE reason = 'signup bonus';
-- DELETE FROM users WHERE email IN ('test-seller@example.com', 'test-buyer@example.com');
