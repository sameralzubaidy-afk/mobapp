# NODE-001 & NODE-002 Quick Start Guide

**Quick Test in 5 Minutes**

## ⚡ Pre-Flight (Do Once)

```bash
# 1. Apply database migration
# Go to: https://app.supabase.com/projects/drntwgporzabmxdqykrp/sql/new
# Paste: supabase/migrations/20251216_create_geographic_nodes_table.sql
# Click: Execute

# 2. Setup admin role (one time)
# Replace YOUR_USER_ID with your auth.users.id
# Paste in SQL editor:
INSERT INTO role_based_access_control (user_id, role)
VALUES ('YOUR_USER_ID', 'admin')
ON CONFLICT DO NOTHING;

# 3. Install & Build
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm install
npm run type-check
npm run lint
```

## 🚀 Run & Test

```bash
# 1. Start admin app
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run dev

# 2. Open browser
open http://localhost:3001/nodes

# 3. Test NODE-001 (Create/Edit)
# - Click "+ Add Node"
# - Enter: Name="Test", ZIP="06850"
# - Wait 2 seconds (auto-lookup)
# - Click "Create Node"
# - ✅ Should see new node in table

# 4. Test NODE-002 (Toggle)
# - Find test node
# - Click "Deactivate"
# - Confirm dialog
# - ✅ Status should change to Inactive

# 5. Test Reactivate
# - Click "Activate"
# - Confirm dialog
# - ✅ Status should change to Active
```

## 📊 Verify Everything Works

```bash
# Type check
npm run type-check
# Expected: No errors

# Lint
npm run lint
# Expected: No errors

# E2E Tests
npm test -- nodes.e2e.test.ts
# Expected: All tests pass
```

## 🔍 Database Verification

```sql
-- In Supabase SQL Editor:

-- Check table exists
SELECT COUNT(*) FROM geographic_nodes;

-- Check node created
SELECT id, name, is_active FROM geographic_nodes 
WHERE name = 'Test' LIMIT 1;

-- Check audit logged
SELECT action, entity_type FROM admin_audit_log 
WHERE entity_type = 'geographic_node'
ORDER BY created_at DESC LIMIT 5;
```

## 📁 Files to Review

1. **Main Page:** `p2p-kids-admin/src/app/nodes/page.tsx` (254 lines)
2. **Form Modal:** `p2p-kids-admin/src/app/nodes/NodeFormModal.tsx` (298 lines)
3. **Database Schema:** `supabase/migrations/20251216_create_geographic_nodes_table.sql` (56 lines)
4. **Types:** `p2p-kids-admin/src/types/nodes.ts` (48 lines)
5. **Tests:** `p2p-kids-admin/src/app/nodes/__tests__/nodes.e2e.test.ts` (307 lines)

## ✅ Verification Checklist (Quick)

- [ ] Database migration applied
- [ ] Admin role assigned
- [ ] App builds: `npm run type-check` passes
- [ ] App lints: `npm run lint` passes
- [ ] Dev server starts: `npm run dev` works
- [ ] Page loads: `http://localhost:3001/nodes`
- [ ] Stats cards visible
- [ ] "+ Add Node" button works
- [ ] Can create node with ZIP lookup
- [ ] Can toggle activation
- [ ] Status changes in UI
- [ ] E2E tests pass: `npm test -- nodes.e2e.test.ts`

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "Loading nodes..." forever | Check RLS policy, admin role, database migration |
| ZIP lookup not working | Check internet, try different ZIP (06850), enter manually |
| Form not submitting | Check browser console (F12), verify all fields filled |
| Toggle not working | Check admin role, RLS policy, try refreshing page |
| Tests fail | Check dev server running, database migration applied |

## 📚 Full Documentation

See complete guides:
- **Setup & Testing:** [NODE-001-002-SETUP-AND-TESTING.md](NODE-001-002-SETUP-AND-TESTING.md)
- **Verification Checklist:** [NODE-001-002-VERIFICATION-CHECKLIST.md](NODE-001-002-VERIFICATION-CHECKLIST.md)
- **Implementation Summary:** [NODE-001-002-IMPLEMENTATION-SUMMARY.md](NODE-001-002-IMPLEMENTATION-SUMMARY.md)

---

**Ready to test!** Follow the steps above in order. ✅
