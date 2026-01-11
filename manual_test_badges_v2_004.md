# Manual Test Cases: BADGES-V2-004 - Badge Display UI, Leaderboard & Tests

**Module:** MODULE-08-BADGES-V2  
**Task:** BADGES-V2-004  
**Date:** January 11, 2026  
**Tester:** _________________

---

## Prerequisites

### ⚠️ REQUIRED: SQL Migration Setup

**Before any testing, run this SQL in Supabase SQL Editor:**

```sql
-- filepath: supabase/migrations/083_badge_leaderboard.sql
-- BADGES-V2-004: Leaderboard RPC Function

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_badge_leaderboard(INT) TO authenticated;
```

### Environment Setup

1. **Supabase**: Production database must have `badges` and `user_badges` tables populated
2. **Mobile App**: iOS Simulator or Android Emulator
3. **Test Users**: At least 3 users with different badge counts

---

## Test Suite 1: Service Layer Tests

### Test Case 1.1: getBadgeLeaderboard Service

**Objective:** Verify leaderboard service fetches data correctly.

**Steps:**
1. Open project in terminal: `cd p2p-kids-marketplace`
2. Run unit tests: `npm test src/services/__tests__/badges.test.ts`

**Expected Results:**
- ✅ All tests pass
- ✅ Default limit of 10 is used
- ✅ Custom limits are respected
- ✅ Error handling works correctly
- ✅ Results are ordered by badge_count descending

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 1.2: getUserBadges Service

**Objective:** Verify user badge fetching works.

**Steps:**
1. Run unit tests: `npm test src/services/__tests__/badges.test.ts`
2. Check console output for getUserBadges tests

**Expected Results:**
- ✅ Fetches badges with joined badge details
- ✅ Orders by awarded_at descending
- ✅ Error handling works

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 2: E2E Database Tests

### Test Case 2.1: RPC Function Verification

**Objective:** Verify get_badge_leaderboard RPC works in production.

**Steps:**
1. Run E2E tests: `npm test src/__tests__/e2e/badges-v2-004-leaderboard.e2e.ts`

**Expected Results:**
- ✅ RPC call succeeds without errors
- ✅ Returns array of leaderboard entries
- ✅ Each entry has user_id, display_name, badge_count
- ✅ Results ordered by badge_count descending
- ✅ Limit parameter respected
- ✅ Only includes users with badge_count > 0

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 2.2: Performance Tests

**Objective:** Ensure queries are fast enough for production.

**Steps:**
1. Run E2E tests with performance metrics
2. Check console output for timing

**Expected Results:**
- ✅ Leaderboard query completes in < 500ms
- ✅ User badges query completes in < 300ms

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 3: Mobile UI - Badge Showcase

### Test Case 3.1: View Badges on Profile

**Objective:** Verify BadgeShowcase component displays correctly.

**Steps:**
1. Start app: `npm start`
2. Open iOS Simulator or Android Emulator
3. Log in as a user with badges
4. Navigate to Profile screen
5. Observe BadgeShowcase component

**Expected Results:**
- ✅ BadgeShowcase renders below profile info
- ✅ Shows "My Badges (X)" title with correct count
- ✅ Badges display horizontally in a scrollable list
- ✅ Each badge shows icon (or emoji fallback) and name
- ✅ Loading indicator shows while fetching

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

### Test Case 3.2: Empty Badge State

**Objective:** Verify empty state for users with no badges.

**Steps:**
1. Log in as a user with zero badges
2. Navigate to Profile screen
3. Observe BadgeShowcase

**Expected Results:**
- ✅ Shows message: "No badges earned yet. Start trading to earn badges!"
- ✅ No FlatList rendered
- ✅ Empty state is visually clear

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

### Test Case 3.3: Badge Icon Display

**Objective:** Verify badge icons/emojis render correctly.

**Steps:**
1. Log in as user with badges
2. Navigate to Profile → BadgeShowcase
3. Inspect badge icons

**Expected Results:**
- ✅ If `icon_url` exists, image loads correctly
- ✅ If no `icon_url`, fallback emoji (🏅) displays
- ✅ Icons are visually consistent (60x60 circular containers)
- ✅ Badge names truncate properly if too long

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

## Test Suite 4: Mobile UI - Badges Screen

### Test Case 4.1: Navigate to Badges Screen

**Objective:** Verify navigation from Profile to Badges screen.

**Steps:**
1. From Profile screen, tap BadgeShowcase component
2. OR navigate manually to Badges screen

**Expected Results:**
- ✅ Badges screen loads successfully
- ✅ Shows header with "Achievements" title
- ✅ Back button navigates to Profile
- ✅ "🏆 Top" button visible in top-right

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

### Test Case 4.2: View All Badges (Earned + Locked)

**Objective:** Verify badges display in grid layout.

**Steps:**
1. Navigate to Badges screen
2. Scroll through badge list

**Expected Results:**
- ✅ Grid displays 2 columns
- ✅ Earned badges show gold background (#FEF3C7)
- ✅ Locked badges show gray background (#F3F4F6) with reduced opacity
- ✅ Each badge shows icon, name, description
- ✅ Earned badges show "Earned [date]" text
- ✅ Stats bar shows "You have earned X out of Y badges"

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

### Test Case 4.3: Tap Leaderboard Button

**Objective:** Verify navigation to Leaderboard screen.

**Steps:**
1. From Badges screen, tap "🏆 Top" button
2. Observe navigation

**Expected Results:**
- ✅ Navigates to Leaderboard screen
- ✅ No navigation errors in console
- ✅ Back button returns to Badges screen

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

## Test Suite 5: Mobile UI - Leaderboard Screen

### Test Case 5.1: View Leaderboard

**Objective:** Verify leaderboard displays correctly.

**Steps:**
1. Navigate to Leaderboard screen
2. Observe layout and data

**Expected Results:**
- ✅ Shows "Badge Leaderboard" title
- ✅ Description box: "Top traders ranked by total badges earned 🏆"
- ✅ List of users ordered by badge count (highest first)
- ✅ Each entry shows rank, emoji, name, badge count
- ✅ Top 3 users have gold background (#FEF3C7) with border
- ✅ Rank medals: 🥇 #1, 🥈 #2, 🥉 #3, 🏅 others

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

### Test Case 5.2: Pull to Refresh Leaderboard

**Objective:** Verify refresh control works.

**Steps:**
1. On Leaderboard screen, pull down to refresh
2. Observe loading indicator
3. Wait for data reload

**Expected Results:**
- ✅ Pull-to-refresh indicator appears
- ✅ Leaderboard data reloads
- ✅ Loading completes without errors

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 5.3: Empty Leaderboard State

**Objective:** Verify empty state when no users have badges.

**Precondition:** Test in environment with no user badges (or temporarily clear user_badges table)

**Steps:**
1. Navigate to Leaderboard screen

**Expected Results:**
- ✅ Shows "No Badges Yet" title
- ✅ Shows message: "Be the first to earn badges and climb the leaderboard!"
- ✅ No list rendered

**Status:** ☐ Pass ☐ Fail  
**Screenshot:** _________________________________  
**Notes:** _________________________________

---

### Test Case 5.4: Leaderboard Ranking Order

**Objective:** Verify users are ranked correctly.

**Steps:**
1. Open Leaderboard screen
2. Manually verify first 5-10 entries
3. Compare badge counts

**Expected Results:**
- ✅ Rank #1 has highest badge_count
- ✅ Subsequent ranks have equal or lower badge_count
- ✅ Ties are handled consistently (alphabetical by name)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 5.5: Leaderboard Performance

**Objective:** Ensure leaderboard loads quickly.

**Steps:**
1. Navigate to Leaderboard screen
2. Time from screen mount to data display

**Expected Results:**
- ✅ Data loads in under 2 seconds
- ✅ No freezing or lag during scroll
- ✅ Smooth animations for medal emojis

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 6: Navigation Integration

### Test Case 6.1: Complete Navigation Flow

**Objective:** Verify full navigation path works.

**Steps:**
1. Start at Dashboard
2. Navigate to Profile
3. Tap BadgeShowcase → view full Badges screen
4. Tap "🏆 Top" → view Leaderboard
5. Tap Back → return to Badges
6. Tap Back → return to Profile

**Expected Results:**
- ✅ All screens load correctly
- ✅ Back button always works
- ✅ No navigation stack errors
- ✅ No memory leaks or crashes

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 6.2: Deep Link to Leaderboard

**Objective:** Verify direct navigation to Leaderboard works.

**Steps:**
1. From any authenticated screen
2. Programmatically navigate: `navigation.navigate('Leaderboard')`

**Expected Results:**
- ✅ Leaderboard screen loads
- ✅ Back button navigates correctly
- ✅ Route exists in navigation stack

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 7: Error Handling

### Test Case 7.1: Network Error on Leaderboard

**Objective:** Verify graceful error handling.

**Precondition:** Disable network or set invalid Supabase URL

**Steps:**
1. Navigate to Leaderboard screen
2. Observe error handling

**Expected Results:**
- ✅ Error logged to console
- ✅ Loading state completes (not stuck loading)
- ✅ User-friendly message displayed (if implemented)
- ✅ App does not crash

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 7.2: Invalid RPC Call

**Objective:** Verify error when RPC function doesn't exist.

**Precondition:** Drop RPC function temporarily

**Steps:**
1. Navigate to Leaderboard screen

**Expected Results:**
- ✅ Error thrown from service layer
- ✅ Console shows "Failed to fetch leaderboard"
- ✅ App does not crash

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 8: TypeScript Compilation

### Test Case 8.1: Type Check

**Objective:** Ensure no TypeScript errors.

**Steps:**
1. Run: `npm run type-check`

**Expected Results:**
- ✅ No TypeScript errors
- ✅ LeaderboardEntry interface recognized
- ✅ All imports resolve correctly

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 8.2: Linting

**Objective:** Ensure code follows style rules.

**Steps:**
1. Run: `npm run lint`

**Expected Results:**
- ✅ No linting errors in new files
- ✅ All imports sorted
- ✅ No unused variables

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Final Verification Checklist

### Files Created/Modified
- ✅ `supabase/migrations/083_badge_leaderboard.sql`
- ✅ `p2p-kids-marketplace/src/services/badges.ts` (updated)
- ✅ `p2p-kids-marketplace/src/screens/profile/LeaderboardScreen.tsx` (created)
- ✅ `p2p-kids-marketplace/src/screens/profile/BadgesScreen.tsx` (updated with leaderboard link)
- ✅ `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` (updated)
- ✅ `p2p-kids-marketplace/src/services/__tests__/badges.test.ts` (created)
- ✅ `p2p-kids-marketplace/src/__tests__/e2e/badges-v2-004-leaderboard.e2e.ts` (created)

### Verification Items (MODULE-08-VERIFICATION-V2.md)
- ✅ Service `getBadgeLeaderboard` implemented
- ✅ RPC `get_badge_leaderboard` deployed
- ✅ UI `BadgeShowcase` component (already exists, verified)
- ✅ Leaderboard UI implemented
- ✅ Unit tests created
- ✅ E2E tests created
- ✅ Navigation updated
- ✅ Manual test cases documented

---

## Summary Report

**Total Test Cases:** 23  
**Passed:** _______  
**Failed:** _______  
**Blocked:** _______  

**Critical Issues Found:**
_________________________________

**Recommendations:**
_________________________________

**Sign-off:**  
Tester: _____________ Date: _______  
Developer: _____________ Date: _______
