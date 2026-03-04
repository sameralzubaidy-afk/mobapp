# SUB-014 Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Run SQL Migration (Required)
**Copy/paste in Supabase SQL Editor (Production):**
```bash
# Open: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# Run: /supabase/migrations/20260303000000_create_billing_history_sub_014.sql
```

**Verify:**
```sql
SELECT COUNT(*) FROM billing_history; -- Should work (returns 0 initially)
```

---

### 2. Run Tests (Verify Implementation)

**Unit Tests (3 minutes):**
```bash
cd p2p-kids-marketplace
npm test src/services/__tests__/billingHistory.test.ts
```
✅ Expected: 13/13 passed

**E2E Tests (5 minutes):**
```bash
export TEST_USER_ID="your-user-id"       # Get from Supabase auth.users
export TEST_SUBSCRIPTION_ID="your-sub-id"  # Get from subscriptions table
npm test src/__tests__/e2e/billing-history-sub-014.e2e.ts
```
✅ Expected: 18/18 passed

---

### 3. Usage Examples

**Create billing record (typically from webhook):**
```typescript
import { createBillingRecord } from './src/services/billingHistory';

await createBillingRecord({
  user_id: userId,
  subscription_id: subscriptionId,
  charge_id: 'ch_stripe_123',
  stripe_invoice_id: 'in_stripe_456',
  amount: 499, // $4.99 in cents
  status: 'succeeded',
  description: 'Kids Club+ Monthly - March 2026',
});
```

**Fetch user's billing history:**
```typescript
import { getBillingHistory } from './src/services/billingHistory';

const records = await getBillingHistory({ 
  user_id: userId,
  limit: 10,
});

console.log(`Found ${records.length} billing records`);
```

**Get billing summary:**
```typescript
import { getBillingHistorySummary } from './src/services/billingHistory';

const summary = await getBillingHistorySummary(userId);
console.log(`Total charged: $${summary.total_amount_cents / 100}`);
console.log(`Failed charges: ${summary.failed_charges}`);
```

---

## 📚 Full Documentation

- **Implementation Summary:** `/SUB-014-IMPLEMENTATION-SUMMARY.md`
- **Manual Test Guide:** `/SUB-014-MANUAL-TEST-CASES.md` (20 test cases)
- **Migration:** `/supabase/migrations/20260303000000_create_billing_history_sub_014.sql`
- **Types:** `/p2p-kids-marketplace/src/types/billingHistory.types.ts`
- **Service:** `/p2p-kids-marketplace/src/services/billingHistory.ts`

---

## 🎯 What's Next

**SUB-015: Stripe Webhook Integration**
- Listen for Stripe billing events
- Auto-create billing_history records
- Update subscription status on payment failure/success

**SUB-016: Billing History UI**
- Mobile screen to view past charges
- Receipt/invoice display
- Status indicators (success/failure/refund)

**SUB-017: Admin Billing Dashboard**
- View all billing across users
- Export billing data
- Reconcile with Stripe

---

## ✅ Quick Verification

```sql
-- 1. Table exists
SELECT * FROM billing_history LIMIT 1;

-- 2. RLS enabled
SELECT rowsecurity FROM pg_tables WHERE tablename = 'billing_history';

-- 3. Indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'billing_history';

-- 4. Test insert (replace user_id and subscription_id)
INSERT INTO billing_history (user_id, subscription_id, charge_id, amount, status)
VALUES ('your-user-id', 'your-sub-id', 'ch_test_quickstart', 499, 'succeeded')
RETURNING *;

-- 5. Cleanup test
DELETE FROM billing_history WHERE charge_id = 'ch_test_quickstart';
```

---

## 🚀 Ready!

✅ Database schema deployed  
✅ Service layer ready  
✅ Tests passing  
✅ Documented

**Next action:** Run manual test cases from `SUB-014-MANUAL-TEST-CASES.md`
