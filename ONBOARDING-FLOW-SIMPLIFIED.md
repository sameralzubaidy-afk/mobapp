# Onboarding Flow Simplified ✅

**Date:** December 17, 2025  
**Change:** Removed ZIP code entry screen, unified free + trial flows

---

## Changes Made

### 1. WelcomeScreen.tsx
**Before:** Navigated to `LocationPicker` (ZIP code entry)
```tsx
onPress={() => (navigation as any).navigate('LocationPicker', { userId })}
```

**After:** Navigates to `FeatureHighlights` (app wizard)
```tsx
onPress={() => (navigation as any).navigate('FeatureHighlights', { userId })}
```

### 2. FeatureHighlightsScreen.tsx
**Updated:** Added comment clarifying direct dashboard navigation
- User already entered ZIP during signup (ProfileSetupScreen)
- Node assignment happened during signup
- FeatureHighlights is just the app wizard
- After wizard, `refreshSession()` triggers dashboard load

---

## New Onboarding Flow (Both Free & Trial)

```
Signup
  ↓
PhoneVerification
  ↓
ProfileSetupScreen ← ZIP CODE COLLECTED HERE (NODE-003)
  ↓
SubscriptionChoiceScreen
  │
  ├─ Free Path
  │   ↓
  │   Mark profile_completed = true
  │   ↓
  └─ Trial Path
      ↓
      Enroll in trial subscription
      ↓
      Mark profile_completed = true
      ↓
  ┌────────────────────────┐
  └─ Both paths merge here
      ↓
Welcome ("Let's get started")
  ↓
FeatureHighlights (App wizard - 4 feature slides)
  ↓
refreshSession() triggered
  ↓
RootNavigator switches to authenticated stack
  ↓
🎉 Home (Dashboard)
```

---

## What Was Removed

**LocationPickerScreen** is NO LONGER part of the signup flow
- ❌ ZIP code entry here removed
- ✅ ZIP code is now collected during ProfileSetupScreen
- ✅ Node assignment happens during ProfileSetupScreen (NODE-003)
- ✅ LocationPickerScreen still exists but not used (can be deleted later or kept for admin management)

---

## Why This Change

1. **Avoid duplicate ZIP entry**
   - User already entered ZIP in ProfileSetupScreen
   - No need to ask again

2. **Simpler flow**
   - Remove: LocationPicker → NodeSelection → ProfileCompletion
   - Keep: Welcome → FeatureHighlights

3. **Unified experience**
   - Free and Trial users see the same wizard
   - Both end up on the same dashboard

---

## Testing

### Test Free Tier
```bash
npx expo start --clear
```

1. Signup with new email
2. Verify phone
3. Enter ZIP (e.g., 06830 for Greenwich)
4. Select subscription tier
5. **Click "Choose Free"**
6. See Welcome screen
7. See FeatureHighlights (4 slides)
8. **Click "Get Started"** on last slide
9. Land on Dashboard ✅

**Console should show:**
```
[ONBOARDING] Marked onboarding as complete
✅ User navigated to Dashboard
```

---

### Test Trial/Kids Club+
```bash
npx expo start --clear
```

1-4. Same as above
5. **Click "Start Free Trial"**
6. See trial enrollment alert
7. Click "Get Started"
8. See Welcome screen
9. See FeatureHighlights (4 slides)
10. **Click "Get Started"**
11. Land on Dashboard ✅

**Console should show:**
```
[ONBOARDING] Marked onboarding as complete
✅ User navigated to Dashboard
```

---

## Summary

| Step | Before | After | Status |
|------|--------|-------|--------|
| Signup | ZIP entry | ZIP entry | ✅ No change |
| Phone Verify | Phone code | Phone code | ✅ No change |
| Profile Setup | ZIP in ProfileSetup | ZIP in ProfileSetup | ✅ Node assignment here (NODE-003) |
| Subscription | Choose plan | Choose plan | ✅ No change |
| Wizard | LocationPicker → NodeSelection | Welcome → FeatureHighlights | ✅ Simplified |
| Dashboard | After NodeSelection | After FeatureHighlights | ✅ Cleaner |

**Result:** Both free and trial users follow the same, simpler path to the dashboard! 🎉

