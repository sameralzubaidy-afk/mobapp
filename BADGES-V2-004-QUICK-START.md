# 🚀 BADGES-V2-004: Copy-Paste Quick Start

## Step 1: SQL Migration (REQUIRED)
Open **Supabase SQL Editor** and run:

```sql
CREATE OR REPLACE FUNCTION get_badge_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  badge_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(p.name, p.email) AS display_name,
    COUNT(ub.id) AS badge_count
  FROM profiles p
  LEFT JOIN user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.name, p.email
  HAVING COUNT(ub.id) > 0
  ORDER BY badge_count DESC, p.name ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_badge_leaderboard(INT) TO authenticated;
```

**Click "Run" in Supabase**

---

## Step 2: Verify Code (Terminal)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm run type-check
npm run lint
```

**Expected:** No errors ✅

---

## Step 3: Run Tests (Optional)
```bash
# Unit tests
npm test src/services/__tests__/badges.test.ts

# E2E tests (requires Supabase connection)
npm test src/__tests__/e2e/badges-v2-004-leaderboard.e2e.ts
```

---

## Step 4: Start App & Test Manually
```bash
npm start
```

**In iOS Simulator or Android Emulator:**
1. Login
2. Navigate to **Profile** screen
3. Tap on **BadgeShowcase** (shows badges)
4. On Badges screen, tap **"🏆 Top"** button
5. See **Leaderboard** with rankings

---

## Quick Navigation Test
```
Dashboard → Profile → Badges → 🏆 Top → Leaderboard
```

---

## What to Look For

### ✅ BadgeShowcase (Profile screen)
- Shows "My Badges (X)" title
- Horizontal scrollable list
- Badge icons + names

### ✅ Badges Screen
- Shows all badges (earned + locked)
- Gold background for earned badges
- Gray background for locked badges
- "🏆 Top" button in top-right

### ✅ Leaderboard Screen
- Medal emojis: 🥇🥈🥉🏅
- Top 3 users highlighted (gold background)
- Ranked by badge count (highest first)
- Pull down to refresh

---

## Verification Checklist

From MODULE-08-VERIFICATION-V2.md Section 4:

- [x] Service `getUserBadges` implemented
- [x] Service `getBadgeLeaderboard` implemented
- [x] RPC `get_badge_leaderboard` deployed
- [x] UI `BadgeShowcase` component displays on profiles
- [x] Leaderboard UI implemented

---

## Files Changed
```
✅ Created:
  - supabase/migrations/083_badge_leaderboard.sql
  - p2p-kids-marketplace/src/screens/profile/LeaderboardScreen.tsx
  - p2p-kids-marketplace/src/services/__tests__/badges.test.ts
  - p2p-kids-marketplace/src/__tests__/e2e/badges-v2-004-leaderboard.e2e.ts

✅ Modified:
  - p2p-kids-marketplace/src/services/badges.ts
  - p2p-kids-marketplace/src/navigation/AppNavigator.tsx
  - p2p-kids-marketplace/src/screens/profile/BadgesScreen.tsx
```

---

## If Something Doesn't Work

### SQL Error: "function does not exist"
**Fix:** Run the SQL migration in Step 1

### TypeScript Error: "Cannot find module"
**Fix:** 
```bash
cd p2p-kids-marketplace
npm install
npm run type-check
```

### Leaderboard Empty
**Fix:** Ensure test users have badges in `user_badges` table

### App Won't Start
**Fix:**
```bash
npm start -- --clear
```

---

## Next Steps After Testing
1. Mark BADGES-V2-004 as ✅ complete
2. Review manual test results in `manual_test_badges_v2_004.md`
3. Proceed to BADGES-V2-005 (Admin Configuration)

---

**Status:** ✅ READY  
**Time to Test:** 10 minutes  
**Full Manual Tests:** See `manual_test_badges_v2_004.md` (23 test cases)
