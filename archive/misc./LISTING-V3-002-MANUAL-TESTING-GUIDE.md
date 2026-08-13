# LISTING-V3-002: AI Analysis Edge Functions - Manual Testing Guide

**Module:** MODULE-04-ITEM-LISTING-V3  
**Task:** LISTING-V3-002 - Edge Functions for AI Image Analysis  
**Date:** April 22, 2026  
**Tester:** [Your Name]  
**Environment:** Staging Supabase

---

## Prerequisites

### 1. Verify Edge Functions Are Deployed

```bash
# From repository root
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Deploy both functions to staging
npx supabase functions deploy analyze-item-image --project-ref <your-staging-project>
npx supabase functions deploy batch-analyze-items --project-ref <your-staging-project>

# Verify deployment
npx supabase functions list --project-ref <your-staging-project>
```

**Expected Output:**
```
analyze-item-image    deployed    <timestamp>
batch-analyze-items   deployed    <timestamp>
```

### 2. Verify Google Vision API Key

```bash
# Check that GOOGLE_VISION_API_KEY is set in Supabase Edge Function secrets
npx supabase secrets list --project-ref <your-staging-project>
```

**Expected:** `GOOGLE_VISION_API_KEY` should be listed

### 3. Verify Categories Exist in Database

```sql
-- Run in Supabase SQL Editor (staging)
SELECT id, name, is_active FROM categories WHERE is_active = true ORDER BY display_order LIMIT 10;
```

**Expected:** At least 5-10 active categories should exist

---

## Test Cases

### TC-001: Single Image Analysis - Basic Flow

**Objective:** Verify `analyze-item-image` returns valid AIAnalysisResult with confidence scores

**Steps:**

1. Open Supabase Dashboard → Edge Functions → `analyze-item-image` → Invoke

2. Use this request body:
```json
{
  "photoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
  "sellerId": "test-seller-001"
}
```

3. Click "Invoke"

**Expected Results:**

- ✅ Status: 200 OK
- ✅ Response has `rawLabels` array with Google Vision labels
- ✅ Any returned fields (`title`, `category`, `condition`, etc.) have:
  - `value` property with correct type
  - `confidence` property >= 0.40
- ✅ Fields with confidence < 0.40 are NOT present in response
- ✅ Response time: < 5 seconds

**Example Valid Response:**
```json
{
  "title": {
    "value": "Toy Building Blocks",
    "confidence": 0.85
  },
  "category": {
    "value": {
      "label": "Toys",
      "categoryId": "uuid-here-or-null"
    },
    "confidence": 0.72
  },
  "color": {
    "value": ["Red", "Blue", "Yellow"],
    "confidence": 0.75
  },
  "rawLabels": ["Toy", "Lego", "Brick", "Building Set"]
}
```

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-002: Confidence Threshold Filtering

**Objective:** Verify fields with confidence < 0.40 are omitted

**Steps:**

1. Invoke `analyze-item-image` with a low-quality or ambiguous photo:
```json
{
  "photoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=50&q=10",
  "sellerId": "test-seller-001"
}
```

2. Examine response

**Expected Results:**

- ✅ Response may have very few fields or only `rawLabels`
- ✅ All returned fields have `confidence >= 0.40`
- ✅ No field should have `confidence < 0.40`

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-003: Category Fuzzy Matching

**Objective:** Verify Google Vision labels are fuzzy-matched to database categories

**Steps:**

1. Get list of active categories:
```sql
SELECT name FROM categories WHERE is_active = true;
```

2. Invoke `analyze-item-image` with a photo that should match one of these categories

3. Check if `category.value.categoryId` is NOT null (successful match)

**Expected Results:**

- ✅ If Vision label closely matches a category name, `categoryId` is set
- ✅ If no good match, `categoryId` is `null` but `label` contains Vision's suggestion
- ✅ Levenshtein distance ≤ 3 should result in a match

**Example:**
- Vision label: "Bycicle" → Should match category "Bicycle" (distance = 1)
- Vision label: "Toy Car" → Should match category "Toys" (distance = 4, might not match)

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-004: Google Vision 429 Retry Logic

**Objective:** Verify exponential backoff on rate limit errors

**Steps:**

1. This is difficult to test manually without hitting rate limits
2. Review edge function logs after invoking multiple requests quickly:

```bash
npx supabase functions logs analyze-item-image --project-ref <your-staging-project>
```

3. Look for retry messages like:
```
[analyze-item-image] Rate limited, retrying in 1000ms (attempt 1/3)
```

**Expected Results:**

- ✅ Function retries 3 times with delays: 1s, 2s, 4s
- ✅ After 3 failures, returns error response (not thrown exception)

**Status:** [ ] PASS / [ ] FAIL / [ ] SKIP (hard to test)

**Notes:**
_______________________________________________

---

### TC-005: Selective Field Extraction with requestFields

**Objective:** Verify `requestFields` parameter limits analysis

**Steps:**

1. Invoke with selective fields:
```json
{
  "photoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
  "sellerId": "test-seller-001",
  "requestFields": ["title", "color"]
}
```

**Expected Results:**

- ✅ Response has `title` and/or `color` (if confidence >= 0.40)
- ✅ Response still has `rawLabels`
- ✅ Other fields may or may not be present (function defaults to analyzing all)

**Note:** The `requestFields` parameter is a hint to the function but doesn't strictly filter output in current implementation.

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-006: Batch Analysis - Basic Flow

**Objective:** Verify `batch-analyze-items` processes multiple items correctly

**Steps:**

1. Open Supabase Dashboard → Edge Functions → `batch-analyze-items` → Invoke.
2. Confirm the endpoint path is `/functions/v1/batch-analyze-items` (NOT `/functions/v1/analyze-item-image`).
3. Invoke `batch-analyze-items` with this payload:
```json
{
  "items": [
    {
      "groupId": "group-1",
      "primaryPhotoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"
    },
    {
      "groupId": "group-2",
      "primaryPhotoUrl": "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=800"
    },
    {
      "groupId": "group-3",
      "primaryPhotoUrl": "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800"
    }
  ],
  "sellerId": "test-seller-001"
}
```

4. Optional CLI check (avoids dashboard function-selection mistakes):
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/batch-analyze-items" \
  -H "Authorization: Bearer <SERVICE_ROLE_OR_VALID_USER_JWT>" \
  -H "apikey: <SUPABASE_ANON_KEY_OR_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"groupId": "group-1", "primaryPhotoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"},
      {"groupId": "group-2", "primaryPhotoUrl": "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=800"},
      {"groupId": "group-3", "primaryPhotoUrl": "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800"}
    ],
    "sellerId": "test-seller-001"
  }'
```

**Expected Results:**

- ✅ Status: 200 OK
- ✅ Response has:
  ```json
  {
    "results": [
      { "groupId": "group-1", "analysis": {...} },
      { "groupId": "group-2", "analysis": {...} },
      { "groupId": "group-3", "analysis": {...} }
    ],
    "totalProcessed": 3,
    "totalFailed": 0
  }
  ```
- ✅ `results` array matches input order (group-1, group-2, group-3)
- ✅ Each result has either `analysis` OR `error`, not both
- ✅ Response time: < 15 seconds for 3 items

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-007: Batch Analysis - Concurrency Limiting

**Objective:** Verify max concurrency of 5 is enforced

**Steps:**

1. Invoke `batch-analyze-items` with 10 items:
```json
{
  "items": [
    {"groupId": "g1", "primaryPhotoUrl": "https://..."},
    {"groupId": "g2", "primaryPhotoUrl": "https://..."},
    ... // repeat for g3-g10
  ],
  "sellerId": "test-seller-001"
}
```

2. Check edge function logs for evidence of batching:
```bash
npx supabase functions logs batch-analyze-items --project-ref <your-staging-project>
```

**Expected Results:**

- ✅ Function processes items in batches, not all at once
- ✅ Logs show staggered timestamps (not all 10 starting simultaneously)
- ✅ Total time should be roughly: (10 items / 5 concurrent) * avg_time_per_item

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-008: Batch Analysis - Timeout Handling

**Objective:** Verify 10-second per-item timeout works

**Steps:**

1. Invoke with a very large image or slow URL:
```json
{
  "items": [
    {
      "groupId": "slow-1",
      "primaryPhotoUrl": "https://very-slow-server.com/huge-image.jpg"
    }
  ],
  "sellerId": "test-seller-001"
}
```

**Expected Results:**

- ✅ If item takes > 10 seconds, it returns:
  ```json
  {
    "groupId": "slow-1",
    "error": "timeout"
  }
  ```
- ✅ Function does NOT wait indefinitely
- ✅ Other items are NOT blocked by slow items

**Status:** [ ] PASS / [ ] FAIL / [ ] SKIP (hard to test)

**Notes:**
_______________________________________________

---

### TC-009: Batch Analysis - Partial Failure Tolerance

**Objective:** Verify failed items don't block successful ones

**Steps:**

1. Invoke with mix of valid and invalid URLs:
```json
{
  "items": [
    {"groupId": "valid-1", "primaryPhotoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"},
    {"groupId": "invalid", "primaryPhotoUrl": "https://invalid-url-that-does-not-exist.com/photo.jpg"},
    {"groupId": "valid-2", "primaryPhotoUrl": "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=800"}
  ],
  "sellerId": "test-seller-001"
}
```

**Expected Results:**

- ✅ Status: 200 OK (not 500)
- ✅ `totalProcessed`: 3
- ✅ `totalFailed`: 1 (or 2 if both invalids fail)
- ✅ `valid-1` and `valid-2` have `analysis` objects
- ✅ `invalid` has `error` field
- ✅ Failed item does NOT prevent success of others

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-010: Error Handling - Missing photoUrl

**Objective:** Verify validation of required fields

**Steps:**

1. Invoke `analyze-item-image` without photoUrl:
```json
{
  "sellerId": "test-seller-001"
}
```

**Expected Results:**

- ✅ Status: 400 Bad Request
- ✅ Error message mentions "photoUrl"

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-011: Error Handling - Missing sellerId

**Objective:** Verify sellerId is required

**Steps:**

1. Invoke without sellerId:
```json
{
  "photoUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"
}
```

**Expected Results:**

- ✅ Status: 400 Bad Request
- ✅ Error message mentions "sellerId"

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-012: Error Handling - Empty Items Array

**Objective:** Verify batch function requires non-empty items array

**Steps:**

1. Invoke `batch-analyze-items`:
```json
{
  "items": [],
  "sellerId": "test-seller-001"
}
```

**Expected Results:**

- ✅ Status: 400 Bad Request
- ✅ Error message mentions "items array"

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

### TC-013: CORS Headers

**Objective:** Verify CORS headers are present for client access

**Steps:**

1. Invoke function and check response headers
2. Or test OPTIONS preflight request

**Expected Results:**

- ✅ Response includes `Access-Control-Allow-Origin: *`
- ✅ OPTIONS request returns CORS headers

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
_______________________________________________

---

## Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Single image analysis | < 5s | _____ | [ ] |
| Batch 3 items | < 15s | _____ | [ ] |
| Batch 10 items | < 30s | _____ | [ ] |
| Confidence filtering | 100% accurate | _____ | [ ] |
| Partial failure handling | No blocking | _____ | [ ] |

---

## Common Issues & Solutions

### Issue 1: "Google Vision API key not configured"

**Cause:** `GOOGLE_VISION_API_KEY` environment variable not set

**Solution:**
```bash
# Set the secret in Supabase
npx supabase secrets set GOOGLE_VISION_API_KEY=<your-api-key> --project-ref <your-staging-project>
```

---

### Issue 2: Categories not matching

**Cause:** Database has no active categories OR Levenshtein distance too large

**Solution:**
- Verify categories exist: `SELECT * FROM categories WHERE is_active = true;`
- Check fuzzy match threshold (max distance = 3)

---

### Issue 3: All confidence scores < 0.40

**Cause:** Poor quality image or ambiguous content

**Solution:**
- Use higher resolution photos (>= 800px width)
- Use clear, well-lit photos
- Check `rawLabels` to see what Vision detected

---

### Issue 4: Batch analysis timing out

**Cause:** Too many items or slow Google Vision API

**Solution:**
- Reduce batch size to 5-10 items
- Check Google Vision API quota/rate limits
- Verify network connectivity to Vision API

---

## Test Summary

**Date Tested:** _______________________  
**Total Test Cases:** 13  
**Passed:** _______  
**Failed:** _______  
**Skipped:** _______  

**Overall Status:** [ ] READY FOR PRODUCTION / [ ] NEEDS FIXES

**Notes:**
_____________________________________________________
_____________________________________________________
_____________________________________________________

---

## Approval

**Tested By:** _________________________ Date: _________  
**Approved By:** _________________________ Date: _________

---

## Next Steps After Testing

1. [ ] Deploy functions to production Supabase
2. [ ] Update production environment with Google Vision API key
3. [ ] Monitor function logs for errors
4. [ ] Set up alerts for high error rates
5. [ ] Document any production-specific configuration
6. [ ] Proceed to LISTING-V3-003 (Services Layer)
