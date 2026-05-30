# BADGES-V2-004: Leaderboard Empty State - Diagnostic & Fix

**Issue:** Leaderboard shows "No Badges Yet" despite users having completed trades  
**Status:** Test Case 5.1 - View Leaderboard failing  
**Date:** January 11, 2026

---

## 🔍 Root Cause Analysis

The leaderboard is empty because **no badges are in the `user_badges` table**. This happens when:

1. ❌ Trades aren't marked as `status = 'completed'`
2. ❌ Badges table isn't seeded
3. ❌ RPC function `get_badge_leaderboard` hasn't been executed
4. ❌ Badge trigger migration wasn't executed

---

## 🚀 Quick Fix (5 Steps)

### Step 1: Verify SQL Migrations Executed

Run in **Supabase SQL Editor**:

```sql
-- Check if migrations exist
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'get_badge_leaderboard'
) as has_leaderboard_rpc,
EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'check_trade_badges'
) as has_trade_trigger,
EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'award_badge_if_eligible'
) as has_award_function;
```

**Expected:** All three return `true`

**If any return `false`**: Run these migrations in order:
- `supabase/migrations/20260110000001_badge_triggers.sql`
- `supabase/migrations/20260110000002_trade_badges.sql`
- `supabase/migrations/083_badge_leaderboard.sql`

---

### Step 2: Verify Badges Exist

```sql
SELECT id, name, category, threshold, is_active, COUNT(*) OVER () as total_badges
FROM badges
WHERE is_active = TRUE
LIMIT 10;
```

**Expected:** At least 3-5 active badges  
**If empty:** Run seeding script below

---

### Step 3: Check User Trades Status

```sql
-- Count trades by status
SELECT status, COUNT(*) as count
FROM trades
GROUP BY status
ORDER BY count DESC;

-- See completed trades
SELECT id, buyer_id, seller_id, status, created_at
FROM trades
WHERE status = 'completed'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** Multiple trades with `status = 'completed'`  
**If 0 completed:** Trades exist but aren't marked complete - need to update manually

---

### Step 4: Check User Badges

```sql
-- Count badge awards
SELECT COUNT(*) as total_awarded, 
       COUNT(DISTINCT user_id) as users_with_badges
FROM user_badges;

-- See who has badges
SELECT u.id, u.email, COUNT(ub.id) as badge_count
FROM profiles u
LEFT JOIN user_badges ub ON u.id = ub.user_id
GROUP BY u.id, u.email
HAVING COUNT(ub.id) > 0
ORDER BY badge_count DESC;
```

**Expected:** Users with badge_count > 0  
**If 0 rows:** No badges awarded yet - proceed to Step 5

---

### Step 5: Manually Award Test Badges

If no badges are awarded, manually simulate by running:

```sql
-- Find a user with completed trades
WITH user_trades AS (
  SELECT DISTINCT buyer_id as user_id, COUNT(*) as total_trades
  FROM trades
  WHERE status = 'completed'
  GROUP BY buyer_id
  HAVING COUNT(*) >= 1
  LIMIT 3
),
badges_to_award AS (
  SELECT b.id as badge_id, ut.user_id
  FROM user_trades ut
  CROSS JOIN badges b
  WHERE b.category = 'trades' AND b.threshold <= ut.total_trades AND b.is_active = TRUE
)
INSERT INTO user_badges (user_id, badge_id, awarded_at)
SELECT user_id, badge_id, NOW()
FROM badges_to_award
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- Verify insertion
SELECT COUNT(*) as badges_awarded
FROM user_badges;
```

---

## 📋 Full Seeding Script

If badges table is empty, seed with this:

```sql
-- Insert all badges
INSERT INTO badges (id, name, category, description, threshold, icon_url, color, is_active, sort_order)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'First Trade', 'trades', 'Complete your first trade', 1, NULL, '#3B82F6', TRUE, 1),
  ('550e8400-e29b-41d4-a716-446655440002', 'Trade Master', 'trades', 'Complete 5 trades', 5, NULL, '#8B5CF6', TRUE, 2),
  ('550e8400-e29b-41d4-a716-446655440003', 'Trading Legend', 'trades', 'Complete 25 trades', 25, NULL, '#D946EF', TRUE, 3),
  ('550e8400-e29b-41d4-a716-446655440004', 'SP Enthusiast', 'sp_spending', 'Spend 100 Swap Points', 100, NULL, '#EC4899', TRUE, 4),
  ('550e8400-e29b-41d4-a716-446655440005', 'SP Banker', 'sp_earning', 'Earn 500 Swap Points', 500, NULL, '#F59E0B', TRUE, 5)
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT COUNT(*) as total_badges FROM badges;
```

---

## 🧪 Verify Fix Works

After running seeding script, check:

```sql
-- Should now return users with badges
SELECT 
  p.name,
  COUNT(ub.id) as badge_count
FROM profiles p
LEFT JOIN user_badges ub ON p.id = ub.user_id
WHERE COUNT(ub.id) > 0
GROUP BY p.id, p.name
ORDER BY badge_count DESC
LIMIT 10;

-- Call RPC function directly
SELECT * FROM get_badge_leaderboard(10);
```

---

## 📱 Test in App

After SQL fixes:

1. **Hard reload** app: `Ctrl+M` (Android) then `r` twice
2. Navigate to **Profile → BadgeShowcase**
3. Tap to go to **Badges screen**
4. Tap **"🏆 Top"** button
5. **Leaderboard should now show users with badges** ✅

---

## 🔧 If Still Empty

1. **Check RPC permissions**:
```sql
-- Verify RPC is callable by authenticated users
SELECT p.proname, p.procowner::regrole, p.provolatile
FROM pg_proc p
WHERE p.proname = 'get_badge_leaderboard';
```

2. **Check Console Logs** in app for errors

3. **Verify authentication** - make sure you're logged in with a user who has badges

---

## ✅ Completion Checklist

- [ ] Step 1: All three migrations executed
- [ ] Step 2: Badges table has entries
- [ ] Step 3: Trades table has 'completed' status records
- [ ] Step 4: User badges awarded (count > 0)
- [ ] Step 5: Manual seeding if needed
- [ ] Hard reload app and re-test
- [ ] Test Case 5.1 now passes ✅

---

## 📞 Next Steps

Once leaderboard displays:
- ✅ Test Case 5.2: Pull to refresh
- ✅ Test Case 5.3: Verify ranking order
- ✅ Continue remaining test cases
