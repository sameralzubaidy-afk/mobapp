# Hardcoded Nodes Cleanup

**Issue:** Multiple hardcoded nodes exist in seed data but admin panel only shows Greenwich CT. This creates inconsistency.

---

## Hardcoded Nodes Found

### 1. **supabase/seed.sql** (TEST/LOCAL DATA)
```sql
INSERT INTO nodes (id, name, status, latitude, longitude) VALUES
('norwalk-ct', 'Norwalk, CT', 'active', 41.1177, -73.4082),
('little-falls-nj', 'Little Falls, NJ', 'active', 40.8684, -74.2082),
('test-node-1', 'Test Community 1', 'active', 40.7128, -74.0060)
```

These are **test/local seed data** - OK to keep since they help with local testing.

---

## Current Situation

### What Should Happen:
1. **Admin Portal** should be the source of truth for all nodes
2. Nodes should be manageable via admin (create, edit, delete)
3. All user assignments should pull from the live nodes table

### What's Actually Happening:
- ✅ Admin panel has "Greenwich CT" (user-created, good)
- ✅ Seed data has "Norwalk CT" + "Little Falls NJ" (for testing, OK)
- ❌ But the app assigns users to "Little Falls NJ Community" which might not match exactly with seed data ID

---

## Root Cause

The node name in logs (`Little Falls NJ Community`) doesn't match seed data (`Little Falls, NJ`). This suggests:

1. **Option A:** The RPC is returning a slightly different name
2. **Option B:** Nodes in production DB are different from seed.sql
3. **Option C:** There's a naming mismatch

---

## Action Plan

### Step 1: Check Current Production Nodes

Run this in Supabase Studio SQL Editor:

```sql
SELECT id, name, status, latitude, longitude, member_count 
FROM public.nodes 
ORDER BY created_at DESC;
```

**You'll see:**
- All nodes currently in production
- If nodes in admin portal match database

---

### Step 2: If There Are Orphaned/Extra Nodes

Clean them up:

```sql
-- If you want to delete all test nodes except the ones you're actively using
DELETE FROM public.nodes 
WHERE id IN ('norwalk-ct', 'little-falls-nj', 'test-node-1', 'test-node-2', 'test-node-3')
  AND id NOT IN (
    SELECT node_id FROM public.zip_codes WHERE node_id IS NOT NULL
  );
```

---

### Step 3: Reseed Only Admin-Created Nodes

If the production DB has extra nodes, clear and reseed:

```sql
-- BACKUP first: export current nodes
SELECT * FROM public.nodes;

-- DELETE old test data
DELETE FROM public.nodes WHERE status IN ('active', 'inactive', 'waitlist');

-- If Greenwich CT exists in admin, verify it's in DB:
INSERT INTO public.nodes (id, name, status, latitude, longitude, member_count)
VALUES 
  ('greenwich-ct', 'Greenwich, CT', 'active', 41.0534, -73.6254, 0)
ON CONFLICT (id) DO NOTHING;

-- Add accompanying ZIP codes if needed
INSERT INTO public.zip_codes (zip, node_id, city, state, latitude, longitude)
VALUES ('06830', 'greenwich-ct', 'Greenwich', 'CT', 41.0534, -73.6254)
ON CONFLICT (zip) DO NOTHING;
```

---

## What to Do Now

**Run Step 1 first** and show me the output:

```sql
SELECT id, name, status, latitude, longitude, member_count 
FROM public.nodes 
ORDER BY created_at DESC;
```

Then I can tell you exactly what to clean up to make the admin panel match the database.

---

## Summary

- ✅ Seed data is fine (local testing only)
- ✅ Admin panel control is working (Greenwich CT exists)
- ⚠️ Need to verify production nodes match admin portal
- ❌ If extra test nodes exist, they should be deleted

**Action:** Share the output of the SQL query above and I'll tell you what to delete.

