# MODULE-15.1 FLOW-21 — ID Verification Screen: Manual Testing Guide

**Task:** FLOW-21 — ID Verification Upload Screen UI Redesign  
**Module:** MODULE-15.1-UI-REDESIGN  
**Screen:** `p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx`  
**Date completed:** 2026-05-23  

---

## Prerequisites

- iOS Simulator or Android Emulator running with the Expo dev server  
- Supabase project configured and reachable  
- At least one test user account (free tier)  
- `npm run typecheck` and `npm run lint` must both pass before running these tests

Navigate to the screen via:  
**Profile tab → "Verify Identity"** (or equivalent Profile screen entry point)

---

## Test Suites

### Suite 1 — State A: Unverified / No submission yet

#### TC-001: IdentificationCard icon renders (not emoji, not Ionicons)
1. Log in as a user with no prior ID submission.  
2. Open ID Verification screen.  
3. Confirm the icon at the top is a Phosphor `IdentificationCard` (card outline, 64×64px, `#6B6B6B` grey).  
**Expected:** Grey card icon visible, no emoji, no Ionicons glyph.

#### TC-002: "Verify Your Identity" heading visible
1. Same screen as TC-001.  
2. Confirm "Verify Your Identity" heading is shown below the icon.  
**Expected:** Heading text present, readable.

#### TC-003: Dashed upload area is present and tappable
1. On the unverified state screen.  
2. Confirm a dashed bordered area with text "Tap to choose a photo" (or similar) is visible.  
3. Tap it — iOS photo permission dialog appears.  
**Expected:** Upload area is visible; tapping triggers permission/picker.

#### TC-004: "Take Photo" (Camera) button is present
1. Below the upload area confirm a green "Take Photo" button exists with a camera icon.  
**Expected:** Camera icon (`#5DBB8E` green), "Take Photo" label visible.

#### TC-005: Submit button is grey/disabled before image selection
1. Before selecting any image confirm the submit button colour is `#E0E0E0` (grey).  
2. Confirm tapping it does nothing.  
**Expected:** Grey submit button, no action on tap.

#### TC-006: Submit button turns green after image selection
1. Tap the upload area and select an image from the photo library.  
2. Confirm a preview of the selected image appears.  
3. Confirm the submit button turns `#5DBB8E` green.  
**Expected:** Image preview shown, submit button active (green).

#### TC-007: "Change image" link is shown after image selection
1. After selecting an image (TC-006).  
2. Confirm a "Change" or "Change image" button/link is visible below the preview.  
**Expected:** Change link visible; tapping it re-opens the picker.

#### TC-008: Disclaimer text from DB is shown
1. On the unverified state screen.  
2. Locate the disclaimer text near the bottom (usually below the submit button).  
**Expected:** Disclaimer text loaded from the database is visible (not a hardcoded fallback, unless DB returns the fallback value).

---

### Suite 2 — State B: Pending Review

#### TC-009: Clock icon renders (Phosphor, amber/gold)
1. Log in as a user who has already submitted and is awaiting review.  
   OR: submit a photo (TC-006) and proceed to verify the pending state.  
2. Confirm the `Clock` icon (64px, `#F59E0B` amber) is shown.  
**Expected:** Amber clock icon visible.

#### TC-010: "Verification Pending" heading visible
1. On the pending state screen.  
2. Confirm "Verification Pending" heading is shown.  
**Expected:** Correct heading text.

#### TC-011: Gold "Under Review" status pill
1. On the pending state screen.  
2. Confirm a pill/badge with text "Under Review" appears in a gold/amber background (`#FEF3C7`).  
**Expected:** Gold pill with "Under Review" text.

#### TC-012: 24–48 hour review subtext is shown
1. On the pending state screen.  
2. Confirm a message mentioning "24–48 hours" is visible below the heading.  
**Expected:** Subtext with review time estimate visible.

#### TC-013: Upload area is NOT shown in pending state
1. On the pending state screen.  
2. Confirm there is no photo upload area or submit button.  
**Expected:** No upload dashed box, no submit button.

#### TC-014: "Back to Profile" button calls navigation back
1. On the pending state screen.  
2. Tap "Back to Profile" button.  
**Expected:** Navigates back to the Profile screen.

---

### Suite 3 — State C: Verified / Approved

#### TC-015: CheckCircle icon renders (Phosphor, green)
1. Log in as a user whose ID has been approved (set `status = 'approved'` in DB, or use a test user).  
2. Confirm the `CheckCircle` icon (64px, `#5DBB8E` green) is shown.  
**Expected:** Green checkmark circle icon visible.

#### TC-016: "Identity Verified" heading in green
1. On the verified state screen.  
2. Confirm "Identity Verified" heading is shown in `#5DBB8E` green text.  
**Expected:** Green heading text.

#### TC-017: Green "Verified ✓" status pill
1. On the verified state screen.  
2. Confirm a pill with "Verified ✓" text on a light green background (`#E8F5F0`) is shown.  
**Expected:** Green pill with "Verified ✓" label.

#### TC-018: Upload area and submit button NOT shown when verified
1. On the verified state screen.  
2. Confirm no upload dashed box and no submit button are visible.  
**Expected:** Clean verified state — no upload controls.

---

### Suite 4 — State A (Rejected): Re-submission allowed

#### TC-019: Rejected user sees the unverified upload form again
1. Log in as a user whose ID submission was rejected (set `status = 'rejected'` in DB).  
2. Confirm the upload form (State A) is shown — not a "rejected" dead-end.  
**Expected:** Upload area, submit button, IdentificationCard icon — same as State A.

---

### Suite 5 — Back navigation

#### TC-020: Back arrow in the header calls goBack
1. On any state of the screen.  
2. Tap the `←` (ArrowLeft) icon in the header.  
**Expected:** Navigates back to the previous screen (Profile screen).

---

### Suite 6 — Design system compliance

#### TC-021: Zero Ionicons / MaterialIcons imports
1. Verify there are no Ionicons or MaterialIcons icon glyphs on any screen state.  
2. All icons should use Phosphor (`phosphor-react-native`).  
**Expected:** Only Phosphor icons visible.

#### TC-022: No emoji icons used
1. Verify there are no emoji (📷, ✅, ⏳, etc.) used as icons.  
**Expected:** All icons are Phosphor components.

---

## Automated Test Coverage

| Test Type | File | Count |
|---|---|---|
| Unit | `src/screens/profile/__tests__/IDVerificationUploadScreen.test.tsx` | 21 tests |
| Integration | `e2e/IDVerification.integration.test.ts` | 4 tests (RUN_SUPABASE_E2E=true) |
| Maestro E2E | `.maestro/module-15.1-flow-21-id-verification.yaml` | 7 scenarios |

Run unit tests:
```bash
cd p2p-kids-marketplace && npm run test:unit -- --testPathPattern=IDVerificationUploadScreen
```

Expected: **21 passed, 0 failed**

---

## Tier 0 Preflight (run before simulator testing)

```bash
cd p2p-kids-marketplace && npm run typecheck
cd p2p-kids-marketplace && npx eslint src/screens/profile/IDVerificationUploadScreen.tsx
```

Both must exit 0.

---

## Verification Checklist (D-033)

- [x] Unverified state: `IdentificationCard` (64px, `#6B6B6B`), dashed upload area
- [x] Submit button: `#5DBB8E` when file selected, `#E0E0E0` when not
- [x] Pending state: `Clock` (64px, `#F59E0B`), gold status pill "Under Review"
- [x] Verified state: `CheckCircle` (64px, `#5DBB8E`), green heading + "Verified ✓" pill
- [x] Rejected state: shows unverified form (re-submission allowed)
- [x] Zero Ionicons/MaterialIcons imports
- [x] `testID` props on all interactive elements
- [x] Unit tests: 21/21 pass
- [x] Integration test file present (RUN_SUPABASE_E2E guard)
- [x] Maestro YAML present
- [x] `docs/flow-registry.md` updated
