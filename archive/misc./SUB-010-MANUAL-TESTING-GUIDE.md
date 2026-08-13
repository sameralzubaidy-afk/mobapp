# SUB-010: Subscription UI Components - Manual Testing Guide

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md
**Task:** SUB-010 - Subscription UI Components (Member-Facing)
**Date:** Created for manual verification on iOS/Android simulators

---

## Prerequisites

### Setup
1. **Environment**: iOS Simulator or Android Emulator
2. **Build**: `cd p2p-kids-marketplace && npm run ios` or `npm run android`
3. **Test Users**: You'll need test accounts in various subscription states:
   - Free user (no subscription)
   - Trial user (active trial)
   - Active subscriber
   - Cancelled subscriber
   - Grace period subscriber
   - Expired subscriber

### Navigation Access
- Deep link: `p2pkidsmarketplace://kids-club-overview`
- **Free users**: Profile → "👑 Join Kids Club+ Membership" button
- **Active users**: Profile → "👑 Manage Kids Club+ Membership" button
- **Via Banner**: Home screen → tap SubscriptionBanner (if visible)

---

## Test Cases

### TC-01: KidsClubOverviewScreen - Initial Display (Free User)

**Objective**: Verify the Kids Club+ overview screen displays correctly for a free user

**Preconditions**: 
- User is logged in
- User has no subscription (free tier)

**Steps**:
1. Navigate to Profile → tap "👑 Join Kids Club+ Membership" button
2. Verify screen displays the following elements:
   - 🎉 emoji
   - Title: "Kids Club+"
   - Subtitle describing Swap Points and benefits
   - SubscriptionStatusCard showing "You are on the Free plan"
   - "Why parents love Kids Club+" section with 6 benefits
   - "How It Works" section with 3 steps
   - Primary button: "Start 30-Day Free Trial"
   - Fine print about pricing and cancellation

**Expected Result**:
- ✅ All elements are visible
- ✅ Text is readable and properly formatted
- ✅ Spacing and layout look polished
- ✅ Primary button is prominently displayed

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-02: SubscriptionStatusCard - Free User State

**Objective**: Verify the status card displays correctly for free users

**Preconditions**: User is on free plan

**Steps**:
1. Navigate to Profile → tap "👑 Join Kids Club+ Membership" button
2. Locate the SubscriptionStatusCard (below the header)
3. Verify card content:
   - Shows "You are on the Free plan"
   - Shows upgrade message about Swap Points, reduced fees, etc.
   - Card has light gray background
   - Card has border and shadow

**Expected Result**:
- ✅ Free plan message is clear
- ✅ Upgrade call-to-action is compelling
- ✅ Card styling is clean and readable

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-03: KidsClubOverviewScreen - Trial User CTA

**Objective**: Verify correct CTA for trial users

**Preconditions**: User is on active trial

**Steps**:
1. Navigate to Profile → tap "👑 Manage Kids Club+ Membership" button (trial users see this along with "Manage Kids Club+")
2. Verify SubscriptionStatusCard shows:
   - "On 30-day free trial"
   - Trial end date
   - Blue background styling
3. Verify primary button says: "Continue Kids Club+"
4. Tap the primary button
5. Verify navigation to ContinueKidsClub screen (SUB-006 trial conversion)

**Expected Result**:
- ✅ Trial status is clearly displayed
- ✅ Trial end date is formatted correctly (MMM D, YYYY)
- ✅ CTA button says "Continue Kids Club+"
- ✅ Tapping button navigates to ContinueKidsClub screen

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-04: KidsClubOverviewScreen - Management View (Active User)

**Objective**: Verify the management view for active subscribers

**Preconditions**: User has active Kids Club+ subscription

**Steps**:
1. Navigate to Profile
2. Tap "👑 Manage Kids Club+ Membership"
3. Verify SubscriptionStatusCard shows "Kids Club+ is active"
4. Scroll to bottom
5. Verify "Management Section" exists
6. Verify "Update Payment Method" and "Cancel Membership" buttons are visible

**Expected Result**:
- ✅ Management options are directly accessible
- ✅ Status card confirms active subscription
- ✅ Cancellation option is available

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-04a: Cancellation Flow

**Objective**: Verify the cancellation flow works correctly

**Preconditions**: User is in the management view (TC-04)

**Steps**:
1. Tap "Cancel Membership"
2. Verify Modal appears
3. Select reason "Too expensive"
4. Tap "Cancel Subscription"
5. Verify success alert

**Expected Result**:
- ✅ Cancellation modal is displayed
- ✅ Reason selection works
- ✅ Cancellation request is processed successfully

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-05: KidsClubOverviewScreen - Grace Period Warning

**Objective**: Verify grace period message displays correctly

**Preconditions**: User is in grace period (duration must match admin-configured `grace_period_days`)

**Steps**:
1. Navigate to Profile → tap "👑 Join Kids Club+ Membership" button to reach Kids Club Overview screen
2. Verify SubscriptionStatusCard shows:
   - "Grace period (SP frozen)"
   - Grace period warning message
   - Red/pink background styling
3. Verify grace message says something like: "You have X days to re-subscribe before your Swap Points are deleted."
4. Verify `X` matches the actual countdown from `grace_ends_at` and aligns with your current admin-configured grace duration logic.
5. Verify primary button says: "Re-subscribe and Unlock SP"

**Expected Result**:
- ✅ Grace period status is prominently displayed
- ✅ Warning message is clear and urgent
- ✅ Days remaining is calculated correctly
- ✅ CTA emphasizes re-subscribing

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-06: SubscriptionBanner - Visibility on Home Screen

**Objective**: Verify subscription banner appears on home screen for non-active users

**Preconditions**: User is NOT an active subscriber (free, trial, grace, or expired)

**Steps**:
1. Navigate to Home screen
2. Scroll to find SubscriptionBanner
3. Verify banner displays:
   - "Kids Club+" label
   - Status-appropriate message
   - Status-appropriate CTA
4. Verify banner does NOT appear if user is active subscriber or cancelled (still within period)

**Expected Result**:
- ✅ Banner is visible for free/trial/grace/expired users
- ✅ Banner is NOT visible for active/cancelled users
- ✅ Message matches user's subscription state
- ✅ Banner styling is clean (light blue background, rounded corners)

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-07: SubscriptionBanner - Navigation (Free User)

**Objective**: Verify banner navigation for free users

**Preconditions**: User is on free plan

**Steps**:
1. Navigate to Home screen
2. Locate SubscriptionBanner
3. Verify banner shows:
   - Message: "Unlock Swap Points and lower fees with Kids Club+."
   - CTA: "Start Free Trial"
4. Tap anywhere on the banner
5. Verify navigation to KidsClubOverview screen

**Expected Result**:
- ✅ Banner is tappable
- ✅ Navigates to Kids Club Overview
- ✅ No errors or crashes

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-08: SubscriptionBanner - Trial User Message

**Objective**: Verify banner message for trial users

**Preconditions**: User is on active trial

**Steps**:
1. Navigate to Home screen or SP Wallet screen
2. Locate SubscriptionBanner
3. Verify banner shows:
   - Message: "You are on a free trial of Kids Club+. Add a card to keep your Swap Points."
   - CTA: "Continue Kids Club+"
4. Tap the banner
5. Verify navigation to ContinueKidsClub screen

**Expected Result**:
- ✅ Message is specific to trial users
- ✅ CTA emphasizes continuing subscription
- ✅ Navigation goes to ContinueKidsClub screen (SUB-006)

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-09: SubscriptionBanner - Grace Period Message

**Objective**: Verify banner message for users in grace period

**Preconditions**: User is in grace period

**Steps**:
1. Navigate to Home screen or SP Wallet screen
2. Locate SubscriptionBanner
3. Verify banner shows:
   - Message: "Your Swap Points are frozen. Re-subscribe to use them again."
   - CTA: "Re-subscribe"
4. Tap the banner
5. Verify navigation to KidsClubOverview screen

**Expected Result**:
- ✅ Message communicates SP freeze urgently
- ✅ CTA is clear about re-subscribing
- ✅ Navigation to overview (where they can re-subscribe)

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-10: SubscriptionBanner - Expired User Message

**Objective**: Verify banner message for expired subscribers

**Preconditions**: User's subscription has expired

**Steps**:
1. Navigate to Home screen
2. Locate SubscriptionBanner
3. Verify banner shows:
   - Message: "Kids Club+ expired. Re-subscribe to start earning Swap Points again."
   - CTA: "Re-subscribe"
4. Tap the banner
5. Verify navigation to KidsClubOverview screen

**Expected Result**:
- ✅ Message indicates subscription has expired
- ✅ Emphasizes re-earning SP
- ✅ Navigation works correctly

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-11: Benefits List - Content Accuracy

**Objective**: Verify all benefits are listed correctly

**Preconditions**: Any user state

**Steps**:
1. Navigate to Kids Club Overview screen (via Profile button appropriate for your user state)
2. Scroll to "Why parents love Kids Club+" section
3. Verify all 6 benefits are listed:
   - 💰 Earn Swap Points every time you sell items
   - 🎯 Use points for discounts on future finds (up to 50% off)
   - 💵 Pay only $0.99 per transaction (vs $2.99)
   - ⚡ Get early access to new listings
   - 🌱 Help your child learn smart money habits
   - ♻️ Reduce waste and support sustainable shopping

**Expected Result**:
- ✅ All 6 benefits are displayed
- ✅ Icons match each benefit
- ✅ Text is accurate and matches requirements
- ✅ Benefits are in correct order

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-12: How It Works Section

**Objective**: Verify "How It Works" section displays correctly

**Preconditions**: Any user state

**Steps**:
1. Navigate to Kids Club Overview screen (via Profile button appropriate for your user state)
2. Scroll to "How It Works" section
3. Verify 3 steps are displayed:
   - Step 1: Start your free trial (30 days free, no card required)
   - Step 2: List and sell items (Earn SP with every sale)
   - Step 3: Shop and save (Use SP for discounts)
4. Verify each step has:
   - Numbered circle (blue background)
   - Title in bold
   - Description text

**Expected Result**:
- ✅ All 3 steps are visible
- ✅ Step numbers are in circles (1, 2, 3)
- ✅ Text is clear and concise
- ✅ Layout is clean

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-13: Fine Print / Terms

**Objective**: Verify fine print displays correctly

**Preconditions**: Any user state

**Steps**:
1. Navigate to Kids Club Overview screen (via Profile button appropriate for your user state)
2. Scroll to bottom of screen
3. Verify fine print text appears below primary button:
   - "After your free trial, Kids Club+ is just <admin-configured monthly price>/month. Cancel anytime with no penalty. Your Swap Points remain frozen for <admin-configured grace_period_days> days if you cancel."
4. Verify text is smaller, lighter color (gray)

**Expected Result**:
- ✅ Fine print is visible
- ✅ Content is accurate
- ✅ Styling differentiates it from main content
- ✅ Mentions: trial, price, cancellation, grace period

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-14: Loading State

**Objective**: Verify loading indicator displays while fetching subscription

**Preconditions**: Fresh app launch or slow network

**Steps**:
1. Launch app and quickly navigate to Kids Club Overview (via Profile button)
2. Observe loading state
3. Verify:
   - Loading spinner is centered
   - "Loading subscription..." text appears
   - Content appears after loading completes

**Expected Result**:
- ✅ Loading indicator is visible
- ✅ Message is clear
- ✅ Transition to content is smooth
- ✅ No flashing or layout shift

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-15: Price Formatting

**Objective**: Verify price is formatted correctly in SubscriptionStatusCard

**Preconditions**: User is active or cancelled subscriber

**Steps**:
1. Navigate to Kids Club Overview screen (via Profile button appropriate for your user state)
2. Locate SubscriptionStatusCard
3. Verify price displays as: "$4.99 / month"
4. Verify:
   - Dollar sign is present
   - Decimal formatting is correct (2 places)
   - "/ month" is in lighter gray text

**Expected Result**:
- ✅ Price is "$4.99 / month"
- ✅ Formatting is clean and readable
- ✅ Matches design specs

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-16: Date Formatting

**Objective**: Verify dates are formatted correctly

**Preconditions**: User has trial or active subscription

**Steps**:
1. Navigate to Kids Club Overview screen (via Profile button appropriate for your user state)
2. Locate date in SubscriptionStatusCard
3. Verify date format: "MMM DD, YYYY" (e.g., "Dec 31, 2024")
4. Verify date label is appropriate:
   - "Trial ends:" for trial
   - "Next billing:" for active
   - "Access until:" for cancelled

**Expected Result**:
- ✅ Date format is clear and standard
- ✅ Date label matches subscription status
- ✅ Date value is accurate

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-17: Cross-Platform Consistency (iOS vs Android)

**Objective**: Verify UI looks consistent on iOS and Android

**Preconditions**: Test on both simulators

**Steps**:
1. Run test on iOS Simulator
2. Take screenshots of:
   - Kids Club Overview screen
   - SubscriptionStatusCard
   - SubscriptionBanner
3. Run test on Android Emulator
4. Take same screenshots
5. Compare for consistency in:
   - Layout
   - Spacing
   - Colors
   - Fonts
   - Shadows/elevations

**Expected Result**:
- ✅ UI is consistent across platforms
- ✅ No major layout differences
- ✅ Colors and fonts match
- ✅ Touch targets are appropriate

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-18: Accessibility

**Objective**: Verify components are accessible

**Preconditions**: Enable VoiceOver (iOS) or TalkBack (Android)

**Steps**:
1. Enable screen reader
2. Navigate to Kids Club Overview screen (via Profile button)
3. Swipe through elements and verify:
   - All text is read aloud
   - Buttons have clear labels
   - Interactive elements are focusable
4. Test SubscriptionBanner accessibility
5. Verify touch targets are at least 44x44 points

**Expected Result**:
- ✅ Screen reader can navigate all elements
- ✅ Button labels are descriptive
- ✅ Touch targets meet minimum size
- ✅ No inaccessible content

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-19: Error Handling - Network Failure

**Objective**: Verify graceful handling of subscription fetch failure

**Preconditions**: Simulate network error (offline mode or mock API failure)

**Steps**:
1. Turn on airplane mode or block network for app
2. Navigate to Kids Club Overview screen (via Profile button)
3. Observe behavior when subscription fetch fails
4. Verify:
   - No crash
   - Error is handled gracefully
   - User sees sensible fallback (e.g., default to free plan UI)

**Expected Result**:
- ✅ No crash or blank screen
- ✅ Error message or fallback UI is shown
- ✅ User can still interact with app

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

### TC-20: Integration with Existing Screens

**Objective**: Verify SubscriptionBanner integrates correctly in other screens

**Preconditions**: User is non-active subscriber

**Steps**:
1. Navigate to Home screen → verify banner appears
2. Navigate to SP Wallet screen → verify banner appears
3. Navigate to Create Listing screen → verify banner appears (if in scope)
4. Verify banner does NOT interfere with:
   - Scrolling
   - Other interactive elements
   - Screen layout

**Expected Result**:
- ✅ Banner appears in key screens
- ✅ Banner does not break layout
- ✅ Banner is dismissible or non-intrusive
- ✅ Tapping banner navigates correctly from each screen

**Status**: ⬜ Pass / ⬜ Fail / ⬜ Not Tested

**Notes**: _______________________________________________

---

## Summary

**Total Test Cases**: 20
**Passed**: ___
**Failed**: ___
**Not Tested**: ___

**Tested By**: _______________
**Date**: _______________
**Device/Simulator**: _______________
**OS Version**: _______________

### Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Additional Notes
_______________________________________________
_______________________________________________
_______________________________________________

---

## Quick Command Reference

```bash
# Install dependencies
cd p2p-kids-marketplace
npm install

# Run iOS simulator
npm run ios

# Run Android emulator
npm run android

# Run unit tests
npm test

# Run specific test file
npm test -- formatPrice.test.ts

# Run E2E tests (if configured)
npm run test:e2e

# TypeScript compile check
npx tsc --noEmit

# Lint check
npm run lint
```

---

## Next Steps After Testing

1. ✅ Run all manual test cases
2. ✅ Document any issues found
3. ✅ Run automated unit tests: `npm test`
4. ✅ Verify Tier 0 gates pass (typecheck + lint)
5. ✅ If issues found, create tickets and prioritize fixes
6. ✅ Once tests pass, mark SUB-010 as complete
7. ✅ Update flow-registry.md with SUB-010 completion status
