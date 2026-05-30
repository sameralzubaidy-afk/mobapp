# Manual Testing Guide: MODULE-04 LISTING-V3-003 Services Layer

**Task**: LISTING-V3-003 Services Layer Implementation  
**Components**: photoService, aiService, draftService, pricingService, conditionService, categoryService  
**Target Platforms**: iOS Simulator, Android Emulator  
**Required Setup**: Production Supabase instance with LISTING-V3-001 migrations applied

---

## Prerequisites

### 1. Verify SQL Migrations Applied
Before testing, confirm these migrations exist in Supabase Dashboard → SQL Editor → "Migrations" tab:

- ✅ `20260420000003_create_item_bulk_uploads.sql`
- ✅ `20260420000004_create_item_drafts.sql`
- ✅ Items table has columns: `bulk_upload_id`, `requested_category_name`

### 2. Test Data Setup
You need at least one test seller account. Record the `user_id`:

```sql
-- Get test seller ID
SELECT id, email FROM auth.users WHERE email = 'test-seller@example.com';
```

### 3. Environment Configuration
Verify `.env.local` contains:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Test Suite 1: Photo Service

### TC1.1: Photo Validation - Valid JPEG
**Objective**: Verify JPEG photos pass validation

**Steps**:
1. Open app in iOS Simulator
2. Navigate to Sell → Create Listing → Photo-First
3. Select a JPEG photo (800×600, 2MB)

**Expected Result**:
- Photo appears in thumbnail grid
- No validation error shown
- Upload progress indicator appears

**Pass/Fail**: ___________

---

### TC1.2: Photo Validation - Reject Large File
**Objective**: Verify >10MB photos are rejected

**Steps**:
1. Prepare a 12MB JPEG file
2. Navigate to Photo Upload screen
3. Attempt to select the large file

**Expected Result**:
- Error toast: "Photo must be smaller than 10MB"
- Photo does not appear in grid
- Selection count unchanged

**Pass/Fail**: ___________

---

### TC1.3: Photo Validation - Reject Small Dimensions
**Objective**: Verify photos < 400×400px are rejected

**Steps**:
1. Prepare a 300×300px JPEG
2. Navigate to Photo Upload screen
3. Attempt to select the small file

**Expected Result**:
- Error toast: "Photo must be at least 400×400 pixels"
- Photo rejected

**Pass/Fail**: ___________

---

### TC1.4: Photo Grouping - Auto-Group 2 Per Group
**Objective**: Verify default 2-photos-per-group behavior

**Steps**:
1. Select 6 valid photos
2. Observe photo grid layout

**Expected Result**:
- Photos are grouped into 3 groups
- Each group shows "2 photos" badge
- Groups labeled: "Group 1", "Group 2", "Group 3"

**Pass/Fail**: ___________

---

### TC1.5: Photo Grouping - Enforce 30 Total Cap
**Objective**: Verify maximum 30 photos enforced

**Steps**:
1. Attempt to select 35 photos
2. Observe behavior after 30th photo

**Expected Result**:
- Only first 30 photos accepted
- Error toast: "Maximum 30 photos allowed"
- Selection disabled after 30

**Pass/Fail**: ___________

---

### TC1.6: Photo Regrouping - Move Photo Between Groups
**Objective**: Verify drag-and-drop regroup functionality

**Steps**:
1. Upload 4 photos (creates 2 groups)
2. Long-press first photo of Group 1
3. Drag to Group 2
4. Release

**Expected Result**:
- Group 1 now has 1 photo
- Group 2 now has 3 photos
- Photo maintains quality
- Group IDs remain stable

**Pass/Fail**: ___________

---

### TC1.7: Photo Regrouping - Prevent Overfilling Group
**Objective**: Verify 10-photos-per-group cap

**Steps**:
1. Create a group with 10 photos
2. Attempt to drag an 11th photo to it

**Expected Result**:
- Drag operation is rejected
- Visual indicator shows "Group Full"
- Photo returns to source group

**Pass/Fail**: ___________

---

## Test Suite 2: AI Service

### TC2.1: AI Batch Analysis - Success Case
**Objective**: Verify AI analyzes multiple photos and returns suggestions

**Steps**:
1. Upload 4 photos of a recognizable toy (e.g., LEGO set)
2. Tap "Analyze Photos" button
3. Wait for analysis (max 30 seconds)

**Expected Result**:
- Progress indicator shows "Analyzing..."
- Results appear with:
  - Suggested title (confidence badge)
  - Suggested category
  - Suggested condition
  - Suggested colors
- Confidence levels displayed: High (green), Medium (yellow), or Low (red)

**Pass/Fail**: ___________

---

### TC2.2: AI Analysis - Confidence Filtering
**Objective**: Verify low-confidence results (<0.40) are stripped

**Steps**:
1. Upload a blurry or ambiguous photo
2. Trigger AI analysis
3. Review results

**Expected Result**:
- Only fields with confidence ≥ 0.40 are shown
- Low-confidence fields omitted (not shown as blank)
- User sees "Some fields couldn't be determined" message

**Pass/Fail**: ___________

---

### TC2.3: AI Analysis - Error Handling
**Objective**: Verify graceful handling of analysis failures

**Steps**:
1. Disable network
2. Upload photos and trigger analysis
3. Observe error behavior

**Expected Result**:
- Error message: "AI analysis failed. You can fill details manually."
- User can proceed to manual entry
- No app crash

**Pass/Fail**: ___________

---

## Test Suite 3: Draft Service

### TC3.1: Draft Creation - Basic
**Objective**: Verify draft is created and saved

**Steps**:
1. Start creating a listing
2. Add 2 photos
3. Tap "Save as Draft" button

**Expected Result**:
- Toast: "Draft saved"
- Draft appears in "Your Drafts" screen
- Shows thumbnail of first photo
- Shows creation timestamp

**Pass/Fail**: ___________

---

### TC3.2: Draft Update - JSONB Merge
**Objective**: Verify concurrent updates don't overwrite fields

**Steps**:
1. Create a draft with title "Item A"
2. Open draft on Device 1, add description
3. Open same draft on Device 2, change price
4. Save both

**Expected Result**:
- Final draft contains:
  - Title: "Item A"
  - Description from Device 1
  - Price from Device 2
- No data loss

**Pass/Fail**: ___________

---

### TC3.3: Draft Eviction - Max 5 Drafts
**Objective**: Verify oldest draft evicted when creating 6th

**Steps**:
1. Create 5 drafts (note timestamps)
2. Create a 6th draft

**Expected Result**:
- Total drafts remains 5
- Oldest draft (first created) is deleted
- Newest 5 drafts visible in "Your Drafts"

**Pass/Fail**: ___________

---

### TC3.4: Draft Publish - Validation
**Objective**: Verify required fields checked before publish

**Steps**:
1. Create a draft with only title (no price, category, photos)
2. Tap "Publish" button

**Expected Result**:
- Error dialog appears
- Lists missing fields:
  - "Price is required"
  - "Category is required"
  - "At least 1 photo is required"
- Publish button disabled

**Pass/Fail**: ___________

---

### TC3.5: Draft Publish - Success
**Objective**: Verify valid draft publishes as listing

**Steps**:
1. Create a complete draft:
   - Title: "Test Item"
   - Description: "Test description"
   - Price: $25.00
   - Category: Toys
   - Condition: Good
   - 2 photos
2. Tap "Publish"

**Expected Result**:
- Loading indicator shows "Publishing..."
- Success modal: "Listing published!"
- Draft removed from "Your Drafts"
- Listing visible in "My Listings" tab
- Listing status = "active"

**Pass/Fail**: ___________

---

### TC3.6: Bulk Publish - Multiple Drafts
**Objective**: Verify bulk publish publishes all selected drafts

**Steps**:
1. Create 3 complete drafts
2. Navigate to "Your Drafts"
3. Tap "Select Multiple"
4. Check all 3 drafts
5. Tap "Publish Selected" (3)

**Expected Result**:
- Confirmation dialog: "Publish 3 listings?"
- Progress shows "1 of 3", "2 of 3", "3 of 3"
- Success: "3 listings published"
- All 3 drafts removed
- All 3 listings appear in "My Listings"

**Pass/Fail**: ___________

---

### TC3.7: Bulk Publish - Partial Failure
**Objective**: Verify partial failures reported correctly

**Steps**:
1. Create 2 drafts:
   - Draft A: Complete
   - Draft B: Missing category
2. Select both for bulk publish
3. Tap "Publish Selected"

**Expected Result**:
- Draft A publishes successfully
- Draft B fails with error: "Category is required"
- Summary: "1 of 2 published successfully"
- Draft B remains in "Your Drafts"

**Pass/Fail**: ___________

---

## Test Suite 4: Pricing Service

### TC4.1: Price Suggestions - Sufficient Data
**Objective**: Verify 4 price tiers shown when ≥5 comparable sales exist

**Steps**:
1. Navigate to Price step
2. Select category "Toys" (ensure ≥5 sold items in DB)
3. Observe price suggestions

**Expected Result**:
- 4 tiers displayed:
  - Great Deal (45% of avg)
  - Fair Price (60% of avg)
  - Asking Price (75% of avg)
  - Almost New (90% of avg)
- Each tier shows price + label

**Pass/Fail**: ___________

---

### TC4.2: Price Suggestions - Insufficient Data
**Objective**: Verify empty state when <5 comparable sales

**Steps**:
1. Select a rarely-used category (e.g., "Musical Instruments")
2. Observe price suggestions

**Expected Result**:
- Message: "Not enough data for price suggestions"
- Manual price entry input shown
- No tier cards displayed

**Pass/Fail**: ___________

---

### TC4.3: Price Validation - Reject Invalid
**Objective**: Verify price validation rules enforced

**Steps**:
1. Test each invalid price:
   - $0.00 (must be > 0)
   - $10,001 (must be ≤ 10,000)
   - $12.345 (max 2 decimals)
2. Observe validation errors

**Expected Result**:
- Each shows appropriate error:
  - "Price must be greater than $0"
  - "Price must be $10,000 or less"
  - "Price must have at most 2 decimal places"
- "Next" button disabled

**Pass/Fail**: ___________

---

### TC4.4: Price Formatting - Display
**Objective**: Verify prices formatted correctly

**Steps**:
1. Select "Fair Price" tier ($45.00)
2. Observe price input

**Expected Result**:
- Displays as "$45.00" (not "45" or "$45")
- Preserves 2 decimals even for whole numbers

**Pass/Fail**: ___________

---

## Test Suite 5: Condition Service

### TC5.1: Condition Guide - Display All 5
**Objective**: Verify all condition options shown with descriptions

**Steps**:
1. Navigate to Condition selection screen
2. Observe condition cards

**Expected Result**:
- 5 conditions displayed:
  - New ✨: "Brand new with tags"
  - Like New ✨: "Excellent condition, minimal wear"
  - Good 👍: "Light wear, fully functional"
  - Fair ⚠️: "Noticeable wear, fully functional"
  - Worn 🔧: "Heavy wear, may need minor repair"
- Each has emoji + description

**Pass/Fail**: ___________

---

### TC5.2: Condition Guide - Caching
**Objective**: Verify condition guides cached for 24 hours

**Steps**:
1. Load condition screen (first time)
2. Enable network inspection
3. Close and reopen condition screen within 1 hour
4. Check network requests

**Expected Result**:
- First load: fetches from service
- Second load: no network request (AsyncStorage cache hit)

**Pass/Fail**: ___________

---

### TC5.3: Color Palette - MODULE-05 V3 Reuse
**Objective**: Verify COLOR_PALETTE from MODULE-05 V3 is used (no duplication)

**Steps**:
1. Navigate to Color selection screen
2. Count color swatches displayed

**Expected Result**:
- Exactly 12 colors shown (MODULE-05 V3 palette)
- Colors match: Red, Blue, Green, Yellow, Pink, Purple, Orange, Black, White, Gray, Brown, Multicolor
- No duplicate color service created

**Pass/Fail**: ___________

---

### TC5.4: Color Matching - Fuzzy Search
**Objective**: Verify color matching works with search terms

**Steps**:
1. Type "sky" in color search
2. Type "crimson"
3. Type "navy"

**Expected Result**:
- "sky" → matches "Blue"
- "crimson" → matches "Red"
- "navy" → matches "Blue"
- Case-insensitive

**Pass/Fail**: ___________

---

## Test Suite 6: Category Service

### TC6.1: Category with Counts - Display
**Objective**: Verify categories show active item counts

**Steps**:
1. Navigate to Category selection screen
2. Observe category list

**Expected Result**:
- Each category shows item count
- Format: "Toys (24 items)"
- Sorted by display_order

**Pass/Fail**: ___________

---

### TC6.2: Category Flag for Review - Idempotent
**Objective**: Verify flagging is idempotent (can flag same item multiple times)

**Steps**:
1. Type custom category "Baby Carriers"
2. Tap "Flag for Admin Review"
3. Observe confirmation
4. Repeat flagging same item/category

**Expected Result**:
- First flag: Creates review_flag record
- Second flag: Updates existing record (no duplicate)
- Both show: "Flagged for admin review"

**Pass/Fail**: ___________

---

### TC6.3: Recent Categories - LRU Cache
**Objective**: Verify recent categories limited to 3, most recent first

**Steps**:
1. Create listing with category "Toys"
2. Create listing with category "Clothes"
3. Create listing with category "Books"
4. Create listing with category "Games"
5. Open Category selection screen

**Expected Result**:
- "Recent Categories" section shows:
  - Games (most recent)
  - Books
  - Clothes
- "Toys" not shown (evicted, max 3)

**Pass/Fail**: ___________

---

### TC6.4: Category Search - Fuzzy
**Objective**: Verify category search is case-insensitive and partial-match

**Steps**:
1. Type "toy" in search box
2. Type "TOY"
3. Type "to"

**Expected Result**:
- All 3 searches return "Toys" category
- Results update in real-time (debounced)
- Max 10 results shown

**Pass/Fail**: ___________

---

## Test Suite 7: Integration Flows

### TC7.1: End-to-End Photo-First Flow
**Objective**: Verify complete photo-first listing creation

**Steps**:
1. Select 4 photos
2. AI analyzes and suggests:
   - Title: "LEGO Duplo Train"
   - Category: Toys
   - Condition: Like New
   - Price: $30 (from tier)
3. Accept all AI suggestions
4. Add description manually
5. Publish

**Expected Result**:
- Listing created with:
  - 4 photos (2 groups)
  - AI-suggested title
  - AI-suggested category
  - AI-suggested condition
  - Tier-suggested price
  - Manual description
- Status = "active"

**Pass/Fail**: ___________

---

### TC7.2: Draft Resume from Home Banner
**Objective**: Verify draft banner appears and resumes correctly

**Steps**:
1. Create a draft, save at Photo step
2. Navigate to Home screen
3. Observe banner
4. Tap banner

**Expected Result**:
- Banner shows: "Complete your listing - 1 draft in progress"
- Tapping banner navigates to PhotoUploadScreen
- Draft data pre-filled (photos visible)

**Pass/Fail**: ___________

---

### TC7.3: Mixed AI Accept/Reject Flow
**Objective**: Verify user can accept some AI suggestions and reject others

**Steps**:
1. Upload photos, trigger AI
2. Accept AI title (confidence: high)
3. Reject AI category (confidence: medium)
4. Manually select category "Books"
5. Accept AI condition (good)
6. Manually set price $15

**Expected Result**:
- Final listing has:
  - AI title
  - Manual category
  - AI condition
  - Manual price
- No conflicts or overwrites

**Pass/Fail**: ___________

---

## Edge Cases & Error Scenarios

### TC8.1: Network Failure During Photo Upload
**Objective**: Verify partial upload recovery

**Steps**:
1. Upload 5 photos
2. Disconnect network after 3 photos upload
3. Observe behavior

**Expected Result**:
- First 3 photos: uploaded successfully
- Last 2 photos: error shown "Upload failed"
- User can retry failed uploads
- Successful uploads not re-attempted

**Pass/Fail**: ___________

---

### TC8.2: Concurrent Draft Edits
**Objective**: Verify JSONB merge prevents data loss

**Steps**:
1. Open draft on 2 devices
2. Device 1: Edit title
3. Device 2: Edit price
4. Both save within 1 second

**Expected Result**:
- Both updates persist
- No "last write wins" data loss
- Merge_item_draft RPC called (or client fallback)

**Pass/Fail**: ___________

---

### TC8.3: Photo Compression Failure
**Objective**: Verify graceful degradation

**Steps**:
1. Upload a corrupted JPEG file

**Expected Result**:
- Error toast: "Failed to process photo"
- Photo skipped
- Other photos continue uploading

**Pass/Fail**: ___________

---

## Performance Benchmarks

### TC9.1: Photo Upload Speed
**Test**: Upload 10 photos (each 2MB)

**Expected**: Complete within 30 seconds on Wi-Fi

**Actual Time**: ___________ seconds

**Pass/Fail**: ___________

---

### TC9.2: AI Analysis Speed
**Test**: Analyze 3 groups (6 photos total)

**Expected**: Complete within 15 seconds

**Actual Time**: ___________ seconds

**Pass/Fail**: ___________

---

### TC9.3: Draft Save Latency
**Test**: Save draft with 10 photos + AI data

**Expected**: Save completes within 2 seconds

**Actual Time**: ___________ seconds

**Pass/Fail**: ___________

---

## Test Summary

**Total Test Cases**: 51  
**Passed**: ___________  
**Failed**: ___________  
**Blocked**: ___________  
**Not Tested**: ___________  

**Test Environment**:
- iOS Version: ___________
- Android Version: ___________
- App Build: ___________
- Supabase Version: ___________

**Tester Name**: ___________  
**Test Date**: ___________  

---

## Appendix: SQL Verification Queries

### Verify Draft Created
```sql
SELECT * FROM item_drafts 
WHERE seller_id = '<your-test-seller-id>' 
ORDER BY created_at DESC LIMIT 1;
```

### Verify Bulk Upload Status
```sql
SELECT * FROM item_bulk_uploads 
WHERE seller_id = '<your-test-seller-id>' 
ORDER BY created_at DESC LIMIT 1;
```

### Verify Category Flag
```sql
SELECT i.id, i.title, i.requested_category_name, rf.* 
FROM items i
LEFT JOIN review_flags rf ON rf.item_id = i.id
WHERE i.id = '<flagged-item-id>';
```

### Check Recent Categories Cache
In app console:
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
const recent = await AsyncStorage.getItem('@kids_marketplace:recent_categories_<seller_id>');
console.log(JSON.parse(recent));
```
