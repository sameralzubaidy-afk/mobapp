# DISCOVERY-V3-008: Quick Test Commands

## Copy-Paste Commands for Testing

### 1. Unit Tests

```bash
cd p2p-kids-marketplace
npm run test:unit
```

### 2. E2E Integration Tests (Staging)

```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=integration/discovery-v3
```

### 3. Performance Test

```bash
cd p2p-kids-marketplace
npm run test:perf:search
```

### 4. Maestro Flows - iOS

```bash
cd p2p-kids-marketplace

# Run all 3 new flows
npm run test:maestro:ios -- .maestro/search-filters.yaml
npm run test:maestro:ios -- .maestro/search-autocomplete.yaml
npm run test:maestro:ios -- .maestro/search-empty-state.yaml

# Plus existing filter modal flow
npm run test:maestro:ios -- .maestro/discovery-v3-006-filter-modal.yaml
```

### 5. Maestro Flows - Android

```bash
cd p2p-kids-marketplace

# Run all 3 new flows
npm run test:maestro:android -- .maestro/search-filters.yaml
npm run test:maestro:android -- .maestro/search-autocomplete.yaml
npm run test:maestro:android -- .maestro/search-empty-state.yaml

# Plus existing filter modal flow
npm run test:maestro:android -- .maestro/discovery-v3-006-filter-modal.yaml
```

---

## Pre-Test SQL Verification (Run in Supabase SQL Editor)

### Check Filter Columns Exist

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'items' 
  AND column_name IN ('age_group', 'gender', 'brand', 'color')
ORDER BY column_name;
```

**Expected:** 4 rows

### Check search_listings RPC Signature

```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'search_listings';
```

**Expected:** Should show 13 parameters

### Check get_popular_brands RPC Exists

```sql
SELECT proname, prosrc
FROM pg_proc 
WHERE proname = 'get_popular_brands' 
  AND pronamespace = 'public'::regnamespace;
```

**Expected:** 1 row

### Check Indexes

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'items'
  AND indexname LIKE 'idx_items_%'
ORDER BY indexname;
```

**Expected:** Should include idx_items_age_group, idx_items_gender, idx_items_brand, idx_items_color, idx_items_price, idx_items_category_price

---

## All Tests in One Go

```bash
cd p2p-kids-marketplace

# 1. Unit tests
echo "=== Running Unit Tests ==="
npm run test:unit

# 2. E2E integration (if staging configured)
if [ -f ".env.staging" ]; then
  echo "=== Running E2E Integration Tests ==="
  RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=integration/discovery-v3
fi

# 3. Performance test (if staging configured)
if [ -f ".env.staging" ]; then
  echo "=== Running Performance Test ==="
  npm run test:perf:search
fi

# 4. Maestro flows (iOS) - requires simulator running
echo "=== Running Maestro Flows (iOS) ==="
npm run test:maestro:ios -- .maestro/search-filters.yaml
npm run test:maestro:ios -- .maestro/search-autocomplete.yaml
npm run test:maestro:ios -- .maestro/search-empty-state.yaml
npm run test:maestro:ios -- .maestro/discovery-v3-006-filter-modal.yaml

echo "=== All Tests Complete ==="
```

---

## Manual Testing Checklist

See `DISCOVERY-V3-008-MANUAL-TESTING-GUIDE.md` for detailed manual test cases.

Quick checklist:
- [ ] TC-011: Search debounce is 200ms
- [ ] TC-012: Optimistic UI (old results remain during fetch)
- [ ] TC-013: Filter chips display correctly
- [ ] TC-014: Removing chip updates results
- [ ] TC-015: Clear all filters works
- [ ] TC-016: Recent searches max 8 (LRU)
- [ ] TC-017: Case-insensitive deduplication
- [ ] TC-018: Brand autocomplete ≥ 2 chars
- [ ] TC-019: Typo suggestion ("Did you mean...")
- [ ] TC-020: Network error handling

---

## Test Data Setup (Optional)

If staging DB needs more test data:

```sql
-- Insert test items with all filter columns populated
INSERT INTO items (
  title, description, price, seller_id, category_id, node_id,
  status, condition, accepts_swap_points,
  age_group, gender, brand, color
)
SELECT 
  'Test Item ' || i,
  'Test description',
  (random() * 100)::NUMERIC(10,2),
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM categories ORDER BY random() LIMIT 1),
  (SELECT id FROM nodes ORDER BY random() LIMIT 1),
  'available',
  (ARRAY['like_new', 'used_good', 'used_fair'])[floor(random() * 3 + 1)],
  random() > 0.5,
  (ARRAY['0-2', '3-5', '6-8', '9-12', '13+'])[floor(random() * 5 + 1)],
  (ARRAY['boy', 'girl', 'unisex'])[floor(random() * 3 + 1)],
  (ARRAY['LEGO', 'Barbie', 'Hot Wheels', 'Fisher-Price', 'Mattel'])[floor(random() * 5 + 1)],
  ARRAY[(ARRAY['red', 'blue', 'green', 'yellow', 'pink', 'purple'])[floor(random() * 6 + 1)]]
FROM generate_series(1, 100) AS i;
```

---

## Troubleshooting

### Issue: Unit tests fail with "Cannot find module '@supabase/supabase-js'"

**Fix:**
```bash
cd p2p-kids-marketplace
npm install
```

### Issue: E2E tests skip with message "RUN_SUPABASE_E2E not set"

**Fix:**
Ensure `.env.staging` exists with valid credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Then run:
```bash
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=integration/discovery-v3
```

### Issue: Performance test fails with "Database has < 10k items"

**Fix:**
This is a warning, not an error. Test will still run, but performance results may not be representative.

To add more test data, run the test data setup SQL above.

### Issue: Maestro flow fails with "Element not found"

**Fix:**
Ensure all required `testID` props are added to UI components. See Maestro YAML files for required testIDs.

Example missing testIDs:
- `discover-screen`
- `discover-search-input`
- `discover-filter-button`
- etc.

---

## Success Criteria

All tests should pass:
- ✅ Unit tests: 0 failures, ≥85% coverage
- ✅ E2E integration: All tests pass
- ✅ Performance: p95 < 200ms
- ✅ Maestro flows: All 4 flows pass on iOS and Android
- ✅ Manual tests: All 20 test cases verified

---

**Good luck with testing! 🚀**
