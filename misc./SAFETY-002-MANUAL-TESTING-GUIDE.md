# SAFETY-002: CPSC Recall Matching Logic - Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-002 - Check Item Title/Description Against Recall Database  
**Date:** March 29, 2026  
**Platform:** iOS Simulator & Android Emulator

---

## 📋 Prerequisites

Before testing, verify the following:

### Database Setup
1. ✅ Migration 305 applied: `305_item_safety_flags_and_cpsc_matching.sql`
2. ✅ CPSC recalls imported: Check `cpsc_recalls` table has data
3. ✅ Edge Function deployed: `check-item-safety`
4. ✅ Feature enabled: `admin_config.cpsc_recall_check_enabled = 'true'`

### Verification Queries (Run in Supabase SQL Editor)

```sql
-- Check item_safety_flags table exists
SELECT COUNT(*) FROM item_safety_flags;

-- Check CPSC recalls imported
SELECT COUNT(*) FROM cpsc_recalls;
SELECT * FROM cpsc_recalls ORDER BY recall_date DESC LIMIT 5;

-- Check check_cpsc_recalls function exists
SELECT * FROM check_cpsc_recalls('Fisher-Price Baby Toy', NULL);

-- Check config
SELECT * FROM admin_config WHERE key = 'cpsc_recall_check_enabled';
```

### App Setup
1. ✅ App built and running in iOS Simulator or Android Emulator
2. ✅ Test user logged in as seller (Kids Club+ or Free tier)
3. ✅ Network connection enabled (for Edge Function calls)

---

## 🧪 Test Cases

### TEST CASE 1: Safe Item (No CPSC Match) ✅

**Objective:** Verify that safe items pass CPSC check and are listed without flagging.

**Steps:**
1. Open app and log in as test seller
2. Navigate to "Create Listing" tab
3. Enter listing details:
   - **Title:** `Generic LEGO Building Block Set 100 Pieces`
   - **Description:** `Standard building blocks, safe for children ages 4+, no small parts`
   - **Price:** `$25.00`
   - **Condition:** `New`
   - **Category:** `Toys`
4. Upload at least one photo (required)
5. Tap "Create Listing" button

**Expected Results:**
- ✅ Success message: "Listing created successfully"
- ✅ Listing status = `available`
- ✅ NO flagging notification appears
- ✅ Listing visible in "My Listings" with status "Active"
- ✅ Console log (check Xcode/Android Studio):
  ```
  [listing] ✅ Listing {id} passed CPSC safety check
  ```

**Verification:**
- Check Supabase `items` table:
  ```sql
  SELECT id, title, status, flagged_at FROM items WHERE title ILIKE '%LEGO%' ORDER BY created_at DESC LIMIT 1;
  ```
  - `status` should be `available`
  - `flagged_at` should be `NULL`

---

### TEST CASE 2: Flagged Item (High-Confidence CPSC Match) ⚠️

**Objective:** Verify that items matching recalled products are auto-flagged.

**Steps:**
1. Navigate to "Create Listing" tab
2. Enter listing details with a title/description matching a known recall:
   - **Title:** `Fisher-Price Rock-a-Stack Baby Toy`
   - **Description:** `Classic stacking rings toy for infants, colorful plastic rings with center post`
   - **Price:** `$9.99`
   - **Condition:** `Good`
   - **Category:** `Toys`
3. Upload at least one photo
4. Tap "Create Listing" button
5. Wait 3-5 seconds for CPSC check to complete

**Expected Results:**
- ✅ Success message: "Listing created successfully" (creation doesn't block)
- ⏳ Within 3-5 seconds:
  - ⚠️ Push notification or in-app notification: "Item Under Review 🔍"
  - ⚠️ Notification body: "Your listing 'Fisher-Price Rock-a-Stack...' is under safety review."
- ✅ Listing status changed to `flagged`
- ✅ Listing visible in "My Listings" with status badge "Under Review"
- ✅ Console logs:
  ```
  [listing] ⚠️ Listing {id} flagged for CPSC recall match: cpsc_recall
  [listing] Match: Fisher-Price ... (confidence: 0.85)
  ```

**Verification:**
- Check Supabase `items` table:
  ```sql
  SELECT id, title, status, flagged_at FROM items WHERE title ILIKE '%Fisher-Price%' ORDER BY created_at DESC LIMIT 1;
  ```
  - `status` should be `flagged`
  - `flagged_at` should have timestamp

- Check `item_safety_flags` table:
  ```sql
  SELECT * FROM item_safety_flags WHERE item_id = '{item_id}';
  ```
  - Should have 1 row with:
    - `flag_type` = `'cpsc_recall'`
    - `status` = `'pending'`
    - `confidence_score` > `0.5`
    - `recall_id` NOT NULL

- Check `notifications` table:
  ```sql
  SELECT * FROM notifications WHERE user_id = '{seller_id}' AND type = 'item_flagged' ORDER BY created_at DESC LIMIT 1;
  ```
  - Should have notification with title "Item Under Review"

---

### TEST CASE 3: Moderate Match (Below Threshold) ℹ️

**Objective:** Verify that low-confidence matches don't trigger auto-flagging.

**Steps:**
1. Navigate to "Create Listing" tab
2. Enter listing details with generic/common words:
   - **Title:** `Plastic Baby Toy Set`
   - **Description:** `Assorted plastic toys for toddlers`
   - **Price:** `$12.00`
   - **Condition:** `Fair`
   - **Category:** `Toys`
3. Upload at least one photo
4. Tap "Create Listing" button

**Expected Results:**
- ✅ Success message: "Listing created successfully"
- ✅ Listing status = `available` (NOT flagged)
- ✅ NO notification sent
- ℹ️ Console may show low similarity scores but no flagging:
  ```
  [listing] Match score 0.35 below threshold 0.5, not flagging
  ```

**Verification:**
- Check Supabase `items` table:
  ```sql
  SELECT id, title, status, flagged_at FROM items WHERE title ILIKE '%Plastic Baby%' ORDER BY created_at DESC LIMIT 1;
  ```
  - `status` should be `available`
  - `flagged_at` should be `NULL`

---

### TEST CASE 4: CPSC Check Disabled (Feature Flag) 🔌

**Objective:** Verify that CPSC checking can be disabled via admin config.

**Setup:**
1. Disable CPSC checking in Supabase SQL Editor:
   ```sql
   UPDATE admin_config SET value = 'false' WHERE key = 'cpsc_recall_check_enabled';
   ```

**Steps:**
1. Restart app (to clear any cached config)
2. Log in as test seller
3. Navigate to "Create Listing" tab
4. Enter listing details (any title):
   - **Title:** `Test Item While CPSC Disabled`
   - **Description:** `This should not trigger CPSC check`
   - **Price:** `$10.00`
   - **Condition:** `New`
5. Upload photo
6. Tap "Create Listing" button

**Expected Results:**
- ✅ Listing created successfully
- ✅ Listing status = `available`
- ✅ Console log:
  ```
  [listing] CPSC recall checking is disabled via admin config
  ```
- ✅ NO CPSC check Edge Function called

**Cleanup:**
- Re-enable CPSC checking:
  ```sql
  UPDATE admin_config SET value = 'true' WHERE key = 'cpsc_recall_check_enabled';
  ```

---

### TEST CASE 5: Error Handling (Edge Function Failure) ❌

**Objective:** Verify that listing creation succeeds even if CPSC check fails.

**Setup:**
1. Temporarily pause check-item-safety Edge Function (simulate network error):
   - In Supabase Dashboard → Edge Functions → Pause `check-item-safety`
   - OR disable network in simulator

**Steps:**
1. Navigate to "Create Listing" tab
2. Enter listing details:
   - **Title:** `Error Handling Test Item`
   - **Description:** `Testing resilience to CPSC check failure`
   - **Price:** `$15.00`
   - **Condition:** `New`
3. Upload photo
4. Tap "Create Listing" button

**Expected Results:**
- ✅ Listing created successfully (fire-and-forget, doesn't block)
- ✅ Listing status = `available`
- ❌ Console error:
  ```
  [listing] ❌ CPSC safety check failed for listing {id}: Network error
  ```
- ✅ App does NOT crash
- ✅ User can continue using app normally

**Cleanup:**
- Resume Edge Function or re-enable network

---

### TEST CASE 6: Notifications Screen (Seller View) 📬

**Objective:** Verify that flagged listing notification appears correctly.

**Prerequisites:**
- Complete TEST CASE 2 (create flagged listing)

**Steps:**
1. Tap "Notifications" tab (bell icon)
2. Look for notification with title: "Item Under Review 🔍"
3. Tap the notification

**Expected Results:**
- ✅ Notification shows:
  - Title: "Item Under Review 🔍"
  - Body: "Your listing 'Fisher-Price...' is under safety review."
  - Timestamp: Recent
- ✅ Tapping notification navigates to listing details screen
- ✅ Listing details screen shows:
  - Status badge: "Under Review" or "Flagged"
  - Warning icon
  - Message: "This item is being reviewed for safety compliance."

---

### TEST CASE 7: Admin View (Pending Safety Flags) 👮

**Objective:** Verify admin can view pending safety flags for review.

**Prerequisites:**
- Complete TEST CASE 2 (create flagged listing)
- Log in as admin user

**Steps:**
1. Navigate to Admin Panel (admin-only tab or web portal)
2. Go to "Safety Flags" or "Flagged Items" section
3. View pending flags

**Expected Results:**
- ✅ Flagged listing appears in list
- ✅ Shows:
  - Item title
  - Flag reason: "Possible CPSC recall match: [product_name]"
  - Confidence score: e.g., 0.85
  - Recall details: Product name, manufacturer, hazard
  - Status: "Pending"
- ✅ Admin can view recall details
- ✅ Admin can approve/reject flag

---

## 📊 Success Criteria Summary

| Criterion | Status |
|-----------|--------|
| ✅ Safe items pass CPSC check | PASS/FAIL |
| ⚠️ High-confidence matches auto-flagged | PASS/FAIL |
| ℹ️ Low-confidence matches NOT flagged | PASS/FAIL |
| 📬 Seller notified when item flagged | PASS/FAIL |
| ✅ Listing creation never blocked | PASS/FAIL |
| ❌ CPSC check failures don't crash app | PASS/FAIL |
| 🔌 Feature can be disabled via config | PASS/FAIL |
| 👮 Admin can view pending flags | PASS/FAIL |

---

## 🐛 Known Issues & Workarounds

### Issue 1: CPSC Check Takes Too Long
- **Symptom:** Notification doesn't appear for 10+ seconds
- **Workaround:** Check Edge Function logs for performance issues

### Issue 2: No CPSC Recalls in Database
- **Symptom:** No matches found even for known recalled brands
- **Solution:** Run CPSC import function manually:
  ```bash
  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/import-cpsc-recalls \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
  ```

### Issue 3: Notifications Not Appearing
- **Symptom:** Item flagged in DB but no notification sent
- **Solution:** Verify trigger `tr_notify_seller_on_item_flag` exists and is enabled

---

## 📝 Notes for QA Team

1. **CPSC Database Dependency:** Test results depend on which recalls are in the database. Fisher-Price and other major brands should have multiple recalls.

2. **Confidence Threshold:** Default is 0.5 (50%). Can be adjusted via admin config:
   ```sql
   UPDATE admin_config SET value = '0.65' WHERE key = 'cpsc_match_threshold';
   ```

3. **Fire-and-Forget Design:** The CPSC check runs AFTER listing creation to avoid blocking the user. The notification may appear a few seconds later.

4. **False Positives:** Generic titles like "Baby Toy" may trigger false positives. Admin review workflow handles this.

5. **Test Data Cleanup:** After testing, clean up test listings:
   ```sql
   DELETE FROM items WHERE title ILIKE '%Test%' OR title ILIKE '%Generic LEGO%';
   ```

---

## ✅ Sign-Off

- [ ] All test cases executed
- [ ] Results documented
- [ ] Bugs filed (if any)
- [ ] QA Lead approval

**Tested By:** ________________  
**Date:** ________________  
**Build:** ________________  
**Notes:** ________________
