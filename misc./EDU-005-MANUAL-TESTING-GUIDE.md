# MODULE-18 EDU-005: HelpScreen Manual Testing Guide

## Pre-requisites

✅ **Database Setup Required**: Before testing, run this SQL in Supabase SQL Editor:

```sql
-- Ensure education_sections table has published content
SELECT section_type, title, is_published FROM education_sections WHERE is_published = true ORDER BY display_order;
-- Expected: At least 4 rows (sp_definition, sp_earning, sp_spending, safety)

-- Ensure at least one bonus category exists
SELECT id, name, sp_earning_multiplier FROM categories WHERE sp_earning_multiplier > 1.10 AND is_active = true;
-- Expected: At least 1 row (e.g., LEGO Sets with 1.30×)

-- If rows are missing, run the seed migration:
-- supabase/migrations/20260420000020_create_education_analytics_and_seed.sql
```

✅ **App Requirements**:
- iOS Simulator (iPhone 14 or later) OR Android Emulator (API 30+)
- User authenticated (any tier - Free or Kids Club+)
- Network connection active

---

## Test Case 1: Navigate to Help Screen from Settings

**Objective**: Verify route is reachable from Settings menu

### Steps:
1. Launch app in iOS Simulator or Android Emulator
2. Navigate to **Profile** tab (bottom navigation)
3. Tap **Settings** gear icon (top-right or menu)
4. Scroll down to **Help → How Trading Works** row
5. Tap the row

### Expected Results:
- ✅ Help screen loads within 1 second
- ✅ Screen title shows "How Trading Works"
- ✅ Back button visible in top-left
- ✅ Intro text visible: "Learn how to trade safely and earn Swap Points..."

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 2: Accordion - SP Definition Expanded by Default

**Objective**: Verify sp_definition section is expanded on initial load

### Steps:
1. From Help screen (Test Case 1)
2. Observe the sections list

### Expected Results:
- ✅ **"What are Swap Points?"** section header is visible
- ✅ Section body text is visible (not collapsed)
- ✅ Other sections (e.g., "How do I earn SP?", "How do I spend SP?") are **collapsed** (body text not visible)
- ✅ Chevron icon points **down** for expanded section, **right** for collapsed sections

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 3: Accordion - Expand/Collapse Interaction

**Objective**: Verify tap header toggles section expansion

### Steps:
1. Tap **"How do I earn SP?"** header (currently collapsed)
2. Observe animation
3. Tap the same header again

### Expected Results:
- ✅ **After first tap**: Section expands with smooth animation; body text becomes visible; chevron rotates down
- ✅ **After second tap**: Section collapses; body text hidden; chevron rotates back
- ✅ Accessibility: VoiceOver/TalkBack announces "Expanded" and "Collapsed" state

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 4: SP Calculator - Sell Mode Calculation

**Objective**: Verify calculator computes SP earnings correctly

### Steps:
1. Scroll down to **"Try the SP Calculator"** section
2. Tap **Category** picker → Select **"LEGO Sets"** (or any available category)
3. Tap **Item Price** field → Enter `25.00`
4. Tap **Calculate** button
5. Observe result

### Expected Results:
- ✅ Result box appears (light blue background)
- ✅ Shows **"You'll earn: XX SP"** (e.g., 33 SP for LEGO @ 1.30× multiplier)
- ✅ If bonus category (>1.10×): Shows **⭐ emoji** next to SP value
- ✅ Shows bonus text: **"Bonus category! Earns 1.30× SP"**
- ✅ No "Calculate" button in result area

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 5: SP Calculator - Price Bucket Analytics

**Objective**: Verify analytics event fires with correct price bucket

### Steps:
1. From Test Case 4 state (calculator result visible)
2. Check console logs (Metro bundler terminal or Xcode console)
3. Search for `[educationAnalyticsService]` or `calculator_use`

### Expected Results:
- ✅ Console shows: `Tracked: calculator_use { mode: 'sell', category_id: '...', item_price_bucket: '10-50' }`
- ✅ Price bucket matches input: `<10`, `10-50`, `50-100`, `>100`

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 6: Bonus Categories List

**Objective**: Verify bonus categories display correctly

### Steps:
1. Scroll down below calculator to **"Bonus Categories"** section
2. Observe the list

### Expected Results:
- ✅ Section title: **"Bonus Categories"**
- ✅ Subtitle: **"These categories earn extra Swap Points when you sell items!"**
- ✅ At least 1 category row visible (if bonus categories exist in DB)
- ✅ Each row shows: Icon (emoji) + Name + ⭐/🏆 Badge + **"Earn X.XX× SP"** text
- ✅ Categories sorted by multiplier **descending** (highest first)
- ✅ If no bonus categories: Shows **"No bonus categories available at this time."**

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 7: Deep Link to Specific Section

**Objective**: Verify `?section=sp_spending` query param auto-expands section

### Steps:
1. Open Help screen with deep link parameter:
   - **iOS**: Use URL scheme: `p2pkidsmarketplace://help?section=sp_spending`
   - **Android**: Use intent with `section=sp_spending` extra
   - **Or manually**: From Settings, tap Help, then in code simulate: `navigation.navigate('Help', { section: 'sp_spending' })`

### Expected Results:
- ✅ Help screen loads
- ✅ **"How do I spend SP?"** section is **expanded** (not collapsed)
- ✅ Screen auto-scrolls to that section (section visible near top)
- ✅ Other sections remain collapsed

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 8: Pull-to-Refresh

**Objective**: Verify pull-to-refresh invalidates cache and reloads content

### Steps:
1. From Help screen (any state)
2. Scroll to top
3. Pull down on the screen (drag finger down from top)
4. Observe loading spinner
5. Release
6. Observe content

### Expected Results:
- ✅ Loading spinner appears during refresh
- ✅ Sections reload (API called again - check Network tab or console logs)
- ✅ Content remains visible after refresh
- ✅ No errors displayed

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 9: Analytics - help_view Event

**Objective**: Verify help_view event fires once on mount

### Steps:
1. **Clear app state** (kill app, relaunch)
2. Navigate to Help screen (Test Case 1 steps)
3. Check console logs immediately

### Expected Results:
- ✅ Console shows: `Tracked: help_view {}`
- ✅ Event fires **only once** per mount (not on every render)
- ✅ Event fires before user interacts with screen

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 10: Analytics - section_expand Event

**Objective**: Verify section_expand event fires on each expand

### Steps:
1. From Help screen
2. Tap **"How do I earn SP?"** header (collapsed → expanded)
3. Check console logs

### Expected Results:
- ✅ Console shows: `Tracked: section_expand { section_type: 'sp_earning' }`
- ✅ Event fires **only on expand**, not on collapse
- ✅ Event includes correct `section_type` value

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 11: Accessibility - Screen Reader

**Objective**: Verify VoiceOver (iOS) / TalkBack (Android) support

### Steps:
1. Enable VoiceOver (iOS: Settings > Accessibility > VoiceOver) or TalkBack (Android)
2. Navigate to Help screen
3. Swipe through elements

### Expected Results:
- ✅ Header reads: **"How Trading Works"**
- ✅ Accordion header reads: **"[Title]. Expanded/Collapsed. Tap to expand/collapse."**
- ✅ Calculator price field reads: **"Item price in dollars"**
- ✅ Calculator category picker reads: **"Category"**
- ✅ Bonus badge reads: **"Bonus category badge"**
- ✅ Result updates announce via `accessibilityLiveRegion`

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Test Case 12: Error Handling - Network Failure

**Objective**: Verify graceful error handling when API fails

### Steps:
1. **Disable network** (Airplane mode OR pause Supabase backend)
2. Navigate to Help screen from Settings

### Expected Results:
- ✅ Alert appears: **"Error: Failed to load help content. Please try again."**
- ✅ Screen does not crash
- ✅ Retry: Enable network → Pull-to-refresh → Content loads successfully

### Actual Results:
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## Summary Checklist

| Test Case | iOS Simulator | Android Emulator | Notes |
|-----------|---------------|------------------|-------|
| TC-1: Navigate to Help | ⬜ | ⬜ | |
| TC-2: Default Expansion | ⬜ | ⬜ | |
| TC-3: Expand/Collapse | ⬜ | ⬜ | |
| TC-4: Calculator Sell | ⬜ | ⬜ | |
| TC-5: Price Bucket | ⬜ | ⬜ | |
| TC-6: Bonus Categories | ⬜ | ⬜ | |
| TC-7: Deep Link | ⬜ | ⬜ | |
| TC-8: Pull-to-Refresh | ⬜ | ⬜ | |
| TC-9: help_view Event | ⬜ | ⬜ | |
| TC-10: section_expand Event | ⬜ | ⬜ | |
| TC-11: Accessibility | ⬜ | ⬜ | |
| TC-12: Network Error | ⬜ | ⬜ | |

---

## Issues Found

| Issue # | Test Case | Description | Severity | Status |
|---------|-----------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## Test Execution Sign-off

**Tested By**: _________________  
**Date**: _________________  
**iOS Simulator Version**: _________________  
**Android Emulator Version**: _________________  
**Build Version**: _________________  

**Overall Result**: ⬜ PASS  ⬜ FAIL (with issues)

**Notes**:
