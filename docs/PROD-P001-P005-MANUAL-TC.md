# Manual Test Cases — PROD-P001 (iOS Privacy) & PROD-P005 (COPPA Enforcement)

Phase 2 of MODULE-15.5 Production Readiness. These tests verify privacy
descriptions/manifests for iOS App Store submission and server-side COPPA
enforcement for users under 13.

> **Consolidation note:** A single master manual-TC file will be produced at the
> end of MODULE-15.5 (per user request). Until then, each phase keeps its own
> per-phase doc.

---

## PROD-P001 — iOS Privacy & Android Permissions

### TC-P001-01 — iOS prebuild generates Info.plist with all NSUsageDescription keys

**Pre-conditions:**
- macOS with Xcode CLI tools installed
- `cd p2p-kids-marketplace`

**Steps:**
1. Run `npx expo prebuild --platform ios --clean` (will regenerate `ios/`).
2. Open `ios/p2pkidsmarketplace/Info.plist`.

**Expected:**
- Contains `NSCameraUsageDescription` with copy "Pass It Up uses your camera so you can take photos of items you'd like to pass on or sell."
- Contains `NSPhotoLibraryUsageDescription`.
- Contains `NSPhotoLibraryAddUsageDescription`.
- Contains `NSLocationWhenInUseUsageDescription`.
- Contains `NSUserTrackingUsageDescription`.
- Contains `<key>ITSAppUsesNonExemptEncryption</key><false/>`.

### TC-P001-02 — iOS prebuild generates PrivacyInfo.xcprivacy

**Steps:**
1. After the prebuild from TC-P001-01, check `ios/p2pkidsmarketplace/PrivacyInfo.xcprivacy`.

**Expected:**
- File exists.
- `NSPrivacyTracking` = `false`.
- `NSPrivacyAccessedAPITypes` includes the 4 entries: UserDefaults (CA92.1), FileTimestamp (C617.1), DiskSpace (E174.1), SystemBootTime (35F9.1).
- `NSPrivacyCollectedDataTypes` has 8 entries (Email, Phone, CoarseLocation, Photos, PurchaseHistory, UserID, CrashData, PerformanceData).
- No entry has `NSPrivacyCollectedDataTypeTracking` = `true`.

### TC-P001-03 — Android prebuild generates AndroidManifest with all permissions

**Steps:**
1. `npx expo prebuild --platform android --clean`.
2. Open `android/app/src/main/AndroidManifest.xml`.

**Expected:**
- Contains `<uses-permission android:name="android.permission.CAMERA"/>`.
- Contains `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`.
- Contains `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- Contains `POST_NOTIFICATIONS`.

### TC-P001-04 — Runtime permission prompt copy on iOS

**Steps:**
1. Build a dev client (`npx expo run:ios`) and launch on a real device or simulator.
2. Trigger camera flow (Create Listing → Take Photo).

**Expected:**
- System prompt shows the kid-friendly Pass It Up camera copy, not the default placeholder.

---

## PROD-P005 — COPPA Server-Side Enforcement

All tests run against project `drntwgporzabmxdqykrp` (dev). Use Supabase SQL Editor.

### TC-P005-01 — Adult (>=13) is compliant

```sql
-- Replace with a real adult user_id from profiles
SELECT public.is_coppa_compliant(
  (SELECT user_id FROM profiles WHERE dob IS NOT NULL AND dob < CURRENT_DATE - INTERVAL '13 years' LIMIT 1)
) AS result;
```
**Expected:** `result = true`.

### TC-P005-02 — Minor without consent is NOT compliant

```sql
SELECT public.is_coppa_compliant(
  (SELECT user_id FROM profiles
   WHERE dob > CURRENT_DATE - INTERVAL '13 years'
     AND COALESCE(parental_consent_verified, FALSE) = FALSE
   LIMIT 1)
) AS result;
```
**Expected:** `result = false`. If no such test user exists, create one:
```sql
-- Example seed (dev only)
INSERT INTO profiles (user_id, dob, parental_consent_verified)
VALUES (gen_random_uuid(), CURRENT_DATE - INTERVAL '10 years', FALSE)
RETURNING user_id;
```

### TC-P005-03 — Minor WITH consent IS compliant

```sql
SELECT public.is_coppa_compliant(
  (SELECT user_id FROM profiles
   WHERE dob > CURRENT_DATE - INTERVAL '13 years'
     AND parental_consent_verified = TRUE
   LIMIT 1)
) AS result;
```
**Expected:** `result = true`.

### TC-P005-04 — Listing INSERT is blocked for unconsented minor

```sql
-- Use the unconsented minor user_id from TC-P005-02
DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT user_id INTO v_uid FROM profiles
  WHERE dob > CURRENT_DATE - INTERVAL '13 years'
    AND COALESCE(parental_consent_verified, FALSE) = FALSE
  LIMIT 1;

  BEGIN
    INSERT INTO items (seller_id, title, price) VALUES (v_uid, 'Test Block', 1.00);
    RAISE NOTICE 'FAIL: insert was allowed';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'PASS: %', SQLERRM;
  END;
END $$;
```
**Expected:** NOTICE starts with `PASS: COPPA_CONSENT_REQUIRED: Parental consent is required for users under 13 to create listings`.

### TC-P005-05 — Trade INSERT is blocked for unconsented minor

```sql
DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT user_id INTO v_uid FROM profiles
  WHERE dob > CURRENT_DATE - INTERVAL '13 years'
    AND COALESCE(parental_consent_verified, FALSE) = FALSE
  LIMIT 1;

  BEGIN
    INSERT INTO trades (buyer_id, seller_id, item_id, status)
    VALUES (v_uid, gen_random_uuid(), gen_random_uuid(), 'pending');
    RAISE NOTICE 'FAIL: insert was allowed';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'PASS: %', SQLERRM;
  END;
END $$;
```
**Expected:** NOTICE starts with `PASS: COPPA_CONSENT_REQUIRED: Parental consent is required for users under 13 to initiate trades`.

### TC-P005-06 — Audit row in debug_logs after a block

```sql
SELECT process_name, message, payload->>'action' AS action, payload->>'user_id' AS user_id, created_at
FROM debug_logs
WHERE process_name = 'coppa_enforcement'
ORDER BY created_at DESC
LIMIT 5;
```
**Expected:** Most recent rows correspond to the blocks performed in TC-P005-04/05.

### TC-P005-07 — Fail-closed: user with no profile

```sql
SELECT public.is_coppa_compliant('00000000-0000-0000-0000-000000000099'::uuid) AS result;
```
**Expected:** `result = false`. *(Verified automatically during deploy.)*

### TC-P005-08 — Fail-closed: NULL user

```sql
SELECT public.is_coppa_compliant(NULL::uuid) AS result;
```
**Expected:** `result = false`. *(Verified automatically during deploy.)*

---

## Rollback

### PROD-P001
Revert `app.json` to the previous commit. No native code is committed (Expo
managed); a fresh prebuild will use the reverted config.

### PROD-P005
```sql
DROP TRIGGER IF EXISTS trigger_coppa_check_item_insert ON public.items;
DROP TRIGGER IF EXISTS trigger_coppa_check_trade_insert ON public.trades;
DROP FUNCTION IF EXISTS public.check_coppa_before_item_insert();
DROP FUNCTION IF EXISTS public.check_coppa_before_trade_insert();
DROP FUNCTION IF EXISTS public.enforce_coppa(UUID, TEXT);
DROP FUNCTION IF EXISTS public.is_coppa_compliant(UUID);
```
