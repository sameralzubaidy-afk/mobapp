# ADMIN-V3-006: SP Analytics Dashboard — Quick Start Guide

**🎯 Goal:** Test the new SP Analytics Dashboard page in 5 minutes

---

## ⚡ Quick Test Path (5 minutes)

### Step 1: Run Tier 0 Tests (2 min)

```bash
cd p2p-kids-admin
npm run typecheck && npm run lint && npm run test:unit
```

**Expected:** All commands exit 0 with no errors ✅

---

### Step 2: Start Dev Server (1 min)

```bash
cd p2p-kids-admin
npm run dev
```

**Expected:** Server starts at `http://localhost:3000`

---

### Step 3: Test SP Analytics Page (2 min)

1. **Navigate to page:**
   - Open: `http://localhost:3000/sp-analytics`
   - OR click sidebar: **Settings → SP Analytics**

2. **Verify components load:**
   - ✅ Date range picker shows 3 buttons (7 / 30 / 90 days)
   - ✅ Metrics table displays or shows "No data"
   - ✅ Anomaly alerts panel shows "All Healthy" or flagged categories

3. **Test interactions:**
   - Click "Last 7 Days" → table updates
   - Click "Last 90 Days" → table updates
   - Click "Export CSV" → file downloads

4. **Test deep-linking:**
   - Click any category row → navigates to `/categories?edit={id}&tab=sp-config`

**Expected:** All interactions work without errors ✅

---

## 📋 Files Created/Modified Summary

### New Files (13)

**UI Components (5):**
- `p2p-kids-admin/src/app/sp-analytics/page.tsx`
- `p2p-kids-admin/src/components/spconfig/SPAnalyticsDashboard.tsx`
- `p2p-kids-admin/src/components/spconfig/SPMetricsTable.tsx`
- `p2p-kids-admin/src/components/spconfig/SPAnomalyAlerts.tsx`
- `p2p-kids-admin/src/components/spconfig/DateRangePicker.tsx`

**Tests (6):**
- `p2p-kids-admin/src/__tests__/components/spconfig/DateRangePicker.test.tsx`
- `p2p-kids-admin/src/__tests__/components/spconfig/SPAnomalyAlerts.test.tsx`
- `p2p-kids-admin/src/__tests__/components/spconfig/SPMetricsTable.test.tsx`
- `p2p-kids-admin/src/__tests__/components/spconfig/SPAnalyticsDashboard.test.tsx`
- `p2p-kids-admin/src/__tests__/e2e/sp-analytics.e2e.ts`
- `.maestro/admin-sp-analytics-dashboard.yaml`

**Documentation (2):**
- `ADMIN-V3-006-MANUAL-TESTING-GUIDE.md`
- `ADMIN-V3-006-IMPLEMENTATION-SUMMARY.md`
- `ADMIN-V3-006-VERIFICATION-STATUS.md` (this file)

### Modified Files (3)

- `p2p-kids-admin/src/components/layout/Sidebar.tsx` (+1 line: SP Analytics nav link)
- `docs/flow-registry.md` (+25 lines: ADMIN-V3-006 entry)
- `p2p-kids-marketplace/maestro-flows-registry.md` (+1 line: Maestro flow entry)

---

## 🧪 Test Commands Cheat Sheet

```bash
# Tier 0 (always run)
cd p2p-kids-admin
npm run typecheck  # TypeScript compile check
npm run lint       # ESLint check
npm run test:unit  # All unit tests

# Tier 1 (when analytics or category config changes)
RUN_SUPABASE_E2E=true npm run test:e2e  # Integration tests
npm run test:maestro:ios .maestro/admin-sp-analytics-dashboard.yaml  # Maestro flow

# Manual testing
# See ADMIN-V3-006-MANUAL-TESTING-GUIDE.md (20 test cases)
```

---

## ✅ Acceptance Criteria (Quick Check)

| # | Criterion | Test Method | ✓ |
|---|-----------|-------------|---|
| 1 | Route `/admin/sp-analytics` works | Navigate to page | ☐ |
| 2 | Date range selector (7/30/90 days) | Click buttons | ☐ |
| 3 | Metrics table shows data | View table | ☐ |
| 4 | Anomaly alerts display | View alerts panel | ☐ |
| 5 | Deep-link to category edit | Click row | ☐ |
| 6 | CSV export works | Click Export CSV | ☐ |
| 7 | Page loads < 1s | Check E2E test TC-016 | ☐ |

---

## 🐛 Troubleshooting

### Issue: "No data" in table

**Cause:** No transaction data in selected date range

**Fix:**
```sql
-- Check for transaction data in Supabase SQL Editor
SELECT 
  c.name,
  COUNT(*) as transaction_count
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.status = 'sold'
  AND i.created_at >= NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name;
```

**Expected:** At least 3 categories with 5+ transactions

**If empty:** Seed test data or use longer date range

---

### Issue: Deep-link navigation fails

**Cause:** ADMIN-V3-004 (CategoryManagementPage) not yet implemented

**Expected behavior:** Navigation to `/categories?edit={id}&tab=sp-config` may show 404 or fall back to categories list

**Fix:** Implement ADMIN-V3-004 or verify manually that URL contains correct query params

---

### Issue: Typecheck fails with "cannot find module"

**Cause:** Missing dependencies or incorrect import paths

**Fix:**
```bash
# 1. Verify dependencies installed
cd p2p-kids-admin && npm install

# 2. Check imports use correct paths (relative vs @/ alias)
# All components should use: import { ... } from '@/...'

# 3. Re-run typecheck
npm run typecheck
```

---

### Issue: CSV export downloads but is empty

**Cause:** Analytics data is empty array

**Expected:** CSV should still have headers even if no data rows

**Example:**
```csv
Category ID,Category Name,Velocity,Gap %,Avg Cash Per Trade,Anomaly Flags
```

**Fix:** This is expected behavior when no data exists for date range

---

## 📊 Sample Data for Testing

If your staging DB has insufficient data, run this SQL to seed sample categories and transactions:

```sql
-- This is a sample query to check what you have
-- DO NOT run this if you have production data!

-- 1. Check categories
SELECT id, name, sp_earning_multiplier, sp_spending_cap_percent 
FROM categories 
WHERE is_active = true 
LIMIT 5;

-- 2. Check for recent transactions
SELECT 
  i.id,
  i.category_id,
  i.status,
  i.created_at
FROM items i
WHERE i.status = 'sold'
  AND i.created_at >= NOW() - INTERVAL '30 days'
LIMIT 10;

-- If insufficient, you'll need to create test listings and mark them as sold
-- (This is outside scope of this quick start - see manual test guide for details)
```

---

## 🎬 Next Steps

1. ✅ **Quick test** (this guide) — 5 minutes
2. **Full manual test** — `ADMIN-V3-006-MANUAL-TESTING-GUIDE.md` (20 test cases) — 30 minutes
3. **Tier 1 verification** — Run E2E + Maestro flows — 10 minutes
4. **Code review** — Assign to team member
5. **Merge PR** — After Tier 0 + review passes

---

## 📚 Related Documentation

- **Implementation Summary:** `ADMIN-V3-006-IMPLEMENTATION-SUMMARY.md`
- **Manual Testing Guide:** `ADMIN-V3-006-MANUAL-TESTING-GUIDE.md`
- **Verification Mapping:** `ADMIN-V3-006-VERIFICATION-STATUS.md`
- **Task Specification:** `Prompts/V3/MODULE-12-ADMIN-V3-CATEGORIES.md` (TASK ADMIN-V3-006)
- **Verification File:** `Prompts/V3/MODULE-12-VERIFICATION-V3.md` (Section 4)

---

**Quick start completed:** April 29, 2026  
**Estimated time to test:** 5 minutes  
**Ready for:** Immediate testing
