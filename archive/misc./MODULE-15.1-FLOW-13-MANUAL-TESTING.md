# MODULE-15.1 FLOW-13 REFERRALS - Manual Testing Guide (Updated)

## Prerequisites
- iOS Simulator or Android Emulator running
- Test user logged in with referral code generated
- Internet connection (for Supabase production)
- Admin access to toggle referral programs on/off

## Test Environment
- **Platform**: iOS Simulator & Android Emulator
- **Database**: Supabase Production
- **Module**: MODULE-15.1-UI-redesign.md
- **Task**: FLOW-13 Referrals Screen Redesign + Active Programs Display

---

## Test Cases

### TC-001: Back Button Navigation ✅ NEW
**Objective**: Verify back button navigates to previous screen

**Steps**:
1. Open app in simulator
2. Navigate to Profile tab
3. Tap "Refer & Earn"
4. Observe back arrow in header
5. Tap back arrow

**Expected Results**:
- [ ] Back arrow `ArrowLeft` icon is displayed in header (24px, dark)
- [ ] Header shows "Refer & Earn" title (centered, 18px semibold)
- [ ] Tapping back arrow navigates back to Profile screen
- [ ] No crash or error

---

### TC-002: Active Programs - Both Enabled ✅ NEW
**Objective**: Verify active programs card displays correctly when both bonuses are enabled

**Precondition**: Admin has enabled:
- "First Trade Bonus"
- "First Listing Bonus"
- "Entire Referral Program Active"

**Steps**:
1. Navigate to Referrals screen
2. Scroll down below hero card
3. Observe "Active Rewards" section

**Expected Results**:
- [ ] "Active Rewards" card is displayed (white bg, 12px radius, border)
- [ ] Title "Active Rewards" (16px, semibold, dark)
- [ ] Subtext "Your friends earn these bonuses when they join:" (13px, gray)
- [ ] **First Trade Bonus row** is displayed:
  - `Storefront` icon (20px, green, in circular bg)
  - "First Trade Bonus" label (14px, semibold)
  - "+10 SP when they complete their first trade" detail (12px, gray)
  - SP badge (gold bg `#FEF3C7`, `Coins` icon 14px, "10 SP" text)
- [ ] **First Listing Bonus row** is displayed:
  - `Notebook` icon (20px, green, in circular bg)
  - "First Listing Bonus" label (14px, semibold)
  - "+10 SP when their first listing is approved" detail (12px, gray)
  - SP badge (gold bg, "10 SP" text)
- [ ] "You earn:" section at bottom shows:
  - "25 SP per trade • 25 SP per listing" (14px, green `#5DBB8E`, semibold)

---

### TC-003: Active Programs - Only Trade Enabled ✅ NEW
**Objective**: Verify only trade bonus shows when listing bonus is disabled

**Precondition**: Admin has:
- Enabled "First Trade Bonus"
- **Disabled** "First Listing Bonus"

**Steps**:
1. Navigate to Referrals screen
2. Observe "Active Rewards" section

**Expected Results**:
- [ ] "Active Rewards" card is displayed
- [ ] **First Trade Bonus row** is shown
- [ ] **First Listing Bonus row** is NOT shown
- [ ] "You earn:" shows only "25 SP per trade" (no bullet point)

---

### TC-004: Active Programs - Only Listing Enabled ✅ NEW
**Objective**: Verify only listing bonus shows when trade bonus is disabled

**Precondition**: Admin has:
- **Disabled** "First Trade Bonus"
- Enabled "First Listing Bonus"

**Steps**:
1. Navigate to Referrals screen
2. Observe "Active Rewards" section

**Expected Results**:
- [ ] "Active Rewards" card is displayed
- [ ] **First Trade Bonus row** is NOT shown
- [ ] **First Listing Bonus row** is shown
- [ ] "You earn:" shows only "25 SP per listing"

---

### TC-005: Program Paused Globally ✅ NEW
**Objective**: Verify configured bonus options remain visible when global program toggle is OFF

**Precondition**: Admin has:
- **Disabled** "Entire Referral Program Active" toggle
- Enabled at least one of: "First Trade Bonus" or "First Listing Bonus"

**Steps**:
1. Navigate to Referrals screen
2. Observe area below hero card (before SP earned strip)

**Expected Results**:
- [ ] "Active Rewards" card IS displayed
- [ ] Enabled bonus row(s) are visible with correct SP amounts
- [ ] Paused banner is displayed with message:
  - "Referral program is paused globally right now. Rewards shown below are configured but currently not being awarded."
- [ ] Share button is DISABLED (gray `#B0B0B0`, 60% opacity)
- [ ] Tapping disabled share button does nothing

**Additional Check**:
- [ ] If BOTH "First Trade Bonus" and "First Listing Bonus" are disabled, the app should show:
  - "No active referral programs at the moment. Check back later!"

---

### TC-006: Hero Card Visual Design ✅
**Objective**: Verify hero card matches design specs

**Steps**:
1. Navigate to Referrals screen
2. Observe hero card at top

**Expected Results**:
- [ ] Background color is `#5DBB8E` (green)
- [ ] `Gift` icon is displayed (32px, white)
- [ ] Title text "Refer Friends, Earn SP" is displayed (18px, bold, white)
- [ ] Subtext "Share your code and get rewards when they join." is displayed (14px, white, 80% opacity)
- [ ] Border radius is 16px (smooth rounded corners)
- [ ] Card has proper padding (24px)

---

### TC-007: Referral Code Box Visual Design ✅
**Objective**: Verify referral code box matches design specs

**Steps**:
1. Navigate to Referrals screen (from TC-001)
2. Locate the referral code box below SP earned strip

**Expected Results**:
- [ ] Background color is `#FFFFFF` (white)
- [ ] Border radius is 12px
- [ ] Border width is **8px** (thick border)
- [ ] Border color is `#E0E0E0` (light gray)
- [ ] Referral code text is displayed in 20px font
- [ ] Text color is `#1A1A1A` (dark)
- [ ] Letter spacing is 4 (monospace-like)
- [ ] `Copy` icon is displayed on right (20px, `#5DBB8E` green)

---

### TC-008: Copy Referral Code Functionality ✅
**Objective**: Verify copy functionality works correctly

**Steps**:
1. Navigate to Referrals screen
2. Tap the `Copy` icon button

**Expected Results**:
- [ ] Alert appears with title "Copied!"
- [ ] Alert message reads "Referral code copied to clipboard"
- [ ] Code is actually copied (can be pasted elsewhere)

---

### TC-004: Share Button Visual Design ✅
**Objective**: Verify share button matches design specs

**Steps**:
1. Navigate to Referrals screen
2. Locate the "Share" button below code box

**Expected Results**:
- [ ] Button background is `#5DBB8E` (green pill)
- [ ] Button height is 52px
- [ ] Border radius creates pill shape
- [ ] `ShareNetwork` icon is displayed on left (18px, white)
- [ ] Text "Share" is displayed (16px, white, semibold)
- [ ] Icon and text are properly aligned

---

### TC-005: Share Referral Code Functionality ✅
**Objective**: Verify share functionality invokes native share sheet

**Steps**:
1. Navigate to Referrals screen
2. Tap the "Share" button

**Expected Results**:
- [ ] **iOS**: Native share sheet appears from bottom
- [ ] **Android**: Native share dialog appears
- [ ] Share message includes: "Join Kids Club+ and get [rewards]! Use my referral code: [CODE]"
- [ ] Share message includes referral link (e.g., https://app.kidsclub.com/signup?ref=TEST1234)
- [ ] Can cancel share without error

---

### TC-006: SP Earned Strip Visual Design ✅
**Objective**: Verify SP earned strip matches design specs

**Steps**:
1. Navigate to Referrals screen
2. Locate SP earned strip below hero card

**Expected Results**:
- [ ] Background color is `#FEF3C7` (light yellow/gold)
- [ ] `Coins` icon is displayed (20px, `#F59E0B` amber/gold)
- [ ] Text reads "You've earned [N] SP from referrals"
- [ ] Font size is 14px
- [ ] Text color is `#1A1A1A` (dark)
- [ ] SP count ([N]) is **bold**
- [ ] Border radius is 12px
- [ ] Proper padding (16px)

---

### TC-007: Referral History List - With Referrals ✅
**Objective**: Verify referral history list displays correctly when referrals exist

**Precondition**: User has at least 2 referrals (1 completed, 1 pending)

**Steps**:
1. Navigate to Referrals screen
2. Scroll down to "Referral History" section
3. Observe referral list items

**Expected Results**:
- [ ] Section title "Referral History" is displayed (18px, semibold, `#1A1A1A`)
- [ ] Each row has white background with 12px border radius
- [ ] Avatar placeholder is 36px circle with `UserCircle` icon (`#6B6B6B`)
- [ ] Referral name is displayed (15px, semibold, `#1A1A1A`)
- [ ] "Joined [date]" text is displayed (13px, `#6B6B6B`)
- [ ] **Completed referrals**: `CheckCircle` icon is shown (16px, `#5DBB8E` green)
- [ ] **Completed referrals**: "+[N] SP" text is `#F59E0B` (amber/gold, 13px, semibold)
- [ ] **Pending referrals**: NO `CheckCircle` icon
- [ ] **Pending referrals**: "+[N] SP" text is `#6B6B6B` (gray, not gold)
- [ ] Proper spacing between list items (12px)

---

### TC-008: Referral History List - Empty State ✅
**Objective**: Verify empty state displays correctly when no referrals exist

**Precondition**: User has 0 referrals

**Steps**:
1. Create new test user or use account with no referrals
2. Navigate to Referrals screen
3. Scroll to "Referral History" section

**Expected Results**:
- [ ] `Users` icon is displayed (64px, `#E0E0E0` light gray, filled)
- [ ] Text reads "No referrals yet — share your code!"
- [ ] Text is centered
- [ ] Font size is 15px
- [ ] Text color is `#6B6B6B` (gray)
- [ ] Proper vertical padding (32px)

---

### TC-009: Loading State ✅
**Objective**: Verify loading indicator appears while data is fetching

**Steps**:
1. Clear app cache or force reload
2. Navigate to Referrals screen quickly
3. Observe initial loading state

**Expected Results**:
- [ ] Loading spinner is displayed in center of screen
- [ ] Spinner color is `#5DBB8E` (green)
- [ ] Spinner size is "large"
- [ ] No content is shown until data loads

---

### TC-010: Scroll Behavior ✅
**Objective**: Verify screen scrolls properly with long referral history

**Precondition**: User has 10+ referrals

**Steps**:
1. Navigate to Referrals screen
2. Scroll down through referral history
3. Scroll back up to hero card

**Expected Results**:
- [ ] Scroll is smooth without lag
- [ ] All content is accessible via scroll
- [ ] Hero card, code box, and button remain properly styled
- [ ] List items render correctly during scroll

---

### TC-011: Icon Library Compliance ✅
**Objective**: Verify no Ionicons or MaterialIcons are used

**Steps**:
1. Navigate to Referrals screen
2. Inspect all icons visually

**Expected Results**:
- [ ] All icons are from `phosphor-react-native` library
- [ ] Icons used: `Gift`, `Copy`, `ShareNetwork`, `Coins`, `Users`, `CheckCircle`, `UserCircle`
- [ ] No Ionicons or MaterialIcons imports in code

---

### TC-012: Responsive Layout - iOS ✅
**Objective**: Verify layout works on different iOS screen sizes

**Steps**:
1. Test on iPhone SE (small screen)
2. Test on iPhone 15 Pro (medium screen)
3. Test on iPhone 15 Pro Max (large screen)

**Expected Results**:
- [ ] All elements are visible and properly sized on all devices
- [ ] Text is readable without truncation
- [ ] Buttons are tappable (not cut off)
- [ ] No horizontal scroll needed

---

### TC-013: Responsive Layout - Android ✅
**Objective**: Verify layout works on different Android screen sizes

**Steps**:
1. Test on Pixel 4 (small/medium screen)
2. Test on Pixel 7 Pro (large screen)

**Expected Results**:
- [ ] All elements are visible and properly sized on all devices
- [ ] Text is readable without truncation
- [ ] Buttons are tappable (not cut off)
- [ ] No horizontal scroll needed

---

### TC-014: Error Handling - Failed Data Load ✅
**Objective**: Verify error handling when data fetch fails

**Steps**:
1. Disable internet connection or simulate network error
2. Navigate to Referrals screen

**Expected Results**:
- [ ] Alert appears with title "Error"
- [ ] Alert message reads "Failed to load referral data"
- [ ] Screen does not crash
- [ ] User can retry by navigating away and back

---

### TC-015: Referral ID Formatting ✅
**Objective**: Verify referral ID is formatted when no name is available

**Precondition**: At least one referral has no user name

**Steps**:
1. Navigate to Referrals screen
2. Observe referral history items with no name

**Expected Results**:
- [ ] Referral without name displays as "User #[first 8 chars of ID]"
- [ ] Format is consistent across all unnamed referrals

---

### TC-016: Date Formatting ✅
**Objective**: Verify "Joined [date]" displays correctly

**Steps**:
1. Navigate to Referrals screen
2. Observe "Joined" dates in referral history

**Expected Results**:
- [ ] Date format matches device locale (e.g., "5/1/2026" for US)
- [ ] Date is accurate and not placeholder
- [ ] Text color is `#6B6B6B` (gray)

---

## Test Summary

Total Test Cases: **21** (updated from 16)

### Pass Criteria
- All visual design elements match MODULE-15.1 specs
- Back button navigation works
- Active programs display correctly based on admin toggles
- Warning message shows when no programs are active
- Share button disables when no programs active
- All interactions work correctly
- No Ionicons/MaterialIcons imports
- Responsive on iOS & Android simulators
- No console errors or crashes

### Fail Criteria
- Any visual element doesn't match spec
- Copy or share functionality broken
- App crashes or shows error screen
- Icons from wrong library used

---

## Notes for Tester
- Use **iOS Simulator** and **Android Emulator** (not physical devices)
- Test against **Supabase production** database
- Take screenshots of any failures
- Document any visual discrepancies with expected vs actual
- Report any performance issues (slow loading, laggy scrolling)

---

## Sign-off
| Role | Name | Date | Status |
|------|------|------|--------|
| Tester | __________ | ______ | ☐ Pass / ☐ Fail |
| Developer | __________ | ______ | ☐ Verified |
