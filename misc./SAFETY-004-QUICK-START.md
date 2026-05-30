# SAFETY-004: Quick Start Guide

## ⚡ Fast Track to Deploy & Test

### Step 1: Apply Database Migration (2 minutes)

```bash
# Copy SQL from this file:
supabase/migrations/306_ai_moderation_logs_table.sql

# Paste into Supabase SQL Editor and run
```

**Verify:**
```sql
SELECT * FROM ai_moderation_logs LIMIT 1;
-- Expected: Empty table (no error)
```

---

### Step 2: Deploy Edge Function (1 minute)

```bash
cd p2p-kids-marketplace
supabase functions deploy moderate-image
```

**Expected output:**
```
moderate-image deployed successfully
```

---

### Step 3: Configure Google Vision API Key (3 minutes)

1. **Get API Key** (if you don't have one):
   - Go to: https://console.cloud.google.com/
   - Enable Cloud Vision API
   - Create API Key in Credentials section

2. **Add to Supabase:**
   - Go to: Supabase Dashboard → Edge Functions → Secrets
   - Add secret:
     - Key: `GOOGLE_VISION_API_KEY`
     - Value: `<your-api-key>`

---

### Step 4: Run Unit Tests (1 minute)

```bash
cd p2p-kids-marketplace
npm run test -- imageModeration.test.ts
```

**Expected:** ✅ All 10 tests pass

---

### Step 5: Test in Simulator (5 minutes)

**iOS:**
```bash
cd p2p-kids-marketplace
npm run ios
```

**Android:**
```bash
cd p2p-kids-marketplace
npm run android
```

**Manual Test:**
1. Login to app
2. Tap "Sell" tab → "Create Listing"
3. Fill in: Title, Price, Condition
4. Tap "Add Photos" → Select 1 image
5. Tap "Publish Listing"
6. ✅ **Expected:** Success message, listing created

---

### Step 6: Verify Moderation Ran (2 minutes)

**In Supabase SQL Editor:**

```sql
-- Get latest moderation log
SELECT 
  item_id,
  image_url,
  decision,
  flagged,
  confidence_score,
  details
FROM ai_moderation_logs 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Fields:**
- `decision` = `'approved'` (for safe image)
- `flagged` = `false`
- `confidence_score` < 0.5
- `details` → JSON with Google Vision scores

---

## 🧪 Optional: Run E2E Tests

```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- safety-004-image-moderation.e2e.test.ts
```

**Expected:** ✅ All 6 tests pass

---

## 🤖 Optional: Run Maestro Flow

```bash
cd p2p-kids-marketplace
npm run test:maestro:ios -- safety-004-image-moderation
```

---

## 📝 Full Manual Test Cases

For comprehensive testing, see: `SAFETY-004-MANUAL-TESTING-GUIDE.md` (10 test cases)

---

## ✅ Success Criteria

- [x] Database migration applied (no errors)
- [x] Edge Function deployed successfully
- [x] Google Vision API key configured
- [x] Unit tests pass (10/10)
- [x] Moderation runs on image upload (verified in DB)
- [x] Listing created successfully (not blocked)

---

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `GOOGLE_VISION_API_KEY not configured` | Add API key to Supabase Edge Function secrets |
| Migration error | Check if table already exists; migration is idempotent (safe to re-run) |
| Function not found | Run `supabase functions list` to verify deployment |
| No moderation logs | Check Metro logs for errors; verify GOOGLE_VISION_API_KEY is valid |

---

## 📚 Related Docs

- **Full Implementation:** `SAFETY-004-IMPLEMENTATION-SUMMARY.md`
- **Manual Test Guide:** `SAFETY-004-MANUAL-TESTING-GUIDE.md`
- **Module Spec:** `Prompts/MODULE-13-SAFETY-COMPLIANCE.md`
- **Verification:** `Prompts/MODULE-13-VERIFICATION.md`

---

**Total Time: ~15 minutes to deploy & verify**
