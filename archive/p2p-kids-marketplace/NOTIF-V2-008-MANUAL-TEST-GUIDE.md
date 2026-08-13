# TASK NOTIF-V2-008: Deep Linking Manual Testing Guide

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** NOTIF-V2-008 - Notification Deep Linking  
**Date:** April 15, 2026  
**Device:** iOS Simulator, Android Emulator (NO physical device required)

---

## Prerequisites

1. **Install dependencies**:

   ```bash
   cd p2p-kids-marketplace
   npm install
   ```

2. **Start Metro bundler**:

   ```bash
   npm start
   ```

3. **Launch simulator** (in separate terminal):

   ```bash
   # iOS
   npm run ios

   # Android
   npm run android
   ```

4. **Grant notification permissions**:
   - Tap "Allow" when app requests notification permissions
   - iOS: Settings → Notifications → Kids Marketplace → Allow Notifications
   - Android: Settings → Apps → Kids Marketplace → Notifications → Allow

---

## Test Setup: Enable Deep Link Testing Utility

1. Open iOS or Android Simulator
2. Open in-app React Native debugger (shake device → "Debug")
3. Open browser console (Chrome DevTools)
4. Import test utility:
   ```javascript
   import('@/utils/deepLinkTestUtil').then(
     ({ printTestResults, quickTest, testStackManagement }) => {
       window.deepLinkTest = { printTestResults, quickTest, testStackManagement };
     }
   );
   ```

---

## TEST CASE 1: SP Wallet Deep Links (Foreground)

**Objective:** Verify SP notifications navigate to wallet screen

**Preconditions:**

- App running in foreground
- User logged in

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('spEarned');
   ```
2. Wait 3 seconds
3. Notification appears on simulator
4. Tap notification

**Expected Result:**

- ✅ App navigates to SP Wallet screen
- ✅ No crash or error
- ✅ Back button returns to previous screen

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 2: Trade Request Deep Link (Background)

**Objective:** Verify trade notifications with tradeId parameter work from background

**Preconditions:**

- App running
- User logged in

**Steps:**

1. Background the app (Home button)
2. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('tradeRequest', 'test-trade-abc-123');
   ```
3. Wait 3 seconds for notification
4. Tap notification from notification shade

**Expected Result:**

- ✅ App opens to Trade Detail screen
- ✅ tradeId = 'test-trade-abc-123' passed as param
- ✅ Screen shows trade details (or placeholder if trade doesn't exist)

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 3: Subscription Deep Link (Killed State)

**Objective:** Verify subscription notifications work when app is killed

**Preconditions:**

- App NOT running (force quit)

**Steps:**

1. Force quit app:
   - iOS: Swipe up from home screen → swipe up on app
   - Android: Recent apps → swipe away Kids Marketplace
2. In browser console (while app was running), run:
   ```javascript
   window.deepLinkTest.quickTest('trialExpiring');
   ```
3. Wait 3 seconds
4. Notification appears
5. Tap notification from lock screen

**Expected Result:**

- ✅ App launches from killed state
- ✅ App navigates directly to Manage Kids Club screen
- ✅ No crash during launch
- ✅ User sees subscription status

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 4: Badge Award Deep Link

**Objective:** Verify badge notifications navigate to badges screen

**Preconditions:**

- App running
- User logged in

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('badgeAwarded');
   ```
2. Wait 3 seconds
3. Tap notification

**Expected Result:**

- ✅ App navigates to Badges screen
- ✅ Screen shows user's badges
- ✅ Navigation stack correct (back button works)

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 5: Invalid Deep Link Fallback

**Objective:** Verify invalid deep links fallback to Home screen gracefully

**Preconditions:**

- App running
- User logged in

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('invalidDeepLink');
   ```
2. Wait 3 seconds
3. Tap notification

**Expected Result:**

- ✅ App navigates to Home screen (fallback)
- ✅ No crash or error modal
- ✅ Console shows warning: "Invalid deep link, falling back to Home"

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 6: Listing Detail with Params

**Objective:** Verify parameterized deep links work correctly

**Preconditions:**

- App running
- User logged in

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('listingDetail', 'test-listing-456');
   ```
2. Wait 3 seconds
3. Tap notification

**Expected Result:**

- ✅ App navigates to Listing Detail screen
- ✅ listingId = 'test-listing-456' passed as param
- ✅ Screen attempts to load listing (or shows "not found" if doesn't exist)

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 7: Referral Dashboard Deep Link

**Objective:** Verify referral notifications navigate correctly

**Preconditions:**

- App running
- User with referral code

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('referralSignup');
   ```
2. Wait 3 seconds
3. Tap notification

**Expected Result:**

- ✅ App navigates to Referral Dashboard screen
- ✅ Screen shows referral stats
- ✅ Back button works correctly

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 8: Leaderboard Deep Link

**Objective:** Verify leaderboard notifications navigate correctly

**Preconditions:**

- App running
- User logged in

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.quickTest('leaderboardRankUp');
   ```
2. Wait 3 seconds
3. Tap notification

**Expected Result:**

- ✅ App navigates to Leaderboard screen
- ✅ Screen shows leaderboard rankings
- ✅ Navigation stack correct

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 9: In-App Notification Center Deep Link

**Objective:** Verify tapping in-app notifications navigates correctly

**Preconditions:**

- App running
- User has notifications in notification center

**Steps:**

1. Navigate to Notifications screen manually
2. Look for notification with deep link
3. Tap notification
4. Observe navigation

**Expected Result:**

- ✅ App navigates to target screen from deep_link
- ✅ Notification marked as read
- ✅ Navigation stack allows back navigation

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 10: Deep Link Debug Output

**Objective:** Verify deep link parsing logic works for all scenarios

**Preconditions:**

- none

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.printTestResults();
   ```
2. Review console output

**Expected Result:**

- ✅ All test scenarios show PASS status
- ✅ Summary shows "X/X tests passed" with 100% pass rate
- ✅ Each scenario shows correct expected vs actual route

**Status:** [ ] Pass [ ] Fail

**Console Output:**

```
Copy console output here after running test
```

---

## TEST CASE 11: Navigation Stack Management

**Objective:** Verify navigate vs reset actions work correctly

**Preconditions:**

- App running

**Steps:**

1. In browser console, run:
   ```javascript
   window.deepLinkTest.testStackManagement();
   ```
2. Review console output
3. Test one "reset" scenario manually:
   - Navigate through: Home → Profile → Settings
   - Trigger notification that should RESET stack
   - Verify navigation stack cleared

**Expected Result:**

- ✅ Most notifications use "navigate" action (push to stack)
- ✅ Some notifications use "reset" action (clear stack)
- ✅ Back button behavior correct for both actions

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## TEST CASE 12: Multiple Deep Links in Sequence

**Objective:** Verify multiple notifications in sequence work correctly

**Preconditions:**

- App running

**Steps:**

1. Send 3 different notifications in sequence:
   ```javascript
   window.deepLinkTest.quickTest('spEarned');
   // Wait 5 seconds, tap notification
   window.deepLinkTest.quickTest('badgeAwarded');
   // Wait 5 seconds, tap notification
   window.deepLinkTest.quickTest('tradeRequest', 'trade-sequence-test');
   // Wait 5 seconds, tap notification
   ```
2. Tap each notification as it appears

**Expected Result:**

- ✅ All 3 notifications navigate to correct screens
- ✅ Navigation stack builds correctly (can navigate back through all)
- ✅ No crashes or navigation errors

**Status:** [ ] Pass [ ] Fail

**Notes:**

---

---

## VERIFICATION SUMMARY

**Total Test Cases:** 12  
**Passed:** **_  
**Failed:** _**  
**Pass Rate:** \_\_\_%

**Tested On:**

- [ ] iOS Simulator (Version: **\_**)
- [ ] Android Emulator (Version: **\_**)

**Tested By:** **********\_**********  
**Date:** **********\_**********

**Critical Issues Found:**

1. ***
2. ***
3. ***

**Notes:**

---

---

---

---

## Troubleshooting

### Notification not appearing

- Check notification permissions are granted
- Check Metro bundler is running
- Check app has network connection
- Try restarting simulator

### Deep link not navigating

- Check browser console for errors
- Verify `deepLinkTest` object is loaded
- Check navigation ref is ready
- Review `[DeepLink]` console logs

### App crashes on navigation

- Check TypeScript compile errors: `npm run typecheck`
- Check route exists in navigation stack
- Review crash logs in Xcode/Android Studio

### Browser console not available

- Shake simulator to open debug menu
- Select "Debug" or "Debug JS Remotely"
- Browser should open automatically
- If not, open `http://localhost:8081/debugger-ui` manually

---

## Next Steps After Manual Testing

1. Run unit tests:

   ```bash
   npm run test:unit -- --testPathPattern=deepLink
   ```

2. Run integration tests:

   ```bash
   RUN_SUPABASE_E2E=true npm run test:e2e -- deepLink
   ```

3. Update `flow-registry.md` with FLOW-17 coverage

4. Create Maestro UI flow test (if not already done)

5. Report any failures in manual testing guide above
