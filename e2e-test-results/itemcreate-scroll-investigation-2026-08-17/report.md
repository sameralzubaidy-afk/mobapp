# ItemCreate Screen "Scroll Blocker" — Investigation & Resolution

**Date:** 2026-08-17 · **Device:** iPhone 17 Pro Max Simulator (iOS 26.1) · **Mode:** Kids P2P App Builder (dev task)

## Verdict (headline)

**NOT a real UX bug. The "0 pixel movement on swipe" is a flow-sequencing / automation-tooling gap.** Group J/K testing CAN proceed with a standard swipe approach once a photo exists — and a new `__DEV__`-only fixture now makes that photo reachable without the native picker.

## 1. Investigation — scroll container

| Check | Result |
|---|---|
| Outer container | Standard `ScrollView` (`style={flex:1}`, `contentContainerStyle={{padding:16}}`) in `ItemCreateScreen.tsx` (~L895) |
| Wrapper | `ScreenLayout` = `SafeAreaView` + `AppHeader` only — no `KeyboardAvoidingView`, no `PanResponder`, no gesture-handler `GestureDetector`, no horizontal `ScrollView` |
| Nested list | `PhotoUploadManager` uses `FlatList` with `scrollEnabled={false}` (`numColumns={3}`) — correct nested pattern, does NOT intercept vertical swipes |
| `scrollEnabled` | Not set → defaults `true` on the outer `ScrollView` |
| Evidence | `scrollViewRef.current.scrollTo({y})` is already used by `handlePriceAdjustmentUpdate` → the codebase already relies on this ScrollView scrolling |

**No scroll defect exists.**

## 2. Root cause of the QA observation

`ItemCreateScreen` is a **photo-first** flow (LISTING-V3-005). The ENTIRE form — Title, Description, Category, Condition, Brand, Color, Age Group, Gender, Payment Preference, Price, SP Earnings, Publish — renders **only inside `{photos.length > 0 && (<>…</>)}`** (L926+).

When the QA agent reached "New Item" with **0 photos**, the only content was the `PhotoUploadManager` header + 3 empty 1:1 slots (~400pt), which fits inside the ~956pt viewport. **There was literally nothing to scroll** → 4 swipes producing 0 movement is *correct* behavior, not a defect.

The *real* automation blocker is: a photo must be added first, and adding a photo requires the **native image picker** (`expo-image-picker`), which mobile-mcp swipe/tap tooling cannot drive.

## 3. Accessibility exposure audit (below-fold elements)

- Already AX-exposed once rendered: `title-input`, `description-input`, `manual-price-input` (TextInputs), `ConditionSelector`/`ColorPicker`/`AgeGroupSelector`/`GenderSelector`/`SPEarningsPreview`/`BrandAutocompleteInput` (all have `accessibilityRole`/`label` + `testID`), `PublishButton` (`accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState`).
- **Fixed (BP-53 gap):** `category-select-button` was `testID`-only; added `accessible`, `accessibilityRole="button"`, `accessibilityLabel="Select category"`.
- Known remaining gaps (pre-existing, flagged in Phase 22): Sell Options Sheet options (`sell-option-list-one-item`/`sell-option-bulk-upload`) and `login-back-button` are `testID`-only. Not touched (out of scope for this task).

## 4. Fix applied (dev-only, no user-facing behavior change)

`p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx`:
1. **`Dev: Add Test Photo` button** — `__DEV__`-gated, `testID="dev-add-test-photo"`, `accessible`/`role`/`label`. Injects the bundled `assets/adaptive-icon.png` into `photos` + dispatches `PHOTOS_ADDED`. **Does NOT set `uploadedPhotoUrls`** → no AI analysis, no draft-save side effects (verified: no draft/DB rows created).
2. **`testID="item-create-scroll-view"`** on the outer `ScrollView` so automation can target it.
3. **`category-select-button` accessibility exposure** (above).

Test: added a unit test in `ItemCreateScreen.test.tsx` ("Dev Photo Fixture") asserting the form fields render after tapping the fixture.

## 5. On-device verification (with new code, live via Metro)

| Step | Result |
|---|---|
| Log in `test-buyer` → Sell → "List One Item" | Reached "New Item" |
| Pre-fixture state | Only PhotoUploadManager + `dev-add-test-photo`; `title-input` ABSENT (nothing to scroll) |
| Tap `dev-add-test-photo` | `(1/10 photos)` + Cover badge; full form renders |
| Swipe up (350pt, center) | **1,471,882 changed px** (pixel-diff) — screen scrolled |
| After swipe | `manual-price-input` (y≈1123), `publish-button` (y≈1316), brand/color/age/gender/sp-toggle all in AX tree — reachable |

Evidence: `evidence/` in this folder (`itemcreate-verify-0{4,5,6}-*.png`).

## 6. Tier 0 gate

- `yarn typecheck` — **PASS** (tsc --noEmit, 0 errors)
- `npx eslint src/screens/ItemCreateScreen.tsx src/screens/__tests__/ItemCreateScreen.test.tsx` — **0 errors** (only pre-existing `no-console` warnings)
- `yarn jest src/screens/__tests__/ItemCreateScreen.test.tsx` — **31/31 PASS** (incl. new fixture test)

## 7. Recommendation for Group J/K

Group J (Listing Creation, 15 cases) and Group K (Bulk Listing, 6 cases) can proceed. QA automation recipe:
Sell → Sell Options Sheet → tap "List One Item" (pixel-locate row; "Sell" title at ~pt y 643, option row ~700–760) → **tap `dev-add-test-photo`** → swipe up → fill title/category/condition/price → `publish-button`.
