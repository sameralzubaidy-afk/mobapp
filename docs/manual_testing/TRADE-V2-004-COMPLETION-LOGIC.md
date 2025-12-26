# Manual Test Case: Trade Completion Logic (Seller vs Buyer)

## Description
Verify that when a seller marks a trade as completed, it remains `in_progress` until the buyer confirms or the system auto-completes it.

## Prerequisites
1. Two test users: **User A (Seller)** and **User B (Buyer)**.
2. An active trade between User A and User B in `in_progress` status.

## Test Steps

### Step 1: Seller marks trade as completed
1. Log in as **User A (Seller)**.
2. Navigate to the **Trade Details** screen for the active trade.
3. Verify the "Mark as Completed" button is visible.
4. Click "Mark as Completed" and confirm the alert.
5. **Expected Result**: 
   - An alert shows: "Seller marked trade as completed. Awaiting buyer confirmation."
   - The button text changes to "Awaiting Buyer Confirmation" and becomes disabled.
   - The trade status remains `IN PROGRESS`.

### Step 2: Buyer views seller completion status
1. Log in as **User B (Buyer)**.
2. Navigate to the **Trade Details** screen for the same trade.
3. **Expected Result**:
   - A green notification box appears: "The seller has marked this trade as completed. Please confirm if you have received the item."
   - The "Mark as Completed" button is still active.

### Step 3: Buyer confirms completion
1. As **User B (Buyer)**, click "Mark as Completed" and confirm the alert.
2. **Expected Result**:
   - An alert shows: "Trade marked as completed!"
   - The trade status changes to `COMPLETED`.
   - The item status in the database changes to `sold`.
   - Swap Points are credited to the seller (if eligible).

### Step 4: Auto-completion (Optional/System)
1. If a trade is in `in_progress` and the seller has marked it, but the buyer does nothing.
2. After 7 days (or the configured timeout), the `auto-complete-trades` Edge Function runs.
3. **Expected Result**:
   - The trade status changes to `COMPLETED` automatically.

## Verification Queries (Supabase SQL Editor)
```sql
-- Check trade status and seller completion flag
SELECT id, status, seller_marked_completed_at, completed_at 
FROM trades 
WHERE id = 'YOUR_TRADE_ID';
```
