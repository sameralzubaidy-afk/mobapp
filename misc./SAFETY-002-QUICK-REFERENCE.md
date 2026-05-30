# SAFETY-002: CPSC Recall Matching - Quick Reference

**Status**: ✅ Implementation Complete - Ready for Testing  
**Date**: 2024-01-XX

---

## 📂 Files Created/Modified

### Database
- ✅ `supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql` (NEW)

### Edge Functions
- ✅ `supabase/functions/check-item-safety/index.ts` (NEW)
- ✅ `supabase/functions/check-item-safety/__tests__/index.unit.test.ts` (NEW)

### Mobile App
- ✅ `p2p-kids-marketplace/src/services/safety.ts` (NEW)
- ✅ `p2p-kids-marketplace/src/services/listing.ts` (MODIFIED - added CPSC check integration)
- ✅ `p2p-kids-marketplace/src/services/__tests__/safety.test.ts` (NEW)
- ✅ `p2p-kids-marketplace/src/__tests__/e2e/cpsc-recall-matching.e2e.test.ts` (NEW)
- ✅ `p2p-kids-marketplace/.maestro/safety-002-cpsc-recall-matching.yaml` (NEW)

### Documentation
- ✅ `SAFETY-002-MANUAL-TESTING-GUIDE.md` (NEW)
- ✅ `SAFETY-002-IMPLEMENTATION-SUMMARY.md` (NEW)
- ✅ `SAFETY-002-QUICK-REFERENCE.md` (NEW - this file)
- ✅ `scripts/deploy-safety-002.sh` (NEW - deployment helper)
- ✅ `docs/flow-registry.md` (MODIFIED - updated FLOW-16)

---

## 🚀 Quick Deploy Commands

### 1. Deploy Database Migration
```bash
# Open Supabase Dashboard → SQL Editor
# Copy/paste: supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql
# Click "Run"

# Or use CLI (if on local/staging):
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
supabase db push
```

**Verify**:
```sql
SELECT * FROM item_safety_flags LIMIT 1;
SELECT * FROM check_cpsc_recalls('test', NULL);
```

### 2. Deploy Edge Function
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
supabase functions deploy check-item-safety
```

**Verify**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-item-safety \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"itemId":"test","title":"Wooden blocks"}'
```

Expected: `{"success":true,"flagged":false,...}`

### 3. Configure Admin Settings (Optional)
```sql
-- Enable CPSC checking
INSERT INTO admin_config (key, value) VALUES ('cpsc_check_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- Set threshold (0.0-1.0)
INSERT INTO admin_config (key, value) VALUES ('cpsc_match_threshold', '0.5')
ON CONFLICT (key) DO UPDATE SET value = '0.5';
```

---

## 🧪 Quick Test Commands

### Unit Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm run test:unit -- safety.test.ts
```

### E2E Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- cpsc-recall-matching.e2e.test.ts
```

### Edge Function Tests (Deno)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/supabase/functions/check-item-safety
deno test --allow-env --allow-net __tests__/index.unit.test.ts
```

### Maestro UI Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# iOS
npm run test:maestro:ios -- .maestro/safety-002-cpsc-recall-matching.yaml

# Android
npm run test:maestro:android -- .maestro/safety-002-cpsc-recall-matching.yaml
```

---

## 🔍 Quick Verification Queries

### Check if Migration Deployed
```sql
-- item_safety_flags table exists?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'item_safety_flags'
);
-- Expected: true

-- check_cpsc_recalls function exists?
SELECT EXISTS (
  SELECT FROM information_schema.routines 
  WHERE routine_name = 'check_cpsc_recalls'
);
-- Expected: true
```

### Test CPSC Matching
```sql
-- Test with recalled product
SELECT * FROM check_cpsc_recalls('Fisher-Price Rock n Play', NULL);
-- Expected: 1+ rows with high similarity_score if recall exists

-- Test with safe product
SELECT * FROM check_cpsc_recalls('wooden building blocks', 'safe toy');
-- Expected: 0 rows or low similarity_score
```

### View Safety Flags
```sql
-- All pending flags
SELECT * FROM item_safety_flags WHERE status = 'pending';

-- Flags for specific item
SELECT * FROM item_safety_flags WHERE item_id = '<item-uuid>';

-- Flag stats
SELECT 
  flag_type, 
  status, 
  COUNT(*) as count 
FROM item_safety_flags 
GROUP BY flag_type, status;
```

### Check Admin Config
```sql
SELECT key, value 
FROM admin_config 
WHERE key IN ('cpsc_check_enabled', 'cpsc_match_threshold');
```

---

## 📝 Key Functions Reference

### Mobile App (src/services/safety.ts)

```typescript
// Check item against CPSC recalls
const result = await checkItemSafety(itemId, title, description);
// Returns: { success, flagged, reason, match, confidence }

// Get safety flags for item
const flags = await getItemSafetyFlags(itemId);
// Returns: ItemSafetyFlag[]

// Get all pending flags (admin only)
const pending = await getPendingSafetyFlags();
// Returns: ItemSafetyFlag[]

// Check if CPSC checking is enabled
const enabled = await isCpscCheckEnabled();
// Returns: boolean (default: true)

// Get match threshold
const threshold = await getCpscMatchThreshold();
// Returns: number (default: 0.5)
```

### Database (check_cpsc_recalls function)

```sql
-- Check title and description against recalls
SELECT * FROM check_cpsc_recalls(
  'Fisher-Price Rock n Play',  -- p_title
  'baby sleeper product'        -- p_description (optional)
);

-- Returns columns: recall_id, recall_number, product_name, 
--                  hazards, recall_date, similarity_score
```

---

## 🎯 Success Criteria Checklist

- [ ] Migration 305 deployed (item_safety_flags table + check_cpsc_recalls function)
- [ ] Edge Function deployed (check-item-safety)
- [ ] Unit tests pass (npm run test:unit)
- [ ] E2E tests pass (RUN_SUPABASE_E2E=true npm run test:e2e)
- [ ] Deno tests pass (deno test)
- [ ] Maestro tests pass (iOS/Android)
- [ ] Manual testing complete (7/7 test cases in SAFETY-002-MANUAL-TESTING-GUIDE.md)
- [ ] Flow registry updated (docs/flow-registry.md FLOW-16)
- [ ] Documentation complete (SAFETY-002-IMPLEMENTATION-SUMMARY.md)

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| `SAFETY-002-IMPLEMENTATION-SUMMARY.md` | Complete implementation details, architecture, files created, dependencies |
| `SAFETY-002-MANUAL-TESTING-GUIDE.md` | 7 detailed manual test cases with SQL verification queries |
| `SAFETY-002-QUICK-REFERENCE.md` | This file - quick commands and verification queries |
| `scripts/deploy-safety-002.sh` | Deployment helper with step-by-step SQL verification |
| `docs/flow-registry.md` | FLOW-16 documentation with smoke tests and tier classification |
| `Prompts/MODULE-13-SAFETY-COMPLIANCE.md` | Original task specification (SAFETY-002) |
| `Prompts/MODULE-13-VERIFICATION.md` | Verification checklist for MODULE-13 tasks |

---

## 🐛 Troubleshooting

### Issue: check_cpsc_recalls returns no results
**Solution**: Verify cpsc_recalls table has data:
```sql
SELECT COUNT(*) FROM cpsc_recalls;
```
If empty, run CPSC import: `supabase functions invoke import-cpsc-recalls`

### Issue: Edge Function returns 500 error
**Solution**: Check logs in Supabase Dashboard → Edge Functions → check-item-safety → Logs

### Issue: Item not getting flagged
**Solution**: Check threshold and match score:
```sql
-- Test match score
SELECT * FROM check_cpsc_recalls('<your-title>', '<your-description>');

-- Check threshold setting
SELECT value FROM admin_config WHERE key = 'cpsc_match_threshold';

-- If similarity_score < threshold, item won't be flagged
```

### Issue: CPSC check disabled
**Solution**: Enable in admin_config:
```sql
UPDATE admin_config SET value = 'true' WHERE key = 'cpsc_check_enabled';
```

---

## 🔗 Related Tasks

- **SAFETY-001** (Complete): CPSC Recall Imports - populates cpsc_recalls table
- **SAFETY-P003** (Complete): Item Flagged/Rejected Status - extends items.status
- **SAFETY-003** (Pending): Pattern-based prohibited item detection
- **SAFETY-005** (Pending): Admin moderation UI for flagged items
- **SAFETY-008** (Pending): Seller notification system for flagged items

---

## ✅ Next Steps

1. **Deploy to Production**:
   - Run migration 305 in Supabase SQL Editor
   - Deploy Edge Function via CLI
   - Configure admin_config settings

2. **Run All Tests**:
   - Unit tests (npm run test:unit)
   - E2E tests (RUN_SUPABASE_E2E=true npm run test:e2e)
   - Maestro tests (iOS/Android)

3. **Manual Testing**:
   - Follow SAFETY-002-MANUAL-TESTING-GUIDE.md
   - Complete all 7 test cases
   - Get QA sign-off

4. **Monitor in Production**:
   - Check Supabase logs for CPSC check errors
   - Monitor item_safety_flags table for flagged items
   - Verify false positive rate (adjust threshold if needed)

---

_Quick reference complete. See SAFETY-002-IMPLEMENTATION-SUMMARY.md for full details._
