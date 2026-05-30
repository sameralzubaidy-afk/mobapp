# FLOW-26: Misc / Edge-Case Screens — Manual Testing Guide

**Module**: MODULE-15.1-UI-redesign.md  
**Task ID**: FLOW-26  
**Screens**: 6 total (OfflineScreen, EmptySearchState, EmptyState, LoadingScreen, SuccessScreen, ErrorScreen)  
**Testing Platform**: iOS Simulator & Android Emulator  
**Estimated Time**: 30 minutes

---

## Pre-Test Setup

### Requirements
- ✅ User account created and logged in
- ✅ Active node assignment
- ✅ Network connectivity enabled (will be toggled during tests)
- ✅ At least one test listing in the system (for search tests)

### Test Data
Create a test user if not already done:
- Email: `test+flow26@example.com`
- Password: `Test1234!`

---

## Test Cases

### TC-01: OfflineScreen — Network Error State

**Objective**: Verify offline screen appears correctly when network is unavailable

**Steps**:
1. Open iOS Simulator or Android Emulator
2. Launch the app and log in
3. Enable Airplane Mode (iOS: Settings > Airplane Mode ON) / (Android: Swipe down, tap Airplane icon)
4. In the app, navigate to Discover tab
5. Attempt to load items

**Expected Results**:
- [ ] Offline screen displays with white background
- [ ] `WifiX` icon visible, gray color (#E0E0E0), 64px size
- [ ] Heading: "No Internet Connection" — 22px, semibold, black (#1A1A1A)
- [ ] Subtext: "Check your connection and try again" — 15px, gray (#6B6B6B)
- [ ] "Try Again" button: green pill (#5DBB8E), 52px height, pill-shaped (borderRadius 26px)
- [ ] `ArrowCounterClockwise` icon visible inside button (18px, white)
- [ ] Screen centered, 24px horizontal padding

**Actions**:
6. Tap "Try Again" button
7. Disable Airplane Mode
8. Wait 2-3 seconds
9. Tap "Try Again" again

**Expected Results After Retry**:
- [ ] Screen dismisses or retries network call
- [ ] Content loads successfully when network is back

**Test ID**: `offline-screen`, `retry-button`

---

### TC-02: EmptySearchState — No Search Results

**Objective**: Verify empty search state displays correctly

**Steps**:
1. Ensure logged in and on Discover screen
2. Tap the search bar
3. Type: `xyznotfound12345` (a query that returns no results)
4. Submit search (tap Search/Enter on keyboard)

**Expected Results**:
- [ ] EmptySearchState component displays
- [ ] `MagnifyingGlassSlash` icon visible, gray (#E0E0E0), 56px size
- [ ] Title: "No results for "xyznotfound12345"" — 17px, semibold, black (#1A1A1A)
- [ ] Subtitle: "Try different keywords or filters" — 14px, gray (#6B6B6B)
- [ ] Centered layout, 24px horizontal padding

**Test ID**: `empty-search-state`, `empty-search-icon`, `empty-search-title`

---

### TC-03: EmptyState (Generic) — Reusable Component

**Objective**: Verify generic empty state component with custom props

**Steps**:
1. Navigate to My Listings (Profile > My Listings)
2. If you have listings, delete them all to trigger empty state
3. Alternatively, navigate to a section known to use EmptyState (e.g., Favorites, Messages if no conversations)

**Expected Results**:
- [ ] EmptyState component displays
- [ ] Custom icon passed as prop is visible (56px, gray #E0E0E0)
- [ ] Title displays correctly (17px, semibold, black #1A1A1A)
- [ ] Subtitle displays correctly (14px, gray #6B6B6B, 20px line height)
- [ ] If action button provided: green pill (44px height, borderRadius 22px), centered

**Optional Action Test**:
4. If action button visible (e.g., "Create Listing"), tap it

**Expected Results**:
- [ ] Action handler fires correctly (navigates or triggers expected action)

**Test ID**: `empty-state`, `empty-state-title`, `empty-state-action-button`

---

### TC-04: LoadingScreen — Async Loading State

**Objective**: Verify loading screen displays correctly

**Steps**:
1. Log out of the app
2. Log back in
3. Observe the screen during authentication/profile load

**OR (alternative trigger)**:
1. Navigate to Settings > Help & Support
2. Tap "Contact Support" or any section that requires data fetching

**Expected Results**:
- [ ] Loading screen displays with white background (#FFFFFF)
- [ ] `ActivityIndicator` visible, green color (#5DBB8E), large size
- [ ] Loading text: "Loading…" — 15px, gray (#6B6B6B), centered below spinner
- [ ] Centered layout
- [ ] 16px gap between spinner and text

**Test ID**: `loading-screen`, `loading-indicator`, `loading-text`

---

### TC-05: SuccessScreen — Action Success Feedback

**Objective**: Verify success screen displays correctly after successful action

**Steps**:
1. Navigate to Create Listing (Discover > "+" button or Profile > My Listings > Add Item)
2. Fill out all required fields:
   - Upload at least one photo
   - Title: "Test Toy for Sale"
   - Description: "Test description"
   - Price: $15
   - Condition: Good
   - Category: Toys
3. Tap "Publish Listing" button
4. Wait for submission to complete

**Expected Results**:
- [ ] Success screen displays with white background
- [ ] `CheckCircle` icon visible, green (#5DBB8E), 72px size, fill weight
- [ ] Title: "Item Listed!" or similar — 24px, semibold, black (#1A1A1A)
- [ ] Subtitle (if provided): 15px, gray (#6B6B6B), 22px line height
- [ ] CTA button: green pill (#5DBB8E), 52px height, pill-shaped (borderRadius 26px)
- [ ] CTA label: "Continue" or custom label (16px, semibold, white)
- [ ] Centered layout, 24px horizontal padding, 12px gap between elements

**Actions**:
5. Tap CTA button

**Expected Results After CTA**:
- [ ] Navigates to expected screen (My Listings, Dashboard, or as configured)

**Test ID**: `success-screen`, `success-icon`, `success-title`, `success-cta-button`

---

### TC-06: ErrorScreen — Action Failure Feedback

**Objective**: Verify error screen displays correctly after failed action

**Steps**:
1. Navigate to Create Listing
2. Do NOT fill any required fields
3. Tap "Publish Listing" button immediately

**Expected Results** (if inline validation):
- Inline error messages appear, ErrorScreen NOT shown

**Alternative Trigger** (if above doesn't trigger ErrorScreen):
1. Navigate to Settings
2. Attempt an action that might fail (e.g., update profile without network)
3. Enable Airplane Mode
4. Try to save profile changes

**Expected Results** (ErrorScreen):
- [ ] Error screen displays with white background
- [ ] `XCircle` icon visible, red (#E85D75), 72px size, fill weight
- [ ] Title: "Something Went Wrong" or custom title — 24px, semibold, black (#1A1A1A)
- [ ] Error message: custom or "An error occurred. Please try again." — 15px, gray (#6B6B6B), 22px line height
- [ ] "Try Again" button: green pill (#5DBB8E), 52px height, `ArrowCounterClockwise` icon (18px, white)
- [ ] "Go Back" link: 14px, gray (#6B6B6B), text link (not button), 16px vertical padding
- [ ] Centered layout, 24px horizontal padding, 12px gap between elements

**Actions**:
5. Tap "Try Again" button (should retry action)
6. Tap "Go Back" link (should navigate back)

**Expected Results After Actions**:
- [ ] "Try Again" attempts to retry the failed action
- [ ] "Go Back" navigates to previous screen

**Test ID**: `error-screen`, `error-icon`, `retry-button`, `go-back-link`

---

## Design System Validation Checklist

Verify across ALL 6 screens:

### Colors
- [ ] Primary green: `#5DBB8E` (buttons, success icon, node badges)
- [ ] Error red: `#E85D75` (error icon only)
- [ ] Background: `#FFFFFF` (white)
- [ ] Text primary: `#1A1A1A` (headings)
- [ ] Text secondary: `#6B6B6B` (subtexts, body)
- [ ] Icon gray: `#E0E0E0` (empty state icons)

### Typography
- [ ] Headings: 22-24px, `fontWeight '600'` (semibold)
- [ ] Body text: 15-17px, regular
- [ ] Subtexts: 14px, regular, `color #6B6B6B`

### Buttons
- [ ] Primary buttons: `backgroundColor #5DBB8E`, `borderRadius 26` (pill), `height 52px`
- [ ] Button text: 16px, `fontWeight '600'`, white
- [ ] Icons inside buttons: white color, appropriately sized (16-18px)

### Icons
- [ ] All icons from Phosphor Icons library
- [ ] No Ionicons, MaterialIcons, or other legacy icons
- [ ] Correct sizes per spec (56-72px for large, 16-20px for button icons)

### Layout
- [ ] Centered layouts on all screens
- [ ] Horizontal padding: 24px
- [ ] Consistent gap/spacing between elements (8-16px)

---

## Cross-Platform Testing

### iOS Simulator
- [ ] All 6 screens render correctly
- [ ] Touch interactions work (tap buttons, links)
- [ ] Accessibility labels present (VoiceOver compatible)
- [ ] No visual glitches or layout issues

### Android Emulator
- [ ] All 6 screens render correctly
- [ ] Touch interactions work
- [ ] Accessibility labels present (TalkBack compatible)
- [ ] No visual glitches or layout issues
- [ ] No performance issues (smooth animations)

---

## Regression Check

Verify existing functionality NOT broken:

- [ ] Dashboard still loads correctly
- [ ] Discover/Search works (with and without results)
- [ ] Listing creation flow intact (success path)
- [ ] Profile/Settings navigation works
- [ ] Network error handling works (Offline screen shows when appropriate)
- [ ] Loading states show during async operations

---

## Bug Reporting Template

If any test fails, report using this format:

**TC ID**: TC-XX  
**Screen**: [OfflineScreen / EmptySearchState / etc.]  
**Platform**: iOS Simulator 17.5 / Android Emulator API 34  
**Severity**: High / Medium / Low  
**Steps to Reproduce**:  
1. ...  
2. ...  

**Expected**: [What should happen]  
**Actual**: [What actually happened]  
**Screenshots**: [Attach if visual issue]  

---

## Test Sign-Off

**Tester Name**: ________________  
**Date**: ________________  
**Platform(s) Tested**: iOS ☐  Android ☐  
**All Tests Passed**: Yes ☐  No ☐  
**Notes**: ________________

---

## Quick Commands Reference

```bash
# Run unit tests
cd p2p-kids-marketplace
npm run test:unit

# Run Maestro flow test (iOS)
npm run test:maestro:ios -- .maestro/module-15.1-flow-26-misc-screens.yaml

# Run Maestro flow test (Android)
npm run test:maestro:android -- .maestro/module-15.1-flow-26-misc-screens.yaml

# Typecheck
npm run typecheck

# Lint
npm run lint
```
