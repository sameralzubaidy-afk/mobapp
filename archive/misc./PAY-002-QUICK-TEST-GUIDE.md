# PAY-002 Quick Test Commands

## ⚠️ BEFORE TESTING - Run This SQL First!

```bash
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Copy entire file: supabase/migrations/074_admin_payout_fee_config.sql
# 4. Paste and Execute
```

---

## Tier 0 Tests (MUST pass before manual testing)

### Admin Portal
```bash
cd p2p-kids-admin

# Install dependencies (first time only)
npm install

# Type check
npm run type-check

# Lint check
npm run lint

# Build check
npm run build
```

**Expected:** All commands exit with code 0 (no errors)

---

## Unit Tests

```bash
cd p2p-kids-admin

# Run all tests
npm test

# Run only payout fee tests
npm test payoutFees

# Watch mode
npm test:watch
```

**Expected:** 24/24 tests passing

---

## E2E Tests (requires Supabase connection)

```bash
cd p2p-kids-admin

# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Run E2E tests
npm run test:e2e
```

**Expected:** 15+ tests passing

---

## Start Admin Portal

```bash
cd p2p-kids-admin

# Development mode
npm run dev

# Navigate to: http://localhost:3001/payouts
```

---

## Quick Smoke Test

1. ✅ SQL migration executed in Supabase
2. ✅ Tier 0 checks pass
3. ✅ Navigate to `http://localhost:3001/payouts`
4. ✅ Page loads with 7 config items
5. ✅ Fee calculator shows calculations for $100
6. ✅ Edit one value and click Save
7. ✅ Success message appears
8. ✅ Calculator updates with new value

---

## Verification Queries (Run in Supabase SQL Editor)

```sql
-- 1. Verify config exists
SELECT key, value, description FROM admin_config 
WHERE category = 'payout_fees' ORDER BY key;
-- Expected: 7 rows

-- 2. Test RPC
SELECT * FROM get_payout_fee_config();
-- Expected: 1 row with 7 columns

-- 3. Test Stripe fee calculation
SELECT calculate_payout_fee_cents('stripe_connect', 10000);
-- Expected: 50

-- 4. Test PayPal fee calculation
SELECT calculate_payout_fee_cents('paypal', 5000);
-- Expected: 100

-- 5. Test PayPal cap
SELECT calculate_payout_fee_cents('paypal', 200000);
-- Expected: 2000

-- 6. Test net calculation
SELECT compute_net_payout_cents(10000, 0, 50);
-- Expected: 9950

-- 7. Test negative prevention
SELECT compute_net_payout_cents(1000, 900, 200);
-- Expected: 0 (not negative)
```

---

## Troubleshooting

### Tests fail with "Missing Supabase environment variables"
**Solution:** Create `.env.local` file in `p2p-kids-admin/`:
```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Page shows "Failed to load configuration"
**Solution:** Check:
1. SQL migration was executed
2. Supabase connection working
3. Service role key is correct

### Calculator shows wrong values
**Solution:**
1. Refresh page (force reload: Cmd+Shift+R)
2. Check browser console for errors
3. Verify RPC functions exist in database

### Type check fails
**Solution:**
```bash
cd p2p-kids-admin
rm -rf node_modules .next
npm install
npm run type-check
```

---

## Success Criteria

✅ **Tier 0:** All checks pass (type-check, lint, build)  
✅ **Unit Tests:** 24/24 passing  
✅ **E2E Tests:** 15+/15+ passing  
✅ **Manual Test:** Admin can view/edit fees, calculator works  
✅ **Database:** All RPC functions return expected values

---

**Need Help?**
- Check: [PAY-002-IMPLEMENTATION-SUMMARY.md](./PAY-002-IMPLEMENTATION-SUMMARY.md)
- Manual Test Guide: [MANUAL_TEST_PAY-002.md](./MANUAL_TEST_PAY-002.md)
