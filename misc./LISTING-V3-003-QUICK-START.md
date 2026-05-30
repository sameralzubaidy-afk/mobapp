# LISTING-V3-003 QUICK START GUIDE

**Last Updated**: 2026-04-23  
**Task**: Services Layer Implementation  
**Time to Complete**: 15-30 minutes

---

## Prerequisites Check (2 minutes)

### 1. Verify SQL Migrations Applied

Open Supabase Dashboard → SQL Editor, run:

```sql
SELECT 
  table_name,
  EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) as exists
FROM (VALUES 
  ('item_bulk_uploads'),
  ('item_drafts')
) AS t(table_name);
```

**Expected Output**:
```
item_bulk_uploads | true
item_drafts       | true
```

**If FALSE**: Apply migrations from `supabase/migrations/20260420000003_*.sql` and `20260420000004_*.sql`

### 2. Verify Edge Functions Deployed

```bash
# Check functions exist
npx supabase functions list --project-ref <your-project-ref>
```

**Expected**: Should see `analyze-item-image` and `batch-analyze-items` in list

**If missing**: Deploy from LISTING-V3-002 task first

---

## Tier 0: Local Validation (5 minutes)

### Step 1: Typecheck

```bash
cd p2p-kids-marketplace
yarn typecheck
```

**Expected**: ✅ No errors

**If fails**: Check for duplicate exports or type mismatches

### Step 2: Lint

```bash
yarn lint
```

**Expected**: ✅ No errors or warnings

**If fails**: Run `yarn lint --fix` to auto-fix

### Step 3: Unit Tests

```bash
npm test -- --testPathPattern=services
```

**Expected**: ✅ All 109 tests pass in <30 seconds

**If fails**: Check error messages - likely import issues or mock setup

---

## Tier 1: Integration Tests (10 minutes)

### Step 1: Set Environment

Create `.env.test` if not exists:

```bash
cd p2p-kids-marketplace
cat > .env.test << EOF
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
TEST_SELLER_ID=<get from SQL below>
EOF
```

### Step 2: Get Test Seller ID

In Supabase SQL Editor:

```sql
-- Get or create test seller
INSERT INTO auth.users (email, encrypted_password)
VALUES ('test-listing-v3@example.com', crypt('test123', gen_salt('bf')))
ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
RETURNING id;
```

Copy the returned `id` and set as `TEST_SELLER_ID` in `.env.test`

### Step 3: Run Integration Tests

```bash
RUN_SUPABASE_E2E=true npm run test:e2e
```

**Expected**: ✅ 9 test suites pass in <60 seconds

**Common Issues**:
- Network timeout → Increase timeout in test file
- Auth error → Verify TEST_SELLER_ID is valid
- Storage error → Check Supabase storage bucket permissions

---

## Manual Spot Check (10 minutes)

### Quick Verification (5 critical test cases)

**TC1**: Photo validation

```bash
# Start app
expo start
# In simulator: Sell → Create Listing → Photo-First
# Select 1 photo
```

**Expected**: ✅ Photo appears in grid, no errors

---

**TC2**: AI analysis

```bash
# Continue from TC1
# Tap "Analyze Photos"
```

**Expected**: ✅ Progress indicator → AI suggestions appear with confidence badges

---

**TC3**: Draft save

```bash
# Continue from TC2
# Tap "Save as Draft"
```

**Expected**: ✅ Toast "Draft saved", navigates to My Listings

---

**TC4**: Price suggestions

```bash
# Create new listing
# Select category "Toys"
# Navigate to Price step
```

**Expected**: ✅ 4 price tiers shown (if ≥5 toys sold in DB) OR empty state message

---

**TC5**: Condition guides

```bash
# Continue from TC4
# Navigate to Condition step
```

**Expected**: ✅ 5 condition cards shown with emojis (new, like_new, good, fair, worn)

---

## Maestro Flows (Optional - 5 minutes)

### Install Maestro

```bash
# macOS
brew install maestro

# Or
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Run Flows

```bash
# Start iOS simulator first
open -a Simulator

# Run all V3 flows
maestro test .maestro/listing-v3-photo-upload.yaml
maestro test .maestro/listing-v3-draft-resume-bulk-publish.yaml
maestro test .maestro/listing-v3-ai-review-price-condition.yaml
```

**Expected**: ✅ All flows pass with green checkmarks

**Note**: Maestro requires actual photo selection - may need to manually select photos during test

---

## Troubleshooting

### "Cannot find module 'expo-image-manipulator'"

```bash
cd p2p-kids-marketplace
npm install expo-image-manipulator@11.0.0
```

### "Supabase RPC 'merge_item_draft' does not exist"

This is expected - service falls back to client-side JSONB merge. Migration for RPC will be added in LISTING-V3-004.

### "Color palette not found"

Ensure MODULE-05 V3 migrations applied:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'items' 
AND column_name IN ('color', 'brand', 'age_group', 'gender');
```

Should return 4 rows.

### "Integration tests timeout"

Increase timeout in test file:

```typescript
// In e2e/listing-v3-services.integration.test.ts
it('should upload photos', async () => {
  // ...
}, 60000); // Increase from 30000 to 60000
```

---

## Success Criteria

✅ **You can proceed if**:
- Tier 0 (typecheck + lint + unit tests) ALL PASS
- At least 1 integration test suite passes
- At least 3 of 5 manual spot checks work

❌ **Do NOT proceed if**:
- Any Tier 0 check fails
- All integration tests fail (likely environment issue)
- Cannot load app in simulator (build errors)

---

## Next Steps After Verification

1. ✅ Mark checkboxes in `LISTING-V3-003-VERIFICATION-STATUS.md`
2. Create PR with description linking to verification doc
3. Request code review
4. After approval, merge to `main`
5. Deploy to staging
6. Proceed to LISTING-V3-004 (Hooks & Types)

---

## Quick Commands Cheat Sheet

```bash
# All Tier 0 checks in one go
cd p2p-kids-marketplace && \
  yarn typecheck && \
  yarn lint && \
  npm test -- --testPathPattern=services

# Integration tests
RUN_SUPABASE_E2E=true npm run test:e2e

# Watch mode for development
npm test -- --watch --testPathPattern=photoService

# Coverage report
npm test -- --coverage --testPathPattern=services

# Maestro batch
maestro test .maestro/listing-v3-*.yaml
```

---

## Support

**Issues?** Check:
1. `LISTING-V3-003-MANUAL-TESTING-GUIDE.md` - Full test cases with expected results
2. `LISTING-V3-003-VERIFICATION-STATUS.md` - Complete verification mapping
3. `docs/flow-registry.md` - LISTING-V3-003 entry for dependencies

**Still stuck?** Open issue with:
- Which step failed
- Exact error message
- Environment details (OS, Node version, Expo SDK version)
