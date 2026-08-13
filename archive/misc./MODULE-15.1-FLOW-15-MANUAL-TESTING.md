# MANUAL TESTING GUIDE: FLOW-15 User Profile Screens

**Module**: MODULE-15.1-UI-redesign.md  
**Task**: FLOW-15 User Profile  
**Tester**: _________________  
**Date**: _________________  
**Platform**: ☐ iOS Simulator  ☐ Android Emulator

---

## Prerequisites

- ✅ App is running in iOS Simulator or Android Emulator
- ✅ User is logged in with a complete profile
- ✅ User has at least 1 earned badge (for Badges screen testing)
- ✅ Test data available (use test-users.json if needed)

---

## TEST CASE 1: My Profile Screen (ProfileScreen.tsx)

**Steps**:
1. Tap "Profile" tab in bottom navigation
2. Wait for profile to load

**Expected Results**:

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 1.1 | Avatar is 96×96px circle with `#F0F0F0` background | ☐ | |
| 1.2 | Camera overlay is 28px green circle (`#5DBB8E`) at bottom-right of avatar | ☐ | |
| 1.3 | Camera icon inside overlay is white, 14px | ☐ | |
| 1.4 | `ShieldCheck` icon (16px, `#5DBB8E`) appears inline after name for verified users | ☐ | |
| 1.5 | Location row shows `MapPin` icon (14px, `#6B6B6B`) + node name | ☐ | |
| 1.6 | Stats row shows 3 chips with `#F7F7F7` background, 12px radius | ☐ | |
| 1.7 | Stats labels are uppercase (11px, `#6B6B6B`) | ☐ | |
| 1.8 | "Edit Profile" button is secondary outlined (border `#5DBB8E`, NOT filled) | ☐ | |
| 1.9 | `PencilSimple` icon (16px, `#5DBB8E`) appears in Edit Profile button | ☐ | |
| 1.10 | Screen background is white (`#FFFFFF`), not gray | ☐ | |
| 1.11 | No Ionicons or MaterialIcons present (only Phosphor) | ☐ | |

**Screenshot**: Attach screenshot showing avatar, name, stats row, and Edit Profile button

---

## TEST CASE 2: Edit Profile Screen (EditProfileScreen.tsx)

**Steps**:
1. From Profile screen, tap "Edit Profile" button
2. Wait for Edit Profile screen to load

**Expected Results**:

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 2.1 | Title "Edit Profile" is 24px, fontWeight 600, color `#1A1A1A` | ☐ | |
| 2.2 | Avatar is 96×96px circle with camera overlay (28px green circle) | ☐ | |
| 2.3 | "DISPLAY NAME" label is uppercase, 13px, `#6B6B6B` | ☐ | |
| 2.4 | Display name input has `User` icon (20px, `#6B6B6B`) on left | ☐ | |
| 2.5 | Input wrapper is filled style: `#F0F0F0` background, 12px radius, 52px height, NO border | ☐ | |
| 2.6 | "PHONE NUMBER" input has `Phone` icon (20px, `#6B6B6B`) | ☐ | |
| 2.7 | "ZIP CODE" input has `MapPin` icon (20px, `#5DBB8E` GREEN) | ☐ | |
| 2.8 | Bio textarea is filled style, min 100px height, no border | ☐ | |
| 2.9 | Character counter shows "X/200 characters" in `#999999` | ☐ | |
| 2.10 | "Save Changes" button is green pill: `#5DBB8E`, borderRadius 26, height 52 | ☐ | |
| 2.11 | All inputs use `placeholderTextColor="#999999"` | ☐ | |
| 2.12 | Screen background is white (`#FFFFFF`) | ☐ | |

**Interaction Test**:
1. Tap display name input
2. Change text to "Test Updated Name"
3. Tap bio textarea
4. Add text to bio
5. Tap "Save Changes"
6. Verify success alert appears
7. Verify navigation returns to Profile screen

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 2.13 | Input focus shows no border (remains filled style) | ☐ | |
| 2.14 | Save button shows loading indicator while saving | ☐ | |
| 2.15 | Success alert appears after save | ☐ | |
| 2.16 | Updated name appears on Profile screen | ☐ | |

**Screenshot**: Attach screenshot showing filled inputs with icons

---

## TEST CASE 3: Public Seller Profile Screen (SellerProfileScreen.tsx)

**Steps**:
1. Navigate to an item listing
2. Tap "View Seller Profile" (if available)
3. Wait for seller profile to load

**Expected Results**:

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 3.1 | Avatar is 96×96px circle | ☐ | |
| 3.2 | `ShieldCheck` icon (16px, `#5DBB8E`) appears for verified sellers | ☐ | |
| 3.3 | Location row shows `MapPin` icon (14px, `#6B6B6B`) | ☐ | |
| 3.4 | Star ratings use `Star` Phosphor icon | ☐ | |
| 3.5 | Filled stars are `#F59E0B` fill | ☐ | |
| 3.6 | Empty stars are `#E0E0E0` outline | ☐ | |
| 3.7 | Rating number is 16px semibold, `#1A1A1A` | ☐ | |
| 3.8 | Review count is 14px, `#6B6B6B` | ☐ | |
| 3.9 | "Follow" button is green filled pill: `#5DBB8E`, borderRadius 22, height 44 | ☐ | |
| 3.10 | `UserPlus` icon (16px, white) appears in Follow button | ☐ | |

**Interaction Test - Follow/Unfollow**:
1. Tap "Follow" button
2. Verify button changes to "Following" state

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 3.11 | "Following" button is secondary outlined (border `#5DBB8E`, white bg) | ☐ | |
| 3.12 | `Check` icon (16px, `#5DBB8E`) appears in Following button | ☐ | |
| 3.13 | Text color is `#5DBB8E` in Following state | ☐ | |

2. Tap "Following" button again
3. Verify it returns to "Follow" state

**Screenshot**: Attach screenshot showing ratings and Follow button

---

## TEST CASE 4: Badges Screen (BadgesScreen.tsx)

**Steps**:
1. From Profile screen, tap "Badges" navigation (if available in bottom nav or profile)
2. Wait for badges to load

**Expected Results**:

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 4.1 | Heading "Badges" is 24px, fontWeight 600 | ☐ | |
| 4.2 | Badge grid has 3 columns, 12px gap | ☐ | |
| 4.3 | Earned badge cells have `#FFF9EC` background | ☐ | |
| 4.4 | Earned badges show `Medal` icon (28px, `#F59E0B`) | ☐ | |
| 4.5 | Earned badge labels are 13px, fontWeight 600, `#1A1A1A` | ☐ | |
| 4.6 | Locked badge cells have `#F7F7F7` background | ☐ | |
| 4.7 | Locked badges show `Medal` icon (28px, `#CCCCCC`) | ☐ | |
| 4.8 | Locked badge labels are 13px, `#999999` | ☐ | |
| 4.9 | Locked badge cells have 60% opacity | ☐ | |
| 4.10 | All badge cells have 12px borderRadius | ☐ | |

**Interaction Test - Earned Badge Modal**:
1. Tap an earned badge
2. Verify modal opens

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 4.11 | Modal has bottom sheet style (16px top radius, white background) | ☐ | |
| 4.12 | Badge name is 18px semibold, centered | ☐ | |
| 4.13 | Badge description is 14px, `#6B6B6B`, centered | ☐ | |
| 4.14 | Unlock date is 12px, `#999999`, centered | ☐ | |
| 4.15 | NO `Lock` icon appears in earned badge modal | ☐ | |

3. Close modal

**Interaction Test - Locked Badge Modal**:
1. Tap a locked badge
2. Verify modal opens

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 4.16 | Modal has bottom sheet style | ☐ | |
| 4.17 | `Lock` icon (24px, `#CCCCCC`) appears at top | ☐ | |
| 4.18 | Unlock criteria is 14px, `#6B6B6B`, centered | ☐ | |

3. Close modal

**Screenshot**: Attach screenshot showing badge grid with earned and locked badges

---

## TEST CASE 5: Cross-Screen Navigation

**Steps**:
1. Navigate: Profile → Edit Profile → Save → Profile
2. Navigate: Profile → Badges → Profile
3. Navigate: Item → Seller Profile → Profile

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 5.1 | Back navigation works correctly on all screens | ☐ | |
| 5.2 | Bottom nav "Profile" tab navigates to My Profile | ☐ | |
| 5.3 | No navigation errors or crashes | ☐ | |

---

## TEST CASE 6: Loading & Error States

**Steps**:
1. Force profile loading state (slow network or disconnect)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 6.1 | Loading indicator is `#5DBB8E` (green), not blue | ☐ | |
| 6.2 | Loading text is 16px, `#6B6B6B` | ☐ | |

2. Force error state (invalid user ID or network error)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 6.3 | Error text is `#E85D75` (red) | ☐ | |
| 6.4 | Retry button is green pill (`#5DBB8E`) | ☐ | |

---

## SUMMARY

**Total Test Cases**: 6  
**Passed**: _____  
**Failed**: _____  
**Blocked**: _____

**Critical Issues Found**:
_________________________________________________________________________
_________________________________________________________________________

**Visual/UX Feedback**:
_________________________________________________________________________
_________________________________________________________________________

**Tester Signature**: _________________ **Date**: _________________
