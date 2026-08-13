# Manual Testing: BADGES-V2-002 Automatic Badge Triggers

## Overview
This test verifies that the Postgres triggers automatically award milestone badges when a user earns or spends Swap Points (SP).

## Prerequisites
1.  **Database Migration**: Apply `supabase/migrations/20260110000001_badge_triggers.sql` in the Supabase SQL Editor.
2.  **Initial Schema**: Ensure `badges` and `user_badges` tables exist (from `080_badges_v2.sql`).
3.  **Test User**: Have a test user ID ready.

## Test Case 1: Awarding "SP Earner - Bronze" (Earn 10 SP)
**Steps:**
1.  Open Supabase SQL Editor.
2.  Get your wallet ID first:
    ```sql
    SELECT id FROM sp_wallets WHERE user_id = 'YOUR_USER_ID';
    ```
3.  Run the following SQL to simulate earning 10 SP (replace with your actual wallet ID):
    ```sql
    INSERT INTO sp_ledger (user_id, wallet_id, transaction_type, amount, balance_before, balance_after, description)
    SELECT 
        'YOUR_USER_ID', 
        w.id, 
        'earn_reward', 
        10, 
        w.available_balance,
        w.available_balance + 10,
        'Manual test for earner badge'
    FROM sp_wallets w WHERE w.user_id = 'YOUR_USER_ID'
    LIMIT 1;
    ```
4.  Check the `user_badges` table for a new entry for your user.
    ```sql
    SELECT ub.id, ub.awarded_at, b.name 
    FROM user_badges ub 
    JOIN badges b ON ub.badge_id = b.id 
    WHERE ub.user_id = 'YOUR_USER_ID'
    ORDER BY ub.awarded_at DESC;
    ```
**Expected Result:**
- A new row appears in `user_badges` with the "SP Earner - Bronze" badge.

## Test Case 2: Awarding "SP Spender - Bronze" (Spend 10 SP)
**Steps:**
1.  Run the following SQL to simulate spending 10 SP:
    ```sql
    INSERT INTO sp_ledger (user_id, wallet_id, transaction_type, amount, balance_before, balance_after, description)
    SELECT 
        'YOUR_USER_ID', 
        w.id, 
        'spend_purchase', 
        -10, 
        w.available_balance,
        w.available_balance - 10,
        'Manual test for spender badge'
    FROM sp_wallets w WHERE w.user_id = 'YOUR_USER_ID'
    LIMIT 1;
    ```
2.  Check the `user_badges` table again:
    ```sql
    SELECT ub.id, ub.awarded_at, b.name 
    FROM user_badges ub 
    JOIN badges b ON ub.badge_id = b.id 
    WHERE ub.user_id = 'YOUR_USER_ID'
    ORDER BY ub.awarded_at DESC;
    ```
**Expected Result:**
- A new row appears with the "SP Spender - Bronze" badge.

## Test Case 3: No Duplicate Awards
**Steps:**
1.  Insert another 10 SP earning for the same user:
    ```sql
    INSERT INTO sp_ledger (user_id, wallet_id, transaction_type, amount, balance_before, balance_after, description)
    SELECT 
        'YOUR_USER_ID', 
        w.id, 
        'earn_reward', 
        10, 
        w.available_balance,
        w.available_balance + 10,
        'Manual test 2 - no duplicate badge'
    FROM sp_wallets w WHERE w.user_id = 'YOUR_USER_ID'
    LIMIT 1;
    ```
2.  Check the `user_badges` table count for this user and badge:
    ```sql
    SELECT COUNT(*) as bronze_count
    FROM user_badges ub 
    JOIN badges b ON ub.badge_id = b.id 
    WHERE ub.user_id = 'YOUR_USER_ID' AND b.name = 'SP Earner - Bronze';
    ```
**Expected Result:**
- Count is still 1 (no new entry is created for "SP Earner - Bronze"). The user still has only one instance of this badge.

## Test Case 4: Multiple Milestones (Earn 50 SP Total)
**Steps:**
1.  Add more points until the total earned reaches 50 (e.g., add 30 more if you already had 20).
    ```sql
    INSERT INTO sp_ledger (user_id, wallet_id, transaction_type, amount, balance_before, balance_after, description)
    SELECT 
        'YOUR_USER_ID', 
        w.id, 
        'earn_reward', 
        30, 
        w.available_balance,
        w.available_balance + 30,
        'Reaching 50 total for Silver milestone'
    FROM sp_wallets w WHERE w.user_id = 'YOUR_USER_ID'
    LIMIT 1;
    ```
2.  Check the `user_badges` table for Silver badge:
    ```sql
    SELECT ub.id, ub.awarded_at, b.name 
    FROM user_badges ub 
    JOIN badges b ON ub.badge_id = b.id 
    WHERE ub.user_id = 'YOUR_USER_ID' AND b.name LIKE 'SP Earner%'
    ORDER BY ub.awarded_at DESC;
    ```
**Expected Result:**
- "SP Earner - Silver" is awarded (threshold: 50 SP earned).

## UI Verification
1.  Open the App.
2.  Navigate to the **Profile** screen.
3.  Verify that the newly earned badges are displayed in the "My Badges" section.
