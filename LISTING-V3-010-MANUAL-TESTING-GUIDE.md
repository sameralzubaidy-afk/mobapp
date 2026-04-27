# LISTING-V3-010 Manual Testing Guide

**Module:** MODULE-04-ITEM-LISTING-V3  
**Task:** LISTING-V3-010 Tests (Unit + Integration + Maestro)  
**Date Created:** 2026-04-27  
**Tester:** [Your Name]  
**Environment:** iOS Simulator / Android Emulator  

---

## Prerequisites

1. **Supabase Prod Environment**
   - All migrations applied (LISTING-V3-001 through LISTING-V3-007)
   - Test user account created with subscription (for SP features)
   - Edge Functions deployed:
     - `analyze-item-image`
     - `batch-analyze-items`

2. **Mobile App**
   - Latest build installed on iOS/Android simulator
   - Logged in as test user
   - Network connectivity confirmed

3. **Test Data**
   - Sample photos available in simulator gallery (minimum 10 photos)
   - Test categories active in database

---

## Test Cases

### TC-001: Unit Tests - Run All Service Tests

**Objective:** Verify all service unit tests pass  
**Priority:** P0  

**Steps:**
1. Navigate to `p2p-kids-marketplace/` directory
2. Run: `npm test -- --testPathPattern=services`
3. Observe output

**Expected Result:**
- All tests pass ✅
- Coverage for services ≥ 85%
- No timeout or crash errors

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-002: Unit Tests - Run All Hook Tests

**Objective:** Verify all hook unit tests pass  
**Priority:** P0  

**Steps:**
1. Navigate to `p2p-kids-marketplace/` directory
2. Run: `npm test -- --testPathPattern=hooks`
3. Observe output

**Expected Result:**
- All tests pass ✅
- useItemDraft: 30s auto-save, blur-flush, saveNow verified
- useAIAnalysis: idle→analyzing→ready transitions verified
- usePhotoGroups: caps enforcement verified

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-003: PgTAP Tests - item_drafts Triggers

**Objective:** Verify database triggers work correctly  
**Priority:** P0  

**⚠️ IMPORTANT:** You must run this SQL in Supabase prod dashboard, NOT locally.

**Steps:**
1. Open Supabase dashboard → SQL Editor
2. Run SQL from: `/supabase/tests/item_drafts.sql`
3. Observe test results

**Expected Result:**
- All 10 PgTAP tests pass ✅
- `updated_at` trigger updates timestamp on UPDATE
- Max-5 drafts trigger evicts oldest draft when 6th is inserted
- Trigger does not affect other sellers' drafts
- `expires_at` defaults to 7 days from now

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-004: Maestro Flow - Item Create Happy Path

**Objective:** Complete single-item listing creation end-to-end  
**Priority:** P0  

**Steps:**
1. Navigate to `.maestro/` directory
2. Run: `maestro test item-create-happy-path.yaml --env=PLATFORM=ios`
3. Observe flow execution on simulator

**Expected Result:**
- Flow completes without errors ✅
- Photo upload → AI analysis → form fill → publish succeeds
- Listing appears with status "available"
- All assertions pass

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-005: Maestro Flow - Bulk Listing Publish All

**Objective:** Bulk upload 8 photos → 4 items → publish all  
**Priority:** P0  

**Steps:**
1. Run: `maestro test bulk-listing-publish-all.yaml --env=PLATFORM=ios`
2. Observe bulk flow execution

**Expected Result:**
- 8 photos upload successfully ✅
- Auto-grouped into 8 items (1 photo each)
- Merged into 4 items (2 photos each) via multi-select
- Batch AI analysis completes for all 4
- All 4 items publish successfully
- Success message shows "4 items published"

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-006: Maestro Flow - Draft Resume

**Objective:** Draft persistence and resume after app relaunch  
**Priority:** P1  

**Steps:**
1. Run: `maestro test draft-resume.yaml --env=PLATFORM=ios`
2. Observe draft creation, exit, resume flow

**Expected Result:**
- Draft created with partial data (title + photo) ✅
- Draft auto-saves (30s debounce or blur trigger)
- App exit does not lose draft data
- Resume banner appears after relaunch
- Draft data (title, photo) restored correctly
- Listing published successfully after resuming
- Draft deleted after publish (banner does not reappear)

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-007: Maestro Flow - Category Other

**Objective:** Custom category request via "Other" option  
**Priority:** P1  

**Steps:**
1. Run: `maestro test category-other.yaml --env=PLATFORM=ios`
2. Observe custom category flow

**Expected Result:**
- "Other" category selectable in modal ✅
- Custom category name input appears with required indicator (*)
- Validation prevents publish when custom name is empty
- Publish succeeds after entering custom name
- Success message mentions "submitted for review"
- Review flag created in `review_flags` table (type: `category_suggestion`)
- Item's `requested_category_name` set to entered value

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-008: Manual - Android Simulator Tests

**Objective:** Verify Maestro flows on Android  
**Priority:** P1  

**Steps:**
1. Launch Android emulator
2. Run: `maestro test item-create-happy-path.yaml --env=PLATFORM=android`
3. Run: `maestro test bulk-listing-publish-all.yaml --env=PLATFORM=android`
4. Run: `maestro test draft-resume.yaml --env=PLATFORM=android`
5. Run: `maestro test category-other.yaml --env=PLATFORM=android`

**Expected Result:**
- All 4 flows pass on Android ✅
- No platform-specific crashes
- UI elements render correctly

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-009: Manual - Draft Auto-Save (30s Timer)

**Objective:** Verify 30-second auto-save interval  
**Priority:** P2  

**Steps:**
1. Open app → Sell → Single item
2. Upload photo
3. Enter title: "Auto Save Test"
4. Wait 30 seconds without interacting
5. Force quit app
6. Relaunch app → Sell tab

**Expected Result:**
- Resume draft banner appears ✅
- Draft contains "Auto Save Test" title
- Photo is restored

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-010: Manual - Draft Blur-Flush

**Objective:** Verify draft saves on navigation blur  
**Priority:** P2  

**Steps:**
1. Open app → Sell → Single item
2. Upload photo
3. Enter title: "Blur Flush Test"
4. Immediately tap Home tab (< 30s elapsed)
5. Return to Sell tab

**Expected Result:**
- Resume draft banner appears ✅
- Draft contains "Blur Flush Test" title

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-011: Manual - Max 5 Drafts Enforcement

**Objective:** Verify trigger evicts oldest draft when 6th is created  
**Priority:** P2  

**Steps:**
1. Create 5 drafts (different titles: "Draft 1" through "Draft 5")
2. Exit each without publishing
3. Verify 5 resume banners/drafts exist
4. Create 6th draft ("Draft 6")
5. Exit without publishing
6. Check resume banners/drafts

**Expected Result:**
- Only 5 drafts exist ✅
- "Draft 1" (oldest) no longer appears
- "Draft 6" (newest) appears

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-012: Manual - AI Confidence Levels UI

**Objective:** Verify AI suggestions display correct confidence indicators  
**Priority:** P2  

**Steps:**
1. Open app → Sell → Single item
2. Upload a clear, recognizable toy photo
3. Wait for AI analysis to complete
4. Observe AI suggestions card

**Expected Result:**
- High confidence (≥0.70) fields show green indicator ✅
- Medium confidence (0.40-0.69) fields show yellow indicator
- Low confidence (<0.40) fields omitted or grayed out
- "Apply All" button available
- Individual "Use" buttons per field

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-013: Manual - Price Suggestions

**Objective:** Verify 4-tier price suggestions appear when data available  
**Priority:** P2  

**Steps:**
1. Create item in a popular category (e.g., Toys)
2. Select condition
3. Observe price suggestion card

**Expected Result:**
- 4 tiers displayed if ≥5 comparable sales exist ✅
  - Great Deal (45% of avg)
  - Fair Price (60% of avg)
  - Asking Price (75% of avg)
  - Almost New (90% of avg)
- Tapping a tier fills price input
- Manual override still allowed

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-014: Manual - Bulk Photo Grouping Caps

**Objective:** Verify bulk upload enforces 30 photos / 15 groups / 10 per group  
**Priority:** P2  

**Steps:**
1. Open app → Sell → Bulk upload
2. Attempt to upload 31 photos

**Expected Result:**
- Upload blocked at 30 photos ✅
- Error message: "Maximum 30 photos allowed"

**Steps (continued):**
3. Upload 30 photos
4. Attempt to create 16th group

**Expected Result:**
- Group creation blocked at 15 groups ✅
- Error message: "Maximum 15 items allowed"

**Steps (continued):**
5. Attempt to add 11th photo to a single group

**Expected Result:**
- Add blocked at 10 photos per group ✅
- Error message: "Maximum 10 photos per item"

**Actual Result:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

### TC-015: Manual - Performance - Single Item Create <8s

**Objective:** Verify listing creation with 10 photos completes in <8s  
**Priority:** P3  

**Steps:**
1. Prepare 10 test photos
2. Start timer
3. Open app → Sell → Single item
4. Upload 10 photos
5. Wait for upload + compression to complete
6. Stop timer

**Expected Result:**
- Total time from upload start to completion: <8 seconds ✅
- No UI freeze or lag
- All 10 photos compressed to ≤1MB each

**Actual Result:** ___________  
**Measured Time:** ___________  
**Status:** ☐ PASS ☐ FAIL  
**Notes:** _____________

---

## Summary

| Test Case | Priority | Status | Notes |
|-----------|----------|--------|-------|
| TC-001: Unit Tests - Services | P0 | ☐ | |
| TC-002: Unit Tests - Hooks | P0 | ☐ | |
| TC-003: PgTAP Tests | P0 | ☐ | |
| TC-004: Maestro - Happy Path | P0 | ☐ | |
| TC-005: Maestro - Bulk Publish | P0 | ☐ | |
| TC-006: Maestro - Draft Resume | P1 | ☐ | |
| TC-007: Maestro - Category Other | P1 | ☐ | |
| TC-008: Android Simulator | P1 | ☐ | |
| TC-009: Draft Auto-Save 30s | P2 | ☐ | |
| TC-010: Draft Blur-Flush | P2 | ☐ | |
| TC-011: Max 5 Drafts | P2 | ☐ | |
| TC-012: AI Confidence UI | P2 | ☐ | |
| TC-013: Price Suggestions | P2 | ☐ | |
| TC-014: Bulk Caps | P2 | ☐ | |
| TC-015: Performance <8s | P3 | ☐ | |

**Overall Test Result:** ☐ PASS ☐ FAIL  
**Tested By:** _____________  
**Date:** _____________  
**Build Version:** _____________  

---

## Issues Found

| Issue # | Severity | Description | Steps to Reproduce | Status |
|---------|----------|-------------|-------------------|--------|
| | | | | |
| | | | | |

---

## Commands Reference

### Run Unit Tests
```bash
cd p2p-kids-marketplace
npm test -- --testPathPattern=services
npm test -- --testPathPattern=hooks
npm test -- --testPathPattern=services/photoService
npm test -- --testPathPattern=services/aiService
npm test -- --testPathPattern=services/draftService
npm test -- --testPathPattern=services/pricingService
npm test -- --testPathPattern=services/categoryService
npm test -- --testPathPattern=hooks/useItemDraft
npm test -- --testPathPattern=hooks/useAIAnalysis
npm test -- --testPathPattern=hooks/usePhotoGroups
```

### Run Maestro Flows (iOS)
```bash
cd /path/to/workspace/.maestro
maestro test item-create-happy-path.yaml --env=PLATFORM=ios
maestro test bulk-listing-publish-all.yaml --env=PLATFORM=ios
maestro test draft-resume.yaml --env=PLATFORM=ios
maestro test category-other.yaml --env=PLATFORM=ios
```

### Run Maestro Flows (Android)
```bash
cd /path/to/workspace/.maestro
maestro test item-create-happy-path.yaml --env=PLATFORM=android
maestro test bulk-listing-publish-all.yaml --env=PLATFORM=android
maestro test draft-resume.yaml --env=PLATFORM=android
maestro test category-other.yaml --env=PLATFORM=android
```

### Run All Maestro Flows
```bash
cd /path/to/workspace/.maestro
maestro test item-create-happy-path.yaml bulk-listing-publish-all.yaml draft-resume.yaml category-other.yaml
```

### Supabase PgTAP Tests
⚠️ **Run in Supabase Dashboard SQL Editor (Prod Environment)**
```sql
-- Copy entire content of /supabase/tests/item_drafts.sql
-- Paste into SQL Editor
-- Execute
```

### Check Coverage
```bash
cd p2p-kids-marketplace
npm test -- --coverage --testPathPattern=services
```

---

## Notes

- All tests must be run against **Supabase Prod environment** (not local).
- Ensure test user has active subscription for testing SP-related features.
- For Maestro flows, ensure simulator has at least 10 test photos in gallery.
- If any test fails, capture screenshots and logs before proceeding.
- Update `flow-registry.md` after all tests pass.
