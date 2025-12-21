-- ================================================================
-- FIX: Add 'paused' to allowed status values in items table
-- ================================================================
-- Problem: items.status CHECK constraint doesn't include 'paused'
-- Allowed statuses: 'draft', 'available', 'pending', 'sold', 'deleted'
-- Needed status: 'paused'
-- Solution: Drop and recreate the constraint to include 'paused'

-- Step 1: Drop the old constraint
ALTER TABLE items DROP CONSTRAINT items_status_check;

-- Step 2: Add new constraint that includes 'paused'
ALTER TABLE items ADD CONSTRAINT items_status_check 
CHECK (status IN ('draft', 'available', 'pending', 'sold', 'deleted', 'paused'));

-- Step 3: Verify the constraint exists
SELECT tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'items' 
  AND tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK';

-- Expected result: Should show constraint with 'paused' in the check clause
