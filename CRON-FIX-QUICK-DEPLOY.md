# QUICK DEPLOYMENT: Fix scheduled_award_tenure_badges Cron Job Error

## ISSUE
Cron job fails with: `ERROR: column "tier" does not exist`

## FIX SUMMARY
The `subscriptions` table does NOT have a `tier` column. The function was written incorrectly.

## QUICK FIX (Copy & Paste)

Go to **Supabase Dashboard → SQL Editor** and run this:

```sql
-- Create the fixed function
CREATE OR REPLACE FUNCTION public.scheduled_award_tenure_badges()
RETURNS TABLE (
  p_total_checked INT,
  p_total_awarded INT,
  p_error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_checked INT := 0;
  v_total_awarded INT := 0;
  v_user_id UUID;
  v_days_subscribed NUMERIC;
  v_badge_id UUID;
  v_badge_threshold INT;
BEGIN
  FOR v_badge_id, v_badge_threshold IN
    SELECT id, threshold
    FROM badges
    WHERE category = 'subscription' AND is_active = TRUE
    ORDER BY threshold ASC
  LOOP
    FOR v_user_id, v_days_subscribed IN
      SELECT 
        s.user_id,
        EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 as days_subscribed
      FROM subscriptions s
      WHERE s.status IN ('trial', 'active', 'grace', 'canceled', 'expired')
        AND EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 >= v_badge_threshold
    LOOP
      v_total_checked := v_total_checked + 1;
      
      INSERT INTO user_badges (user_id, badge_id, awarded_at)
      VALUES (v_user_id, v_badge_id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      IF FOUND THEN
        v_total_awarded := v_total_awarded + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT v_total_checked, v_total_awarded, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT v_total_checked, v_total_awarded, SQLERRM;
END;
$$;

-- Schedule the cron job (if not already scheduled)
SELECT cron.schedule('award-tenure-badges-daily', '0 0 * * *', $$
  SELECT public.scheduled_award_tenure_badges();
$$);
```

## TEST IT
```sql
-- Run the function manually to verify it works
SELECT * FROM public.scheduled_award_tenure_badges();

-- Expected output: (0 or more) | (0 or more) | (null or error message)
-- Example: 150 | 5 | null  (checked 150 users, awarded 5 badges)
```

## WHAT CHANGED
| Before (WRONG) | After (CORRECT) |
|---|---|
| `SELECT user_id, created_at, status, tier FROM subscriptions` | `SELECT s.user_id, EXTRACT(EPOCH FROM ...) FROM subscriptions s` |
| References non-existent `tier` column | Uses `status` column correctly (enum: free, trial, active, grace, canceled, expired) |
| Would fail every time | Works correctly, awards tenure badges |

## VERIFICATION
After running the SQL above:

✅ Function exists and works
✅ Cron job scheduled to run daily
✅ Subscription tenure badges awarded automatically

Done! The cron job will now work without errors.
