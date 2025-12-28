# Quick Fix: Apply Upgrade Subscription RPC

## Action Required
Apply this SQL in Supabase SQL Editor to enable the upgrade function:

```sql
-- Create RPC function for upgrading free subscriptions to trial
CREATE OR REPLACE FUNCTION upgrade_free_subscription_to_trial(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_duration INTEGER;
  v_trial_end_date TIMESTAMPTZ;
BEGIN
  -- Get the user's subscription (must exist and be 'free')
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for user %', p_user_id;
  END IF;

  IF v_subscription.status != 'free' THEN
    -- Already upgraded, just return it
    RETURN v_subscription;
  END IF;

  -- Get trial duration from admin config
  v_trial_duration := get_trial_duration_days();
  v_trial_end_date := NOW() + (v_trial_duration || ' days')::INTERVAL;

  -- Update the free subscription to trial
  UPDATE subscriptions
  SET 
    status = 'trial',
    trial_start_date = NOW(),
    trial_end_date = v_trial_end_date,
    updated_at = NOW()
  WHERE id = v_subscription.id
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;
```

## Steps
1. Go to Supabase Studio → SQL Editor
2. Copy the SQL above
3. Paste and run
4. Expected: `CREATE FUNCTION` result
5. Test upgrade again in app

## What This Does
- **Safe RPC function** with SECURITY DEFINER (runs as service role)
- Handles free → trial upgrade atomically
- Gets trial duration from admin config
- Sets proper trial_start_date and trial_end_date
- Returns upgraded subscription record

## Why It Works
- Bypasses RLS issues (uses SECURITY DEFINER)
- Handles the case where subscription already exists with status='free'
- Uses same trial duration logic as initial enrollment
- Properly returns the subscription object for the mobile app

After applying, the upgrade flow will work:
1. Click "Upgrade Now"
2. Click "Start Free Trial"
3. RPC function called
4. Subscription updated from free → trial
5. Return to listing → SP toggle appears ✅
