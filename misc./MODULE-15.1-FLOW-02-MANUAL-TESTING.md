# MODULE 15.1 FLOW-02: Profiles & Onboarding — Manual Testing Guide

**Task:** FLOW-02 Profiles & Onboarding Redesign  
**Screens:** 5 total (Welcome, ProfileCompletion, FeatureHighlights, Onboarding, ProfileSetup)  
**Platform:** iOS Simulator + Android Emulator  
**Estimated Time:** 30 minutes

---

## Prerequisites

1. **Start Expo:**
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
   npm start
   ```

2. **Open Simulators:**
   - iOS: Press `i` in Expo terminal
   - Android: Press `a` in Expo terminal

3. **Test User Accounts:**
   - Create a fresh account for onboarding flow testing
  - Use production Supabase environment

---

## Test Cases

### TC-001: WelcomeScreen Visual Design
**Objective:** Verify WelcomeScreen matches design system  
**Priority:** P0

**Steps:**
1. Complete signup and phone verification
2. Navigate automatically to WelcomeScreen

**Expected Results:**
- ✅ White background (`#FFFFFF`)
- ✅ Headline "Welcome to P2P Kids Marketplace" is 28px, semibold (`fontWeight: '600'`), `#1A1A1A`, centered
- ✅ Description text is 16px, `#6B6B6B`, centered
- ✅ "Get Started" button is green pill:
  - Background: `#5DBB8E`
  - Height: 52px
  - Border radius: 26px (pill shape)
  - Text: white (#FFFFFF), 16px, fontWeight '600'

**Screenshot Location:** `test-screenshots/tc-001-welcome-screen-{ios|android}.png`

---

### TC-002: ProfileCompletionScreen — Avatar Upload
**Objective:** Verify avatar upload UI with Phosphor Camera icon  
**Priority:** P0

**Steps:**
1. From WelcomeScreen, tap "Get Started" (skip may navigate elsewhere depending on nav flow)
2. If ProfileCompletionScreen appears, verify avatar section

**Expected Results:**
- ✅ Circular avatar placeholder: 120px diameter, `#F0F0F0` background
- ✅ Phosphor Camera icon centered (40px, `#6B6B6B`, weight regular)
- ✅ Tapping avatar opens image picker
- ✅ After selecting image, avatar displays in circular frame

**Screenshot Location:** `test-screenshots/tc-002-profile-avatar-{ios|android}.png`

---

### TC-003: ProfileCompletionScreen — Filled Input Style
**Objective:** Verify input fields use new filled style with Phosphor icons  
**Priority:** P0

**Steps:**
1. On ProfileCompletionScreen, focus on "Display Name" input
2. Focus on "Bio" input

**Expected Results:**
- ✅ Label "DISPLAY NAME" is 13px, uppercase, `#6B6B6B`, fontWeight '500'
- ✅ Input wrapper:
  - Background: `#F0F0F0`
  - Border radius: 12px
  - Height: 52px
  - NO border (`borderWidth` should be 0 or undefined)
- ✅ Phosphor User icon left (20px, `#6B6B6B`)
- ✅ Text input placeholder is `#999999`
- ✅ Bio input is 120px height with same filled style

**Screenshot Location:** `test-screenshots/tc-003-profile-inputs-{ios|android}.png`

---

### TC-004: FeatureHighlightsScreen — 4 Slides with Illustrations
**Objective:** Verify carousel has exactly 4 slides with proper pagination  
**Priority:** P0

**Steps:**
1. Navigate to FeatureHighlightsScreen (may require completing profile first)
2. Swipe through all 4 slides
3. Verify pagination dots update
4. Verify last slide shows different button

**Expected Results:**
- ✅ Exactly 4 slides render
- ✅ Each slide has:
  - Emoji or illustration (100px)
  - Title: 24px, fontWeight '600', `#1A1A1A`
  - Description: 16px, `#6B6B6B`
- ✅ Pagination dots below each slide:
  - Active dot: `#5DBB8E`, 8px circle
  - Inactive dots: `#E0E0E0`, 8px circles
- ✅ Slides 1-3 show "Next" button with CaretRight icon
- ✅ Slide 4 shows "Get Started" button (no icon)
- ✅ Both buttons are green pills (52px, borderRadius 26)

**Screenshot Location:** `test-screenshots/tc-004-features-carousel-{ios|android}.png`

---

### TC-005: FeatureHighlightsScreen — Next Button with CaretRight Icon
**Objective:** Verify Next button has Phosphor CaretRight icon  
**Priority:** P1

**Steps:**
1. On FeatureHighlightsScreen slide 1
2. Inspect "Next" button

**Expected Results:**
- ✅ Button displays "Next" text + CaretRight icon (20px, white)
- ✅ Icon is on the right side of text
- ✅ Button is green pill (`#5DBB8E`, 52px, borderRadius 26)
- ✅ Tapping Next navigates to slide 2

**Screenshot Location:** `test-screenshots/tc-005-next-button-{ios|android}.png`

---

### TC-006: OnboardingCarousel — Green Pagination Dots
**Objective:** Verify OnboardingCarousel uses green active dots  
**Priority:** P1

**Steps:**
1. Navigate to OnboardingScreen (5-slide carousel)
2. Swipe through slides
3. Verify active dot color

**Expected Results:**
- ✅ Active dot: `#5DBB8E` (green), elongated (24px width)
- ✅ Inactive dots: `#E0E0E0` (gray), 8px circles
- ✅ "Get Started" button on last slide is green pill (52px, borderRadius 26)
- ✅ "Skip" button is visible on all slides (16px, fontWeight '600', `#6B6B6B`)

**Screenshot Location:** `test-screenshots/tc-006-onboarding-carousel-{ios|android}.png`

---

### TC-007: ProfileSetupScreen — Filled Inputs with Icons
**Objective:** Verify ProfileSetupScreen uses filled input style + Phosphor icons  
**Priority:** P0

**Steps:**
1. Navigate to ProfileSetupScreen
2. Inspect all input fields

**Expected Results:**
- ✅ Avatar section: circular 120px, Camera icon (40px, `#6B6B6B`)
- ✅ Display Name input:
  - Label "DISPLAY NAME" (13px, uppercase, `#6B6B6B`)
  - Input wrapper: `#F0F0F0`, borderRadius 12, height 52, NO border
  - User icon left (20px, `#6B6B6B`)
- ✅ Zip Code input:
  - Label "ZIP CODE"
  - MapPin icon left (20px, `#6B6B6B`)
  - Input wrapper: same filled style
- ✅ Bio input:
  - Label "BIO (OPTIONAL)"
  - Filled style, 120px height, multiline
- ✅ "Complete Setup" button: green pill (52px, borderRadius 26)

**Screenshot Location:** `test-screenshots/tc-007-profile-setup-{ios|android}.png`

---

### TC-008: End-to-End Onboarding Flow
**Objective:** Complete full onboarding flow from signup to dashboard  
**Priority:** P0

**Steps:**
1. Create new account (signup)
2. Verify phone
3. Complete profile (ProfileCompletionScreen or ProfileSetupScreen depending on nav)
4. View FeatureHighlightsScreen
5. Complete OnboardingScreen
6. Arrive at dashboard/home

**Expected Results:**
- ✅ All screens display correct green design system
- ✅ No navigation errors
- ✅ User is marked `onboarding_completed: true` in database
- ✅ Dashboard shows correct user profile

**Screenshot Location:** `test-screenshots/tc-008-e2e-onboarding-{ios|android}.png`

---

### TC-009: Button Disabled States
**Objective:** Verify loading/disabled states use correct styling  
**Priority:** P1

**Steps:**
1. On any screen with a primary button, trigger loading state
2. Verify button appearance during loading

**Expected Results:**
- ✅ Button shows ActivityIndicator (white)
- ✅ Button is disabled (`disabled={true}`)
- ✅ Button retains green background (may have reduced opacity)

---

### TC-010: Error States (ProfileSetupScreen)
**Objective:** Verify error styling matches design system  
**Priority:** P1

**Steps:**
1. On ProfileSetupScreen, leave required fields empty
2. Tap "Complete Setup"
3. Verify error messages

**Expected Results:**
- ✅ Error text: `#E85D75` (design system error color)
- ✅ Input with error has red border: `borderWidth: 1`, `borderColor: '#E85D75'`
- ✅ Error text appears below input (14px, fontWeight regular)

---

## Acceptance Criteria Summary

| Screen | Criteria | Status |
|--------|----------|--------|
| WelcomeScreen | Headline 28px semibold, green pill button | ☐ |
| ProfileCompletionScreen | Circular avatar (120px), Camera icon, filled inputs | ☐ |
| FeatureHighlightsScreen | 4 slides, pagination dots (green active), CaretRight icon | ☐ |
| OnboardingCarousel | Green active dots (elongated 24px), green Get Started button | ☐ |
| ProfileSetupScreen | Filled inputs, User/Camera/MapPin icons, green pill button | ☐ |

---

## Test Completion Checklist

- [ ] All test cases executed on iOS Simulator
- [ ] All test cases executed on Android Emulator
- [ ] Screenshots captured for all test cases
- [ ] Any bugs logged in GitHub Issues with `MODULE-15.1` label
- [ ] Verification items in `MODULE-15.1-VERIFICATION.md` updated

---

## Bug Reporting Template

If you find issues, create a GitHub issue with:

**Title:** `[MODULE-15.1 FLOW-02] <Brief Description>`

**Body:**
```markdown
**Test Case:** TC-XXX  
**Platform:** iOS 17.5 Simulator / Android Emulator API 34  
**Expected:** <Expected behavior from TC>  
**Actual:** <What actually happened>  
**Screenshots:** Attach screenshots  
**Steps to Reproduce:**
1. ...
2. ...
```

---

## Notes

- All tests use **production Supabase** (not local)
- Phosphor icons package is already installed (`phosphor-react-native@3.0.6`)
- Design system colors are defined in each screen's StyleSheet (no global theme file yet)
- Manual tests complement Maestro UI automation (see `.maestro/module-15.1-flow-02-onboarding.yaml`)
