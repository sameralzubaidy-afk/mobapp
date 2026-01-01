# PAY-008 QUICK REFERENCE

## 🚀 ONE-COMMAND VERIFICATION

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
chmod +x scripts/verify-pay-008.sh && ./scripts/verify-pay-008.sh
```

---

## 📱 MOBILE APP - Seller Earnings

**File:** `p2p-kids-marketplace/src/screens/seller/SellerEarningsScreen.tsx`

**Route:** `SellerEarnings`

**How to Access:**
1. Log in as seller
2. Navigate to Profile → Earnings (you'll need to add a menu link)

**Features:**
- Last 20 payouts
- Total/Pending earnings summary
- Status badges (color-coded)
- Pull-to-refresh
- Empty & error states

---

## 💻 ADMIN PORTAL - Payouts Management

**File:** `p2p-kids-admin/src/app/payouts/earnings/page.tsx`

**URL:** `http://localhost:3001/payouts/earnings`

**Features:**
- Stats dashboard (5 metrics)
- Search by seller/trade/user ID
- Filter by status
- Detail modal
- Retry failed payouts
- Export CSV

---

## 🧪 TESTING

### Tier 0 (Required First)
```bash
./scripts/verify-pay-008.sh
```

### Unit Tests
```bash
cd p2p-kids-marketplace
yarn test src/__tests__/screens/SellerEarningsScreen.test.tsx
```

### E2E Tests
```bash
cd p2p-kids-admin
npx playwright install  # First time only
npx playwright test __tests__/admin-payouts-earnings.e2e.test.ts
```

### Manual Tests
**See:** `PAY-008-MANUAL-TEST-CASES.md` (32 test cases)

---

## 📋 BEFORE YOU START TESTING

### 1. Verify Database
```sql
-- Run in Supabase SQL Editor
SELECT status, COUNT(*) FROM seller_payouts GROUP BY status;
```

**Need:** At least 5-10 payouts in various states

### 2. Check Environment Variables
- Mobile: `.env.local` with Supabase URL + anon key
- Admin: `.env.local` with Supabase URL + anon key + service role key

---

## 📄 KEY DOCUMENTS

1. **PAY-008-COMPLETION-REPORT.md** - Full implementation report
2. **PAY-008-IMPLEMENTATION-SUMMARY.md** - Technical details
3. **PAY-008-MANUAL-TEST-CASES.md** - Manual test guide

---

## ✅ CHECKLIST

- [ ] Run `./scripts/verify-pay-008.sh` → All pass
- [ ] Run unit tests → 11 tests pass
- [ ] Run E2E tests → 14 tests pass
- [ ] Manual test mobile app → 15 cases pass
- [ ] Manual test admin portal → 15 cases pass
- [ ] Mark PAY-008 complete in `MODULE-06-VERIFICATION-V2.md`

---

## 🆘 TROUBLESHOOTING

### "No payouts found"
→ Insert test data in `seller_payouts` table

### "lucide-react not found" (admin)
→ Fixed - now using inline SVG icons

### Mobile route not accessible
→ Add menu item in Profile screen linking to `SellerEarnings` route

### Tests fail
→ Check mock data, verify imports, ensure Supabase client configured

---

**Status:** ✅ Implementation Complete  
**Next:** Run verification script
