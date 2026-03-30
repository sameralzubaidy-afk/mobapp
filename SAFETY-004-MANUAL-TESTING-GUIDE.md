# SAFETY-004: Google Vision Image Moderation - Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-004 - Implement Google Vision API Image Moderation  
**Test Environment:** iOS Simulator / Android Emulator  
**Prerequisites:**
- ✅ Migration 306 applied (ai_moderation_logs table)
- ✅ GOOGLE_VISION_API_KEY configured in Supabase
- ✅ moderate-image Edge Function deployed
- ✅ item-images storage bucket exists (SAFETY-P001)
- ✅ Test user account (free + Kids Club+ subscriber)

---

## Test Setup

### 1. Verify Database Migration

**SQL to run in Supabase SQL Editor:**

```sql
-- Verify ai_moderation_logs table exists
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_moderation_logs' 
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid)
-- item_id (uuid)
-- image_url (text)
-- moderation_type (text)
-- service (text)
-- decision (text)
-- flagged (boolean)
-- confidence_score (numeric)
-- details (jsonb)
-- created_at (timestamptz)
```

**Expected Result:** Table exists with all 10 columns.

---

### 2. Verify Edge Function Deployed

**Run in terminal:**

```bash
cd p2p-kids-marketplace
supabase functions list

# Should show: moderate-image
```

**If not deployed, deploy now:**

```bash
supabase functions deploy moderate-image
```

---

### 3. Verify Google Vision API Key

**Check Supabase Dashboard:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Verify `GOOGLE_VISION_API_KEY` is set
3. If not set, add it now

---

## Test Cases

### TC-001: Upload Listing with Safe Image

**Objective:** Verify safe images pass moderation and listing is created successfully

**Steps:**
1. Launch app in iOS Simulator / Android Emulator
2. Login with test account
3. Navigate to: Sell tab → "Create Listing"
4. Fill in listing details:
   - Title: "Kids Bicycle - Red"
   - Description: "Good condition kids bike"
   - Price: $25.00
   - Condition: "Good"
   - Category: "Toys & Games"
5. Tap "Add Photos"
6. Select **1 safe image** from gallery (e.g., toy photo)
7. Tap "Publish Listing"

**Expected Results:**
- ✅ Listing created successfully
- ✅ Success message displayed
- ✅ User redirected to My Listings
- ✅ Listing visible with image
- ✅ Listing status: `available` (check in Supabase)

**Verify in Supabase SQL Editor:**

```sql
-- Get latest listing
SELECT id, title, status, flagged_at 
FROM items 
WHERE seller_id = '<your-user-id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Get moderation log
SELECT decision, flagged, confidence_score, details
FROM ai_moderation_logs 
WHERE item_id = '<item-id-from-above>' 
ORDER BY created_at DESC;
```

**Expected SQL Results:**
- `items.status` = `'available'` (or `'pending'` if Starter Pack)
- `items.flagged_at` = `NULL`
- `ai_moderation_logs.decision` = `'approved'`
- `ai_moderation_logs.confidence_score` < 0.5

---

### TC-002: Upload Multiple Safe Images

**Objective:** Verify multiple images are moderated sequentially

**Steps:**
1. Create new listing
2. Fill in details:
   - Title: "Toy Car Collection"
   - Price: $30.00
3. Tap "Add Photos"
4. Select **3 safe images** (toy cars, books, etc.)
5. Verify all 3 images appear in preview
6. Tap "Publish Listing"

**Expected Results:**
- ✅ All 3 images uploaded
- ✅ Listing created successfully
- ✅ All images visible in listing detail

**Verify in Supabase:**

```sql
-- Get moderation logs for all images
SELECT image_url, decision, confidence_score
FROM ai_moderation_logs 
WHERE item_id = '<item-id>' 
ORDER BY created_at;
```

**Expected SQL Results:**
- 3 rows returned (one per image)
- All `decision` = `'approved'`

---

### TC-003: Upload Image with Moderate Content (POSSIBLE likelihood)

**Objective:** Verify borderline images are logged but don't flag listing

**Steps:**
1. Create new listing with title "Test Borderline"
2. Upload an image with potential ambiguity (e.g., medical diagram, cartoon violence)
3. Submit listing

**Expected Results:**
- ✅ Listing created
- ✅ Listing status: `available` (not flagged for POSSIBLE/UNLIKELY)

**Verify in Supabase:**

```sql
SELECT decision, confidence_score, details
FROM ai_moderation_logs 
WHERE item_id = '<item-id>';
```

**Expected:** `decision` = `'approved'` even if `confidence_score` is 0.3-0.5

---

### TC-004: Simulate Flagged Image (Admin Override Test)

**Objective:** Verify Edge Function flags items with LIKELY/VERY_LIKELY scores

**Note:** This test requires an actual unsafe image which we cannot provide. Instead, test the admin workflow:

**Steps:**
1. Create listing with safe image
2. Manually insert a flagged moderation log via SQL:

```sql
-- Manually flag an item for testing
INSERT INTO ai_moderation_logs (item_id, image_url, moderation_type, service, decision, flagged, confidence_score, details)
VALUES (
  '<item-id>',
  'https://example.com/test-flagged.jpg',
  'image',
  'google_vision',
  'flagged',
  true,
  0.9,
  '{"safe_search": {"adult": "VERY_LIKELY", "violence": "UNLIKELY", "racy": "LIKELY", "medical": "UNLIKELY", "spoof": "UNLIKELY"}, "flagged_categories": ["adult", "racy"]}'::jsonb
);

-- Flag the item
UPDATE items 
SET status = 'flagged', flagged_at = NOW() 
WHERE id = '<item-id>';

-- Create safety flag
INSERT INTO item_safety_flags (item_id, flag_type, flag_reason, confidence_score, status)
VALUES (
  '<item-id>',
  'ai_moderation',
  'Unsafe image content detected: adult, racy',
  0.9,
  'pending'
);
```

3. In app, navigate to My Listings
4. Find the flagged listing

**Expected Results:**
- ✅ Listing shows status badge: "Under Review" or "Flagged"
- ✅ Seller can see rejection reason
- ✅ Seller can tap "View Safety Review"

---

### TC-005: Moderation Logs Visible in Admin Portal

**Objective:** Verify admin can view moderation logs

**Prerequisites:** Admin account

**Steps:**
1. Login to admin portal: `http://localhost:3001` (or production URL)
2. Navigate to: Safety → Moderation Logs
3. Filter by: `service = 'google_vision'`

**Expected Results:**
- ✅ All moderation logs visible
- ✅ Columns: Item ID, Image URL, Decision, Confidence, Timestamp
- ✅ Can view full details (safe search scores)

---

### TC-006: Error Handling - Invalid Image URL

**Objective:** Verify graceful error handling when image URL is invalid

**Steps:**
1. Create listing "Test Error Handling"
2. Upload image
3. Before publishing, use network inspector to verify image upload succeeded
4. Publish listing

**Expected Results:**
- ✅ If moderation fails, listing is still created (fail-open behavior)
- ✅ No crash or app freeze
- ✅ Error logged in console (check Metro logs)

**Verify in Metro Logs:**

```
[listing] ❌ AI moderation failed for listing <item-id>: <error-message>
```

---

### TC-007: Moderation Does Not Block Listing Creation

**Objective:** Verify moderation runs async and doesn't block UI

**Steps:**
1. Create listing with image
2. Tap "Publish Listing"
3. Observe timing

**Expected Results:**
- ✅ Success message appears immediately (< 2 seconds)
- ✅ User is NOT blocked waiting for Google Vision API response
- ✅ Moderation runs in background (fire-and-forget)

**Check Console Logs:**

```
[listing] ✅ All 1 images uploaded successfully
[listing] 🔍 Initiating AI image moderation for listing <item-id>
[moderate-image] Processing item <item-id>, image: <url>
[moderate-image] Calling Google Vision API...
[moderate-image] Decision: approved, flagged categories: [], max confidence: 0.1
[listing] ✅ All 1 images passed AI moderation for listing <item-id>
```

---

### TC-008: Verify RLS Policies on ai_moderation_logs

**Objective:** Ensure only admins and service_role can access moderation logs

**Steps:**
1. Run SQL as authenticated user (non-admin):

```sql
-- Should fail for non-admin
SELECT * FROM ai_moderation_logs LIMIT 1;
```

**Expected Result:** `ERROR: permission denied for table ai_moderation_logs`

2. Run SQL as admin user:

```sql
-- Should succeed for admin
SELECT * FROM ai_moderation_logs LIMIT 1;
```

**Expected Result:** Row returned

---

### TC-009: Performance Test - Multiple Images

**Objective:** Verify moderation of 5 images completes within acceptable time

**Steps:**
1. Create listing with **5 images**
2. Tap "Publish Listing"
3. Monitor console logs for timing

**Expected Results:**
- ✅ All 5 images moderated (check logs count)
- ✅ Total moderation time < 30 seconds
- ✅ No timeout errors

**Verify Timing in Logs:**

```
[listing] 🔍 Initiating AI image moderation for listing <item-id>
[moderate-image] Processing item <item-id>, image: <url-1>
...
[moderate-image] Processing item <item-id>, image: <url-5>
[listing] ✅ All 5 images passed AI moderation for listing <item-id>
```

---

### TC-010: Edge Function Error - Missing API Key

**Objective:** Verify error handling when Google Vision API key is missing

**Setup:** Temporarily remove `GOOGLE_VISION_API_KEY` from Supabase secrets

**Steps:**
1. Create listing with image
2. Tap "Publish Listing"

**Expected Results:**
- ✅ Listing created (fail-open)
- ✅ Error logged in Supabase Edge Function logs
- ✅ App does not crash

**Verify in Supabase Edge Function Logs:**

```
[moderate-image] Error: GOOGLE_VISION_API_KEY not configured
```

**Restore:** Re-add `GOOGLE_VISION_API_KEY` after test

---

## Summary Checklist

After completing all test cases, verify:

- [ ] TC-001: Safe image approved ✅
- [ ] TC-002: Multiple images moderated ✅
- [ ] TC-003: Borderline content handled correctly ✅
- [ ] TC-004: Flagged image workflow tested ✅
- [ ] TC-005: Admin can view logs ✅ 
- [ ] TC-006: Error handling graceful ✅
- [ ] TC-007: Moderation async (non-blocking) ✅
- [ ] TC-008: RLS policies enforced ✅
- [ ] TC-009: Performance acceptable (5 images < 30s) ✅
- [ ] TC-010: Missing API key error handled ✅

---

## Troubleshooting

### Issue: Moderation logs not appearing

**Solution:**
1. Check Edge Function deployed: `supabase functions list`
2. Check API key set: Supabase Dashboard → Secrets
3. Check migration applied: `SELECT * FROM ai_moderation_logs LIMIT 1;`

### Issue: "Could not find the 'image_url' column of 'ai_moderation_logs' in the schema cache"

**Cause:** Existing `ai_moderation_logs` table was created from an older schema and is missing `image_url`, or PostgREST schema cache was not refreshed after SQL changes.

**Fix:**
1. Run migration `supabase/migrations/20260329000002_fix_ai_moderation_logs_schema_drift.sql`
2. Verify columns:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_moderation_logs'
ORDER BY ordinal_position;
```

3. Verify `image_url` now exists and rerun listing publish flow.

### Issue: Listing not flagged despite unsafe image

**Cause:** Google Vision may not flag all unsafe content (AI limitations)

**Solution:** Use TC-004 manual flag test to verify flagging workflow

### Issue: "Network timeout" error

**Cause:** Google Vision API slow or unavailable

**Solution:** Retry after a few minutes; check Google Cloud Console for API status

---

## Next Steps

After manual testing, update:
- [x] Unit tests pass: `npm run test -- imageModeration.test.ts`
- [x] E2E tests pass: `RUN_SUPABASE_E2E=true npm run test:e2e -- safety-004`
- [ ] Maestro flows pass: `npm run test:maestro:ios -- safety-004-image-moderation`
- [ ] Update flow-registry.md with FLOW-SAFETY-004
