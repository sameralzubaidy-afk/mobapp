# BADGES-V2-003 Quick Deployment Guide

**⚠️ RUN THESE COMMANDS IN ORDER**

---

## Step 1: Apply SQL Migration

```bash
# Copy this file path:
# /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260110000002_trade_badges.sql

# Go to Supabase Dashboard > SQL Editor
# Paste the entire contents of the migration file
# Click "Run" (or press Cmd+Enter)
```

**Verify:**
```sql
-- Check if trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_check_trade_badges';

-- Should return 1 row
```

---

## Step 2: Deploy Edge Function

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/functions

# Deploy the function
npx supabase functions deploy award-tenure-badges
```

**Expected Output:**
```
Deploying Functions...
├─ award-tenure-badges
│  ✓ Deployed
```

---

## Step 3: Set Up Cron Job

1. Go to **Supabase Dashboard** > **Database** > **Cron Jobs**
2. Click **"Add new job"** or **"Create cron job"**
3. Enter:
   - **Name:** `award-tenure-badges-daily`
   - **Schedule:** `0 2 * * *` (runs daily at 2 AM UTC)
   - **Command:**
   
```sql
SELECT net.http_post(
  url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/award-tenure-badges',
  headers:='{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
  body:='{}'::jsonb
) as request_id;
```

⚠️ **Replace:**
- `YOUR_PROJECT_REF` with your actual project reference (e.g., `abcdefghijklmnop`)
- `YOUR_ANON_KEY` with your Supabase anon key (from Project Settings > API)

4. Click **"Create"** or **"Save"**

---

## Step 4: Test Edge Function Manually

```bash
# Test the function (replace with your values)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/award-tenure-badges \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 5,
  "errors": 0,
  "total": 5
}
```

---

## Step 5: Run Tests

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Set environment variables
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_ANON_KEY="YOUR_ANON_KEY"

# Run unit tests
npm test src/__tests__/badges/trade-badges.test.ts
npm test src/__tests__/badges/subscription-badges.test.ts

# Run E2E tests
npm test src/__tests__/e2e/badges-v2-003.e2e.ts
```

---

## Step 6: Manual Verification

### 6.1 Test Trade Badge (Quick)

```sql
-- In Supabase SQL Editor:

-- 1. Get a test user ID (replace with actual user)
SELECT id, email FROM auth.users LIMIT 1;

-- 2. Simulate trade completion (replace user_id values)
INSERT INTO trades (buyer_id, seller_id, item_id, cash_amount_cents, status)
VALUES 
  ('<user_id_1>', '<user_id_2>', '<existing_item_id>', 1000, 'completed')
RETURNING id;

-- 3. Check if badge was awarded
SELECT 
  u.email,
  b.name as badge_name,
  b.threshold,
  ub.awarded_at
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
JOIN auth.users u ON ub.user_id = u.id
WHERE b.category = 'trades'
ORDER BY ub.awarded_at DESC
LIMIT 5;
```

### 6.2 Test Subscription Badge (Quick)

```sql
-- Award badge for user with 35 days of subscription
SELECT award_badge_if_eligible('<user_id>', 'subscription', 35);

-- Verify
SELECT b.name, b.threshold 
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
WHERE ub.user_id = '<user_id>' AND b.category = 'subscription';

-- Should show: Trial Member (0), 1-Month Subscriber (30)
```

---

## Step 7: Test in Mobile App

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Start iOS Simulator
npm run start:ios

# OR start Android Emulator
npm run start:android
```

**Manual Test:**
1. Log in as a test user
2. Complete a trade (if possible) OR use SQL to set user's trade count to 1
3. Navigate to Profile screen
4. Verify badges appear in BadgeShowcase component

---

## Troubleshooting

### Issue: Trigger not firing
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_check_trade_badges';

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'check_trade_badges';

-- Re-create trigger if needed
DROP TRIGGER IF EXISTS trigger_check_trade_badges ON trades;
CREATE TRIGGER trigger_check_trade_badges
AFTER UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION check_trade_badges();
```

### Issue: Edge Function fails
```bash
# Check function logs
npx supabase functions logs award-tenure-badges

# Verify environment variables
npx supabase secrets list
```

### Issue: Tests fail
```bash
# Make sure .env.local exists with correct values:
# SUPABASE_URL=https://...
# SUPABASE_ANON_KEY=...

# Clear test cache
npm test -- --clearCache
```

---

## Checklist

- [ ] Migration applied in Supabase SQL Editor
- [ ] Trigger `trigger_check_trade_badges` exists
- [ ] Edge Function `award-tenure-badges` deployed
- [ ] Cron job created (runs daily at 2 AM UTC)
- [ ] Manual Edge Function test returns success
- [ ] Unit tests pass
- [ ] E2E tests pass (or skipped if environment not ready)
- [ ] Manual SQL verification shows badges awarded
- [ ] Mobile app displays badges in profile

---

**Status:** ☐ All steps completed successfully

**Date:** __________  
**By:** __________
