# CRON JOB FIX: scheduled_award_tenure_badges Error

## ERROR REPORTED
```
ERROR:  column "tier" does not exist
LINE 1: SELECT user_id, created_at, status, tier
                                            ^
QUERY:  SELECT user_id, created_at, status, tier
    FROM subscriptions
    WHERE status IN ('trial', 'active')
CONTEXT:  PL/pgSQL function scheduled_award_tenure_badges() line 8 at FOR over SELECT rows
```

## ROOT CAUSE
The cron job `scheduled_award_tenure_badges()` was querying for a `tier` column that **does not exist** in the `subscriptions` table.

### Subscriptions Table Actual Schema
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('free', 'trial', 'active', 'grace', 'canceled', 'expired')),
  
  -- Trial info
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Period tracking
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ  -- Added in 20260112000003
)
```

**There is NO `tier` column.** Subscription tier/status is stored in the `status` enum column.

## SOLUTION IMPLEMENTED
Created migration file: `20260123000000_fix_scheduled_award_tenure_badges.sql`

### What it does:
1. **Creates the missing `scheduled_award_tenure_badges()` function** with correct column references
2. **Uses correct logic**:
   - Queries subscriptions with correct `status` values (no `tier` column)
   - Calculates subscription tenure using:
     - `(COALESCE(canceled_at, NOW()) - created_at)` to get days subscribed
     - Works for both active and canceled subscriptions
   - Awards badges retroactively based on tenure thresholds (30 days, 180 days, 365 days)
3. **Schedules the cron job** to run daily at midnight UTC

### Function Query Logic
```sql
SELECT 
  s.user_id,
  EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 as days_subscribed
FROM subscriptions s
WHERE s.status IN ('trial', 'active', 'grace', 'canceled', 'expired')
  AND days_subscribed >= v_badge_threshold
```

## HOW TO DEPLOY

### Option 1: Using Supabase SQL Editor (Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire content of `20260123000000_fix_scheduled_award_tenure_badges.sql`
3. Paste and run the SQL
4. Verify with these queries:

```sql
-- Test the function works
SELECT public.scheduled_award_tenure_badges();

-- Check subscription tenure badges exist
SELECT name, category, threshold, is_active
FROM badges
WHERE category = 'subscription'
ORDER BY threshold;

-- Verify cron job is scheduled
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'award-tenure-badges-daily';
```

### Option 2: Using Supabase CLI
```bash
# Apply the migration
supabase db push

# Or manually with psql
psql -h <HOST> -U postgres -d <DATABASE> -f supabase/migrations/20260123000000_fix_scheduled_award_tenure_badges.sql
```

## EXPECTED RESULTS
After deployment:
- ✅ Cron job will no longer throw "column tier does not exist" error
- ✅ Daily at midnight UTC, the function will award subscription tenure badges
- ✅ Users with 30+ days subscription get "1-Month Subscriber" badge
- ✅ Users with 180+ days subscription get "6-Month Subscriber" badge
- ✅ Users with 365+ days subscription get "1-Year Subscriber" badge

## VERIFICATION CHECKLIST
- [ ] Migration file created: `20260123000000_fix_scheduled_award_tenure_badges.sql`
- [ ] Function `scheduled_award_tenure_badges()` exists
- [ ] Cron job `award-tenure-badges-daily` is scheduled
- [ ] Cron job runs without errors
- [ ] Badges table has subscription category badges
- [ ] `user_badges` table has entries after cron execution
- [ ] No column reference errors in database logs

## NOTES
- **Tenure Calculation**: Uses `(canceled_at OR NOW()) - created_at` to handle both active and canceled subscriptions fairly
- **Status Values**: Function checks all relevant statuses: trial, active, grace, canceled, expired
- **Idempotency**: Uses `ON CONFLICT (user_id, badge_id) DO NOTHING` to prevent duplicate badge awards
- **Frequency**: Runs daily at 00:00 UTC; adjust the cron schedule if needed (e.g., `'*/6 * * * *'` for every 6 hours)

## REFERENCES
- Subscriptions schema: `supabase/migrations/20251215100000_auth_v2_schema.sql`
- Badges schema: `supabase/migrations/20260110000000_badges_v2.sql`
- Badge functions: `supabase/migrations/20260110000001_badge_triggers.sql`
- Badge schema fixes: `supabase/migrations/20260112000003_fix_subscription_badge_schema.sql`
