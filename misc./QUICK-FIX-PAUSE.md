# 🔧 Quick Fix: Pause Status Constraint

## The Problem
When trying to pause an item, got error:
```
Failed to pause listing: new row for relation "items" violates check constraint "items_status_check"
```

## The Root Cause
The `items.status` column CHECK constraint only allows these values:
- `'draft'`, `'available'`, `'pending'`, `'sold'`, `'deleted'`

But the pause function tries to set status = `'paused'` (not in the list!)

## The Fix
Add `'paused'` to the allowed status values.

### Run This SQL in Supabase

Copy the entire contents of: **`FIX-PAUSE-STATUS-CHECK-CONSTRAINT.sql`**

**It will:**
1. Drop the old constraint
2. Add new constraint including `'paused'`
3. Verify the fix

### That's It!
After running the SQL:
- Hard refresh: `Cmd+Shift+R`
- Try pausing again
- ✅ Should work!

## What Changed
```sql
-- BEFORE:
CHECK (status IN ('draft', 'available', 'pending', 'sold', 'deleted'))

-- AFTER:
CHECK (status IN ('draft', 'available', 'pending', 'sold', 'deleted', 'paused'))
```

Also updated migration file to match.
