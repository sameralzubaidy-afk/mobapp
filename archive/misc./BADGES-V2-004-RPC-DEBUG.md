# BADGES-V2-004: RPC Debugging Guide

## 🔍 Quick Diagnostic

**Copy and paste this into Supabase SQL Editor:**

```sql
-- TEST 1: Verify RPC exists and is callable
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_badge_leaderboard';

-- TEST 2: Call RPC with limit 50
SELECT * FROM get_badge_leaderboard(50);

-- TEST 3: Debug the underlying query (what RPC should return)
SELECT
  p.id AS user_id,
  COALESCE(p.name, p.email) AS display_name,
  COUNT(ub.id) AS badge_count
FROM profiles p
LEFT JOIN user_badges ub ON p.id = ub.user_id
GROUP BY p.id, p.name, p.email
HAVING COUNT(ub.id) > 0
ORDER BY badge_count DESC, p.name ASC
LIMIT 50;

-- TEST 4: Check user_badges table directly
SELECT user_id, badge_id, awarded_at
FROM user_badges
ORDER BY awarded_at DESC
LIMIT 20;

-- TEST 5: Check if issue is RLS on profiles table
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM profiles WHERE id IN (SELECT DISTINCT user_id FROM user_badges);
```

---

## 📱 Mobile App Debug Steps

1. **Hard reload** the app:
   - Stop the Metro bundler (Ctrl+C)
   - Clear cache: `npm start -- --reset-cache`
   - In emulator: Press `r` twice

2. **Open console logs** (choose one):
   - **Android**: Open Android Studio Logcat and search for `[getBadgeLeaderboard]`
   - **iOS**: Open Xcode console
   - **React Native**: Use Chrome DevTools (if enabled)

3. **Look for these logs**:
   ```
   [getBadgeLeaderboard] Calling RPC with limit: 50
   [getBadgeLeaderboard] RPC Response: { data: [...], error: null, ... }
   ```

4. **Check what `data` contains**:
   - ✅ If `data: [{ user_id: "...", display_name: "...", badge_count: 4 }, ...]` → RPC works, problem elsewhere
   - ❌ If `data: []` → RPC returns empty (RLS or data issue)
   - ❌ If `data: null` → RPC might be failing silently

---

## 🔧 Most Likely Fixes

### Issue #1: RLS Policy Blocking RPC

**RPC uses `SECURITY DEFINER` but still can't see profiles data**

```sql
-- Check current RLS policies on profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Create policy allowing all authenticated users to read profiles (for leaderboard)
DROP POLICY IF EXISTS "Allow public read profiles for leaderboard" ON profiles;

CREATE POLICY "Allow public read profiles for leaderboard"
  ON profiles
  FOR SELECT
  USING (TRUE);  -- Allow all authenticated users to read

-- Or keep it more restrictive:
CREATE POLICY "Allow authenticated read all profiles"
  ON profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

### Issue #2: RPC Parameter Mismatch

**Supabase RPC might need different parameter naming**

Try both versions:

```javascript
// Version 1: Using p_limit (what we have)
const { data, error } = await supabase.rpc('get_badge_leaderboard', {
  p_limit: limit,
});

// Version 2: Just use positional parameter
const { data, error } = await supabase.rpc('get_badge_leaderboard', {
  p_limit: limit,
}, { 
  head: false,
});
```

---

## ✅ Action Plan

1. **Run SQL diagnostics** above and report results
2. **Check console logs** after app reload
3. **Report what you see** in:
   - `[getBadgeLeaderboard]` logs
   - SQL TEST 2 result
   - Any RLS policies

Then I can pinpoint and fix the exact issue! 🚀
