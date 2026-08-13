# TASK EDU-004: Onboarding Carousel — Manual Testing Guide

**Module:** MODULE-18 TRADING EDUCATION V1  
**Task:** EDU-004 — OnboardingCarousel + First-Run Gating  
**Test Environment:** iOS/Android Simulators  
**Prerequisites:**
- Supabase staging environment configured
- Fresh test user account (no onboarding flags set)
- Education sections seed data loaded (see MODULE-18 migrations)

---

## Test Case 1: First-Run Onboarding Display

**Objective:** Verify carousel shows for new users on first app open

**Pre-conditions:**
1. Create a new test user in Supabase staging:
   - User has NO `onboarding_completed_at`
   - User has NO `onboarding_skipped_at`
2. App is freshly installed (no cached state)

**Steps:**
1. Launch the app
2. Complete authentication (login/signup)
3. Observe the screen shown after authentication

**Expected Results:**
- ✅ Onboarding carousel appears (NOT the Home dashboard)
- ✅ Screen 1 displays: "Welcome to P2P Kids Marketplace!"
- ✅ 5 progress dots visible at bottom
- ✅ Dot 1 is filled (blue), dots 2-5 are ghosted (gray)
- ✅ "Skip" button visible in bottom-left
- ✅ "Get Started" button NOT visible (only on last screen)

---

## Test Case 2: Carousel Navigation — Swipe Left/Right

**Objective:** Verify swipe gestures navigate between screens

**Pre-conditions:**
- Onboarding carousel is displayed (from TC1)

**Steps:**
1. On Screen 1, swipe LEFT
2. Observe Screen 2 appears
3. Swipe LEFT again to Screen 3
4. Swipe LEFT again to Screen 4
5. Swipe LEFT again to Screen 5
6. Swipe RIGHT to return to Screen 4

**Expected Results:**

| Screen | Title | Progress Dot | Body Contains |
|--------|-------|--------------|---------------|
| 1 | Welcome to P2P Kids Marketplace! | Dot 1 filled | "safe space for kids" |
| 2 | What are Swap Points? | Dot 2 filled | "SP" or "Swap Points" |
| 3 | How You Earn SP | Dot 3 filled | "earn" or "selling" |
| 4 | How You Spend SP | Dot 4 filled | "spend" or "70%" or "cash fee" |
| 5 | Safety First! | Dot 5 filled | "safety" or "recalls" or "private" |

- ✅ Swipe LEFT advances to next screen
- ✅ Swipe RIGHT goes back to previous screen
- ✅ Progress dots update to match current screen (filled = current)
- ✅ Cannot swipe left past Screen 5
- ✅ Cannot swipe right past Screen 1

---

## Test Case 3: Skip Button Functionality

**Objective:** Verify Skip button marks onboarding as skipped and navigates to Home

**Pre-conditions:**
- Onboarding carousel is displayed (from TC1)

**Steps:**
1. On Screen 1, tap "Skip" button
2. Observe navigation

**Expected Results:**
- ✅ App navigates immediately to Home dashboard (main tabs visible)
- ✅ `onboarding_skipped_at` timestamp is set in Supabase `profiles` table

**SQL Verification:**
```sql
SELECT user_id, onboarding_skipped_at, onboarding_completed_at
FROM profiles
WHERE user_id = '<test-user-id>';
```
- ✅ `onboarding_skipped_at` is NOT NULL
- ✅ `onboarding_completed_at` is NULL

---

## Test Case 4: Get Started Button (Onboarding Complete)

**Objective:** Verify Get Started button on Screen 5 marks onboarding as complete

**Pre-conditions:**
- Fresh test user (create new user for this test)
- Onboarding carousel displayed

**Steps:**
1. Swipe through all 5 screens to reach Screen 5
2. On Screen 5, verify "Get Started" button is visible
3. Tap "Get Started" button
4. Observe navigation

**Expected Results:**
- ✅ "Get Started" button visible ONLY on Screen 5
- ✅ Button has correct label: "Get Started"
- ✅ App navigates to Home dashboard
- ✅ `onboarding_completed_at` timestamp is set in Supabase

**SQL Verification:**
```sql
SELECT user_id, onboarding_completed_at, onboarding_skipped_at
FROM profiles
WHERE user_id = '<test-user-id>';
```
- ✅ `onboarding_completed_at` is NOT NULL
- ✅ `onboarding_skipped_at` is NULL

---

## Test Case 5: Onboarding Does NOT Show on Second App Open

**Objective:** Verify onboarding carousel appears only once (first-run gating)

**Pre-conditions:**
- User completed onboarding (from TC4) OR skipped onboarding (from TC3)

**Steps:**
1. Kill the app completely (swipe up in multitasking on iOS, force stop on Android)
2. Relaunch the app
3. Log in (if session expired)
4. Observe the screen shown after authentication

**Expected Results:**
- ✅ Home dashboard appears immediately
- ✅ Onboarding carousel does NOT appear
- ✅ No "Skip" or "Get Started" buttons visible
- ✅ Main tabs/navigation are visible

---

## Test Case 6: DB Content Override (Screens 2-5)

**Objective:** Verify screens 2-5 pull body content from Supabase education_sections table

**Pre-conditions:**
- Education sections seed data loaded (MODULE-18 migrations applied)
- At least one published section exists for each type: `sp_definition`, `sp_earning`, `sp_spending`, `safety`

**Steps:**
1. In Supabase SQL Editor, verify published sections exist:
   ```sql
   SELECT section_type, title, body, is_published
   FROM education_sections
   WHERE is_published = true
     AND section_type IN ('sp_definition', 'sp_earning', 'sp_spending', 'safety')
   ORDER BY display_order;
   ```
2. Note the `body` content for each section
3. Launch app with fresh user (onboarding carousel shows)
4. Swipe to Screens 2, 3, 4, 5
5. Compare displayed body text with DB content

**Expected Results:**
- ✅ Screen 2 body matches `education_sections` WHERE `section_type = 'sp_definition'` (if exists)
- ✅ Screen 3 body matches `education_sections` WHERE `section_type = 'sp_earning'` (if exists)
- ✅ Screen 4 body matches `education_sections` WHERE `section_type = 'sp_spending'` (if exists)
- ✅ Screen 5 body matches `education_sections` WHERE `section_type = 'safety'` (if exists)
- ✅ If DB section does NOT exist, fallback to static content from `onboarding-screens.ts`

---

## Test Case 7: Analytics Events Tracking

**Objective:** Verify analytics events are logged correctly

**Pre-conditions:**
- Fresh test user
- `education_analytics` table exists in Supabase

**Steps:**
1. Launch app and reach onboarding carousel
2. Wait 2 seconds (allow analytics to fire)
3. Query `education_analytics` table:
   ```sql
   SELECT event_type, user_id, created_at
   FROM education_analytics
   WHERE user_id = '<test-user-id>'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
4. Complete onboarding (tap Get Started on Screen 5)
5. Query analytics again

**Expected Results:**

**After carousel appears:**
- ✅ One `onboarding_start` event logged
- ✅ Event has correct `user_id`
- ✅ No duplicate `onboarding_start` events (even if carousel re-renders)

**After completing onboarding:**
- ✅ One `onboarding_complete` event logged

**Alternative: After skipping onboarding:**
- ✅ One `onboarding_skip` event logged

**Analytics should never block UX:**
- ✅ If analytics insert fails, user can still navigate
- ✅ No error alerts shown to user

---

## Test Case 8: Accessibility — Screen Reader Support (iOS)

**Objective:** Verify VoiceOver support (iOS) or TalkBack (Android)

**Pre-conditions:**
- iOS Simulator with VoiceOver enabled
- Onboarding carousel displayed

**Steps (iOS):**
1. Enable VoiceOver: Settings → Accessibility → VoiceOver → ON
2. Launch app and reach onboarding carousel
3. Swipe right to navigate VoiceOver focus through elements
4. Listen to announcements

**Expected Results:**
- ✅ Screen 1 announces: "Onboarding, step 1 of 5, Welcome to P2P Kids Marketplace"
- ✅ Skip button announces: "Skip onboarding, button"
- ✅ Progress dots are marked as NOT accessible (visual-only indicators)
- ✅ Screen 5 "Get Started" button announces: "Get Started, button"
- ✅ All interactive elements have proper roles (`button`, `text`)

---

## Test Case 9: Placeholder Illustrations

**Objective:** Verify placeholder images render without crashes

**Pre-conditions:**
- Placeholder images exist in `src/assets/onboarding/`
  - `welcome.png`
  - `swap-points-intro.png`
  - `earning-sp.png`
  - `spending-sp.png`
  - `safety.png`

**Steps:**
1. Launch app and swipe through all 5 screens
2. Observe illustration rendering

**Expected Results:**
- ✅ Each screen displays an illustration (colored rectangle placeholders OK)
- ✅ No broken image icons
- ✅ No app crashes
- ✅ Images scale appropriately for different screen sizes
- ✅ `TODO(DESIGN)` comment noted — replace with final illustrations later

---

## Test Case 10: Error Resilience — DB Sections Fail to Load

**Objective:** Verify graceful fallback when DB sections cannot be fetched

**Pre-conditions:**
- Simulate DB failure (disable network or point to invalid Supabase URL)

**Steps:**
1. Temporarily break Supabase connection (e.g., invalid API key in `.env.local`)
2. Launch app with fresh user
3. Observe onboarding carousel

**Expected Results:**
- ✅ Carousel still renders
- ✅ Screens 2-5 display static fallback content from `onboarding-screens.ts`
- ✅ No white screens or crashes
- ✅ Console logs warning: `[OnboardingCarousel] Failed to load DB sections`

---

## Pass/Fail Criteria

**All test cases must PASS ✅ before marking EDU-004 as complete.**

If any test case FAILS ❌:
1. Document the failure with screenshot
2. File a bug report with test case number
3. Fix the issue
4. Re-run failed test case + full regression suite

---

## Test Environment Setup

### iOS Simulator
```bash
cd p2p-kids-marketplace
npm run ios
```

### Android Emulator
```bash
cd p2p-kids-marketplace
npm run android
```

### Create Fresh Test User
1. Open Supabase Studio → Authentication → Users
2. Click "Add User" → Email
3. Email: `test-onboarding-<timestamp>@example.com`
4. Password: `TestPass123!`
5. Copy User ID
6. In SQL Editor, verify profile exists:
   ```sql
   SELECT * FROM profiles WHERE user_id = '<copied-user-id>';
   ```
7. Reset onboarding flags:
   ```sql
   UPDATE profiles
   SET onboarding_completed_at = NULL,
       onboarding_skipped_at = NULL
   WHERE user_id = '<copied-user-id>';
   ```

---

## Cleanup After Testing

```sql
-- Delete test analytics events
DELETE FROM education_analytics
WHERE user_id IN (
   SELECT user_id FROM profiles
  WHERE user_id LIKE 'test-onboarding-%'
);

-- Delete test user profiles
DELETE FROM profiles
WHERE user_id LIKE 'test-onboarding-%';

-- Delete test auth users (Supabase Studio → Authentication)
```

---

## Notes

- **Simulator Keyboard:** iOS Simulator → I/O → Keyboard → Connect Hardware Keyboard (for arrow key testing on web)
- **Re-running Tests:** Always start with a fresh user or reset onboarding flags between tests
- **DB Seed Data:** Ensure MODULE-18 migrations are applied before testing
- **Analytics Delays:** Allow 1-2 seconds for async analytics writes to complete before querying DB
- **DEV SMS Fallback:** If the OTP Edge Function returns provider errors in development, the app may show a DEV bypass message; use the displayed 6-digit fallback code.

---

**Test Date:** _____________  
**Tester Name:** _____________  
**Environment:** iOS ☐ Android ☐  
**Overall Result:** PASS ☐ FAIL ☐  
**Notes:**
