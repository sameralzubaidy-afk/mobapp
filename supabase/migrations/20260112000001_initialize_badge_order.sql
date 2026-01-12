-- filepath: supabase/migrations/20260112000001_initialize_badge_order.sql

-- Initialize sort_order for existing badges to avoid 0 for everyone
-- This makes it easier to re-order them in the Admin Portal

-- SP Earning (10-40)
UPDATE badges SET sort_order = 10 WHERE name = 'SP Earner - Bronze';
UPDATE badges SET sort_order = 20 WHERE name = 'SP Earner - Silver';
UPDATE badges SET sort_order = 30 WHERE name = 'SP Earner - Gold';
UPDATE badges SET sort_order = 40 WHERE name = 'SP Earner - Platinum';

-- SP Spending (50-60)
UPDATE badges SET sort_order = 50 WHERE name = 'SP Spender - Bronze';
UPDATE badges SET sort_order = 60 WHERE name = 'SP Spender - Silver';

-- Trades (70-90)
UPDATE badges SET sort_order = 70 WHERE name = 'First Trade';
UPDATE badges SET sort_order = 80 WHERE name = '10 Trades';
UPDATE badges SET sort_order = 90 WHERE name = '50 Trades';

-- Subscription (100-130)
UPDATE badges SET sort_order = 100 WHERE name = 'Trial Member';
UPDATE badges SET sort_order = 110 WHERE name = '1-Month Subscriber';
UPDATE badges SET sort_order = 120 WHERE name = '6-Month Subscriber';
UPDATE badges SET sort_order = 130 WHERE name = '1-Year Subscriber';

-- Verify results
SELECT name, sort_order FROM badges ORDER BY sort_order ASC;
