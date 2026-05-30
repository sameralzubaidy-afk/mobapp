# MANUAL TESTING GUIDE: NOTIF-V2-009 Email Notifications

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** NOTIF-V2-009 Email Notifications  
**Test Date:** _____________  
**Tester:** _____________  
**Environment:** Supabase SQL Editor (Production)  
**Project Ref:** drntwgporzabmxdqykrp  
**Test User:** samer.alzubaidy@gmail.com  
**Test User ID:** 35c70746-b7e5-4611-9f96-3857c1789d1d  

---

## Setup Instructions

### Step 1: Get Your Anon Key
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `anon` `public` key
3. Replace `<YOUR_ANON_KEY>` in all test commands below with this key

### Step 2: Verify Secrets Are Configured
Run this command in terminal to verify all secrets are set:
```bash
supabase secrets list --project-ref drntwgporzabmxdqykrp
```

**Required secrets:**
- ✅ `SENDGRID_API_KEY` (your SendGrid API key)
- ✅ `SENDGRID_FROM_EMAIL` (verified sender: samer.alzubaidy@gmail.com)
- ✅ `SENDGRID_REPLY_TO_EMAIL` (verified sender: samer.alzubaidy@gmail.com)
- ✅ `SENDGRID_TEMPLATE_PAYMENT_FAILED` (d-f24a93405fc94f4da922407b33b69548)

**Optional secrets (required only for specific test cases):**
- ⏸️ `SENDGRID_TEMPLATE_TRIAL_EXPIRING` (create in SendGrid if testing TC2)
- ⏸️ `SENDGRID_TEMPLATE_SUBSCRIPTION_CANCELLED` (create in SendGrid if testing TC5)
- ⏸️ `SENDGRID_TEMPLATE_SECURITY_ALERT` (create in SendGrid if testing TC6)
- ⏸️ `SENDGRID_TEMPLATE_PASSWORD_CHANGED` (create in SendGrid if testing TC6b)

### Step 3: Create SendGrid Templates (As Needed)

For each email type you want to test, create a dynamic template in SendGrid:
1. Go to SendGrid → Email API → Dynamic Templates → Create Template
2. Name it (e.g., "Trial Expiring")
3. Add a design (use SendGrid's editor or paste HTML)
4. Copy the template ID (format: `d-xxxxxxxxxxxxxxxxxxxxx`)
5. Set the secret in Supabase:
   ```bash
   supabase secrets set --project-ref drntwgporzabmxdqykrp \
     SENDGRID_TEMPLATE_TRIAL_EXPIRING="d-xxxxxxxxxxxxxxxxxxxxx"
   ```
6. Redeploy the function:
   ```bash
   supabase functions deploy send-email --project-ref drntwgporzabmxdqykrp
   ```

**Note:** Test cases will fail gracefully with "SendGrid template not configured" if the template secret is missing. This is expected behavior.

---

## Prerequisites Checklist

Before starting tests, confirm:
- [ ] Migration `209_email_notifications_tracking.sql` applied to production
- [ ] SendGrid API key configured (verified in Step 2 above)
- [ ] SendGrid sender email verified (samer.alzubaidy@gmail.com)
- [ ] Payment failure template configured (SENDGRID_TEMPLATE_PAYMENT_FAILED)
- [ ] Anon key copied from Supabase dashboard
- [ ] Access to samer.alzubaidy@gmail.com inbox to receive test emails

---

## Emergency Fix: Missing public.email_logs Table

If you do not see the table in Supabase Table Editor, run this once in Supabase SQL Editor.
This hotfix is idempotent and focused on Test Case 7 tracking.

### Block 1 - Schema + RPCs

```sql
-- 1) Email tracking table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  template_type TEXT NOT NULL,
  sendgrid_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  unsubscribed_at TIMESTAMPTZ,
  error_message TEXT,
  template_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT email_status_check CHECK (
    status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed')
  )
);

-- Legacy schema drift guard
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sendgrid_message_id TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.email_logs
SET template_type = 'legacy_template'
WHERE template_type IS NULL;

ALTER TABLE public.email_logs ALTER COLUMN template_type SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN status SET DEFAULT 'pending';

-- 2) RPC used by send-email to create rows
CREATE OR REPLACE FUNCTION public.create_email_log(
  p_user_id UUID,
  p_recipient_email TEXT,
  p_template_type TEXT,
  p_template_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_has_email_type BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'email_logs'
      AND c.column_name = 'email_type'
  ) INTO v_has_email_type;

  IF v_has_email_type THEN
    INSERT INTO public.email_logs (
      user_id,
      recipient_email,
      email_type,
      template_type,
      metadata,
      template_data,
      status
    )
    VALUES (
      p_user_id,
      p_recipient_email,
      p_template_type,
      p_template_type,
      COALESCE(p_template_data, '{}'::jsonb),
      COALESCE(p_template_data, '{}'::jsonb),
      'pending'
    )
    RETURNING id INTO v_log_id;
  ELSE
    INSERT INTO public.email_logs (
      user_id,
      recipient_email,
      template_type,
      template_data,
      status
    )
    VALUES (
      p_user_id,
      p_recipient_email,
      p_template_type,
      COALESCE(p_template_data, '{}'::jsonb),
      'pending'
    )
    RETURNING id INTO v_log_id;
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) RPC used by send-email after SendGrid call
CREATE OR REPLACE FUNCTION public.update_email_log_status(
  p_log_id UUID,
  p_sendgrid_message_id TEXT,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.email_logs el
  SET
    sendgrid_message_id = COALESCE(p_sendgrid_message_id, el.sendgrid_message_id),
    status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE el.sent_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE el.delivered_at END,
    bounced_at = CASE WHEN p_status = 'bounced' THEN now() ELSE el.bounced_at END,
    error_message = p_error_message,
    updated_at = now()
  WHERE el.id = p_log_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4) RPC used by webhook to track open/click/delivered
CREATE OR REPLACE FUNCTION public.track_email_event(
  p_sendgrid_message_id TEXT,
  p_event_type TEXT,
  p_bounce_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.email_logs el
  SET
    status = CASE
      WHEN p_event_type = 'delivered' THEN 'delivered'
      WHEN p_event_type = 'open' THEN 'opened'
      WHEN p_event_type = 'click' THEN 'clicked'
      WHEN p_event_type = 'bounce' THEN 'bounced'
      WHEN p_event_type = 'dropped' THEN 'failed'
      ELSE el.status
    END,
    delivered_at = CASE WHEN p_event_type = 'delivered' THEN now() ELSE el.delivered_at END,
    opened_at = CASE WHEN p_event_type = 'open' THEN now() ELSE el.opened_at END,
    clicked_at = CASE WHEN p_event_type = 'click' THEN now() ELSE el.clicked_at END,
    bounced_at = CASE WHEN p_event_type = 'bounce' THEN now() ELSE el.bounced_at END,
    bounce_reason = CASE WHEN p_event_type = 'bounce' THEN p_bounce_reason ELSE el.bounce_reason END,
    updated_at = now()
  WHERE el.sendgrid_message_id = p_sendgrid_message_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Block 2 - RLS + Indexes

```sql
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_logs;
CREATE POLICY "Users can view own email logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to email logs" ON public.email_logs;
CREATE POLICY "Service role full access to email logs"
  ON public.email_logs FOR ALL
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sendgrid_message_id
  ON public.email_logs(sendgrid_message_id)
  WHERE sendgrid_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON public.email_logs(template_type);
```

### Verification Queries

```sql
-- Table exists
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'email_logs';

-- Columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'email_logs'
ORDER BY ordinal_position;

-- RLS + policies
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'email_logs';

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'email_logs';

-- RPCs exist
SELECT proname
FROM pg_proc
WHERE proname IN ('create_email_log', 'update_email_log_status', 'track_email_event')
ORDER BY proname;
```

If all verification queries pass, continue with Test Case 7.

---

## Test Case 1: Payment Failure Email (Critical) ✅

**Goal:** Verify payment failure emails are sent immediately and bypass user preferences

**Prerequisites:** SENDGRID_TEMPLATE_PAYMENT_FAILED must be configured (already done: d-f24a93405fc94f4da922407b33b69548)

### Steps:

**1. Send the email via SQL:**
Open Supabase SQL Editor and run (replace `<YOUR_ANON_KEY>` with your anon key from Step 1):

```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'payment_failed',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', true,
    'data', jsonb_build_object(
      'subscriptionId', 'sub_test_' || gen_random_uuid()::text,
      'amount', 9.99,
      'reason', 'Insufficient funds'
    )
  )
) AS request_id;
```

**2. Check the response:**
```sql
SELECT id, status_code, content::text 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 1;
```

**Expected response:**
- `status_code`: 200
- `content`: `{"success":true,"logId":"<UUID>"}`

**3. Check your email inbox** (samer.alzubaidy@gmail.com) — email should arrive within 1-2 minutes

**4. Verify email tracking:**
```sql
SELECT id, recipient_email, template_type, status, sendgrid_message_id, error_message, created_at
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'payment_failed'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Results:
- [ ] Function response: `status_code` = 200, `success` = true
- [ ] Email received in inbox within 2 minutes
- [ ] Email subject: "Payment Failed - Kids Club+ Subscription" (or similar based on template)
- [ ] Email body includes:
  - [ ] Amount: $9.99
  - [ ] Reason: Insufficient funds
  - [ ] "Update Payment Method" button or link
- [ ] Email is mobile-responsive (check on phone if possible)
- [ ] Email does NOT include unsubscribe link (critical email)
- [ ] `email_logs` entry shows `status` = `sent` and `sendgrid_message_id` is populated

**Status:** ☐ PASS | ☐ FAIL  
**Notes:** _______________

---

## Test Case 2: Trial Expiring Email (Non-Critical)

**Goal:** Verify trial expiring emails respect user preferences

**Prerequisites:** 
- SENDGRID_TEMPLATE_TRIAL_EXPIRING must be configured (create template in SendGrid first if not done)
- If template is NOT configured, this test will return error: "SendGrid template not configured for trial_expiring"

### Steps:

**1. Ensure user has email notifications enabled:**
Run this SQL to verify/enable email notifications for subscription category:
```sql
INSERT INTO public.notification_preferences (user_id, category, email_enabled)
VALUES ('35c70746-b7e5-4611-9f96-3857c1789d1d', 'subscription', true)
ON CONFLICT (user_id, category) 
DO UPDATE SET email_enabled = true;

-- Verify
SELECT category, email_enabled, push_enabled 
FROM public.notification_preferences 
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d';
```

**2. Send the email via SQL:**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'trial_expiring',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', false,
    'data', jsonb_build_object(
      'daysRemaining', 7,
      'trialEndsAt', (now() + interval '7 days')::text
    )
  )
) AS request_id;
```

**3. Check the response:**
```sql
SELECT id, status_code, content::text 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 1;
```

**4. If template is configured, check your email inbox**

**5. Verify email tracking:**
```sql
SELECT id, recipient_email, template_type, status, sendgrid_message_id, error_message, created_at
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'trial_expiring'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Results:

**If template IS configured:**
- [ ] Function response: `status_code` = 200, `success` = true
- [ ] Email received in inbox
- [ ] Email subject: "Your Trial is Expiring Soon" (based on template)
- [ ] Email body includes:
  - [ ] "7 days remaining" message
  - [ ] Trial end date
  - [ ] "Subscribe Now" button
  - [ ] Unsubscribe link at bottom (non-critical email)
- [ ] Email is mobile-responsive
- [ ] `email_logs` entry shows `status` = `sent`

**If template NOT configured:**
- [ ] Function response: `status_code` = 500
- [ ] `content`: Contains "SendGrid template not configured for trial_expiring"
- [ ] No email received (expected)
- [ ] `email_logs` entry shows `status` = `failed`, `error_message` contains template error

**Status:** ☐ PASS | ☐ FAIL | ☐ SKIP (template not configured)  
**Notes:** _______________

---

## Test Case 3: Email Preference Enforcement

**Goal:** Verify non-critical emails respect user opt-out preferences

**Prerequisites:** SENDGRID_TEMPLATE_TRIAL_EXPIRING must be configured (or use any non-critical template)

### Steps:

**1. Disable email notifications for subscription category:**
```sql
UPDATE public.notification_preferences 
SET email_enabled = false
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';

-- Verify
SELECT category, email_enabled, push_enabled 
FROM public.notification_preferences 
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';
```

**Expected:** `email_enabled` = `false`

**2. Attempt to send a non-critical email (trial expiring):**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'trial_expiring',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', false,
    'data', jsonb_build_object(
      'daysRemaining', 7,
      'trialEndsAt', (now() + interval '7 days')::text
    )
  )
) AS request_id;
```

**3. Check the response:**
```sql
SELECT id, status_code, content::text 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 1;
```

**4. Check your email inbox (should NOT receive email)**

**5. Verify no email log was created:**
```sql
SELECT COUNT(*) as recent_emails
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'trial_expiring'
  AND created_at > now() - interval '5 minutes';
```

### Expected Results:
- [ ] Function response: `status_code` = 200
- [ ] `content`: `{"success":true,"skipped":true,"reason":"User has disabled email notifications for this category"}`
- [ ] NO email received in inbox (skipped due to preference)
- [ ] `recent_emails` count = 0 (no email log created)

**Status:** ☐ PASS | ☐ FAIL  
**Notes:** _______________

---

## Test Case 4: Unsubscribe Link Flow

**Goal:** Verify users can unsubscribe from email categories via email link

**Prerequisites:** SENDGRID_TEMPLATE_TRIAL_EXPIRING must be configured (needs unsubscribe link in template)

### Steps:

**1. Re-enable email notifications:**
```sql
UPDATE public.notification_preferences 
SET email_enabled = true
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';
```

**2. Send a trial expiring email (to get unsubscribe link):**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'trial_expiring',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', false,
    'data', jsonb_build_object(
      'daysRemaining', 3,
      'trialEndsAt', (now() + interval '3 days')::text
    )
  )
) AS request_id;
```

**3. Check your email inbox and locate the unsubscribe link**  
(Should be at bottom of email, format: `p2pkidsmarketplace://unsubscribe?token=<TOKEN>` or `https://...`)

**4. Click the unsubscribe link**  
- If deep link opens the mobile app → verify UnsubscribeScreen shows success
- If web link → verify web page shows unsubscribe confirmation

**5. Verify preference was updated in database:**
```sql
SELECT category, email_enabled, push_enabled, updated_at
FROM public.notification_preferences 
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';
```

**6. Verify unsubscribe token was marked as used:**
```sql
SELECT token, category, used_at, created_at, expires_at
FROM public.unsubscribe_tokens
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Results:

**If template includes unsubscribe link:**
- [ ] Email received with unsubscribe link at bottom
- [ ] Clicking link opens app or web page
- [ ] Unsubscribe screen/page displays:
  - [ ] Success icon (green checkmark)
  - [ ] "You've Been Unsubscribed" title
  - [ ] Category name: "subscription"
  - [ ] Message about managing preferences in app settings
  - [ ] "Go to Home" button (mobile app)
- [ ] Database `notification_preferences`: `email_enabled` = `false`
- [ ] Database `unsubscribe_tokens`: `used_at` is populated (not null)

**If template does NOT include unsubscribe link yet:**
- [ ] Email received but no unsubscribe link visible
- [ ] Skip this test case until template is updated

**Status:** ☐ PASS | ☐ FAIL | ☐ SKIP (template missing unsubscribe link)  
**Notes:** _______________

---

## Test Case 5: Subscription Cancelled Email (Critical)

**Goal:** Verify subscription cancellation confirmation email is sent

**Prerequisites:** SENDGRID_TEMPLATE_SUBSCRIPTION_CANCELLED must be configured (create in SendGrid if testing)

### Steps:

**1. Send the email via SQL:**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'subscription_cancelled',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', true,
    'data', jsonb_build_object(
      'gracePeriodEndsAt', (now() + interval '90 days')::text
    )
  )
) AS request_id;
```

**2. Check the response:**
```sql
SELECT id, status_code, content::text 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 1;
```

**3. If template is configured, check your email inbox**

**4. Verify email tracking:**
```sql
SELECT id, recipient_email, template_type, status, error_message
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'subscription_cancelled'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Results:

**If template IS configured:**
- [ ] Function response: `status_code` = 200, `success` = true
- [ ] Email received with subject "Subscription Cancelled" (based on template)
- [ ] Email body includes:
  - [ ] Grace period end date (90 days from now)
  - [ ] "Reactivate Subscription" button or link
- [ ] No unsubscribe link (critical email)
- [ ] Email is mobile-responsive
- [ ] `email_logs` entry shows `status` = `sent`

**If template NOT configured:**
- [ ] Function response: `status_code` = 500
- [ ] `content`: Contains "SendGrid template not configured for subscription_cancelled"
- [ ] No email received (expected)

**Status:** ☐ PASS | ☐ FAIL | ☐ SKIP (template not configured)  
**Notes:** _______________

---

## Test Case 6: Security Alert Email (Critical)

**Goal:** Verify security alert emails are sent for account security events

**Prerequisites:** SENDGRID_TEMPLATE_SECURITY_ALERT must be configured (create in SendGrid if testing)

### Steps:

**1. Send the email via SQL:**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'security_alert',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'system',
    'isCritical', true,
    'data', jsonb_build_object(
      'alertType', 'password_change',
      'alertMessage', 'Your password was changed from a new device (iPhone - Safari)'
    )
  )
) AS request_id;
```

**2. Check the response:**
```sql
SELECT id, status_code, content::text 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 1;
```

**3. If template is configured, check your email inbox**

**4. Verify email tracking:**
```sql
SELECT id, recipient_email, template_type, status, error_message
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'security_alert'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Results:

**If template IS configured:**
- [ ] Function response: `status_code` = 200, `success` = true
- [ ] Email received with subject "Security Alert" (based on template)
- [ ] Email body includes:
  - [ ] Alert type: "password_change"
  - [ ] Alert message
  - [ ] Timestamp
  - [ ] "Contact Support" link
- [ ] No unsubscribe link (critical email)
- [ ] `email_logs` entry shows `status` = `sent`

**If template NOT configured:**
- [ ] Function response: `status_code` = 500
- [ ] `content`: Contains "SendGrid template not configured for security_alert"
- [ ] No email received (expected)

**Status:** ☐ PASS | ☐ FAIL | ☐ SKIP (template not configured)  
**Notes:** _______________

---

## Test Case 7: Email Delivery Tracking

**Goal:** Verify email events are tracked in the database

**Prerequisites:** Any working template (e.g., payment_failed)

### Steps:

**1. Send an email (use payment_failed since it's configured):**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'payment_failed',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', true,
    'data', jsonb_build_object(
      'subscriptionId', 'sub_tracking_test_' || gen_random_uuid()::text,
      'amount', 9.99,
      'reason', 'Card declined'
    )
  )
) AS request_id;
```

**2. Get the email log ID:**
```sql
SELECT id, recipient_email, template_type, status, sendgrid_message_id, created_at
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'payment_failed'
ORDER BY created_at DESC
LIMIT 1;
```

Note the `id` and `sendgrid_message_id` from the result.

If this query returns 0 rows right after a successful send:
- Make sure you are running in Supabase SQL Editor (not from an app client session with RLS filters).
- Run this fallback verification query:

```sql
SELECT * FROM public.get_email_delivery_stats(
  p_start_date := (now() - interval '1 day')::timestamptz,
  p_end_date := now()::timestamptz
);
```

If `total_sent` increases, logging is working and row-level visibility is the issue.

**3. Open the email in your inbox** (samer.alzubaidy@gmail.com)

**4. Click a link in the email** (e.g., "Update Payment Method")

**5. Wait 1-2 minutes for SendGrid webhook to fire**

**6. Check updated tracking:**
```sql
SELECT 
  id, 
  status, 
  delivered_at, 
  opened_at, 
  clicked_at,
  bounced_at,
  created_at
FROM public.email_logs
WHERE id = '<LOG_ID_FROM_STEP_2>'
  OR sendgrid_message_id = '<SENDGRID_MESSAGE_ID_FROM_STEP_2>';
```

### Expected Results:
- [ ] Initial log entry has `status` = `pending` or `sent`
- [ ] `sendgrid_message_id` is populated (format: varies by SendGrid)
- [ ] After email is delivered: `status` = `delivered`, `delivered_at` populated
- [ ] After opening email: `status` = `opened`, `opened_at` populated
- [ ] After clicking link: `status` = `clicked`, `clicked_at` populated
- [ ] All timestamps are reasonable (within a few minutes of each action)

**Note:** Webhook events may take 1-5 minutes to arrive from SendGrid. If status doesn't update, verify:
- [ ] `email-webhook` edge function is deployed
- [ ] SendGrid webhook URL is configured (see Test Case 8)

**Status:** ☐ PASS | ☐ FAIL | ☐ PARTIAL (webhook not configured)  
**Notes:** _______________

---

## Test Case 8: SendGrid Webhook Events

**Goal:** Verify SendGrid webhook updates email logs correctly

**Prerequisites:** 
- `email-webhook` edge function must be deployed
- SendGrid webhook URL must be configured in SendGrid dashboard

### Setup (One-Time):

**1. Deploy the email-webhook edge function:**
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase functions deploy email-webhook --project-ref drntwgporzabmxdqykrp --no-verify-jwt
```

**Important:** SendGrid Event Webhook requests do not include Supabase JWT auth headers.
If JWT verification is enabled on this function, SendGrid calls will fail with:
- `401 UNAUTHORIZED_NO_AUTH_HEADER`

**2. Configure webhook in SendGrid:**
- Go to SendGrid Dashboard → Settings → Mail Settings → Event Webhook
- Click "Create New Webhook"
- **HTTP POST URL:** `https://drntwgporzabmxdqykrp.supabase.co/functions/v1/email-webhook`
- **Event Selection:** Enable all events:
  - Delivered
  - Opened
  - Clicked
  - Bounced
  - Dropped
  - Spam Reports
  - Unsubscribes
- **Status:** Set to "Enabled"
- Click "Save"

**3. Test webhook is reachable:**
SendGrid will send a test POST to verify the endpoint. Check Supabase Edge Function logs:
1. Open Supabase Dashboard → Edge Functions → `email-webhook` → Logs
2. Confirm a recent webhook request appears with HTTP 200

### Testing Steps:

**1. Send an email (use Test Case 1 or 7)**

**2. Check SendGrid Activity Feed:**
- Go to SendGrid Dashboard → Activity
- Locate the sent email by recipient (samer.alzubaidy@gmail.com)
- Verify events appear: Processed → Delivered → Opened (if you opened it)

**3. Verify webhook was called:**
Open Supabase Dashboard → Edge Functions → `email-webhook` → Logs
and confirm recent events were processed.

Look for log entries like:
```
[email-webhook] Processing 1 events
[email-webhook] Processed event: delivered for <sendgrid_message_id>
```

**4. Verify email log was updated:**
```sql
SELECT 
  id,
  sendgrid_message_id,
  status,
  delivered_at,
  opened_at,
  clicked_at,
  updated_at
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Results:
- [ ] Webhook endpoint is reachable (SendGrid test passes)
- [ ] SendGrid Activity Feed shows email events (Delivered, Opened, etc.)
- [ ] Edge function logs show webhook received and processed events
- [ ] Email log `status` updated from `sent` → `delivered` (or `opened`/`clicked`)
- [ ] `delivered_at` timestamp populated within seconds of SendGrid sending
- [ ] Webhook function logs show no errors

**If webhook is NOT configured:**
- [ ] Email logs will show `status` = `sent` only (no updates)
- [ ] This is expected; tracking will work once webhook is set up

**Status:** ☐ PASS | ☐ FAIL | ☐ SKIP (webhook not configured)  
**Notes:** _______________

---

## Test Case 9: Email Statistics

**Goal:** Verify email delivery statistics are accurate

**Prerequisites:** At least 3 emails sent (can use Test Cases 1, 2, 5, 6)

### Steps:

**1. Send at least 3 different emails** (use any working templates)

**2. Open at least 2 of them in your inbox**

**3. Click a link in at least 1 of them**

**4. Wait 2-3 minutes for webhook events to process** (if webhook is configured)

**5. Get email delivery statistics:**
```sql
SELECT * FROM public.get_email_delivery_stats(
  p_start_date := (now() - interval '7 days')::timestamptz,
  p_end_date := now()::timestamptz
);
```

**6. View per-user email stats:**
```sql
SELECT 
  template_type,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE status = 'opened') as opened,
  COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
  COUNT(*) FILTER (WHERE status = 'bounced') as bounced
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND created_at > now() - interval '1 day'
GROUP BY template_type
ORDER BY total_sent DESC;
```

### Expected Results:

**From `get_email_delivery_stats()` RPC:**
- [ ] `total_sent` ≥ 3
- [ ] `total_delivered` shows accurate count (if webhook configured)
- [ ] `total_opened` ≥ 2 (if you opened emails and webhook configured)
- [ ] `total_clicked` ≥ 1 (if you clicked links and webhook configured)
- [ ] Rates calculated correctly:
  - [ ] `delivery_rate` = (delivered / sent) * 100
  - [ ] `open_rate` = (opened / delivered) * 100
  - [ ] `click_rate` = (clicked / delivered) * 100
  - [ ] `bounce_rate` = (bounced / sent) * 100

**From per-user query:**
- [ ] Shows breakdown by `template_type` (payment_failed, trial_expiring, etc.)
- [ ] Counts match actual emails sent/opened/clicked

**If webhook NOT configured:**
- [ ] All emails will show `status` = `sent` (no delivered/opened/clicked)
- [ ] Statistics will show 0% delivery/open/click rates
- [ ] This is expected until webhook is set up (see Test Case 8)

**Status:** ☐ PASS | ☐ FAIL | ☐ PARTIAL (webhook not configured)  
**Notes:** _______________

---

## Test Case 10: Mobile Responsiveness

**Goal:** Verify emails render correctly on mobile devices

**Prerequisites:** Any working template (payment_failed is already configured)

### Steps:

**1. Send an email to yourself:**
Use Test Case 1 (Payment Failure Email) command

**2. Open the email on multiple devices/apps:**
- [ ] **iOS Mail app** (iPhone or iPad if available)
- [ ] **Gmail mobile app** (Android or iOS)
- [ ] **Outlook mobile app** (Android or iOS)
- [ ] **Mobile browser** (Safari on iPhone, Chrome on Android)

**3. Check layout on each:**
- Verify email width fits screen without horizontal scrolling
- Check text is readable (font size appropriate)
- Check buttons are tappable (not too small)
- Check images scale appropriately
- Check unsubscribe link is visible (for non-critical emails)

### Expected Results:
- [ ] Email renders correctly across all tested apps
- [ ] Width: Fits mobile screen (no horizontal scrolling)
- [ ] Text: Readable font size (minimum 14-16px for body text)
- [ ] Buttons: Tappable size (minimum 44x44px touch target)
- [ ] Images: Scale to fit container (no overflow)
- [ ] Links: Easy to tap (adequate spacing between links)
- [ ] Unsubscribe link: Visible and tappable at bottom (non-critical emails)

**Device Testing Matrix:**

| Device/App | Renders Correctly | Notes |
|------------|-------------------|-------|
| iOS Mail | ☐ | |
| Gmail Mobile | ☐ | |
| Outlook Mobile | ☐ | |
| Mobile Browser | ☐ | |

**Status:** ☐ PASS | ☐ FAIL | ☐ PARTIAL (limited devices tested)  
**Notes:** _______________

---

## Test Case 11: Invalid Unsubscribe Token

**Goal:** Verify expired/invalid unsubscribe tokens are rejected gracefully

**Prerequisites:** Mobile app must be installed (or web version accessible)

### Steps:

**1. Test with completely invalid token:**

If testing in **mobile app**:
- Open a browser on your phone
- Navigate to: `p2pkidsmarketplace://unsubscribe?token=invalid-token-xyz-123`
- This should open the app and show the UnsubscribeScreen

If testing in **web** (if web handler exists):
- Navigate to: `https://drntwgporzabmxdqykrp.supabase.co/functions/v1/unsubscribe?token=invalid-token-xyz-123`

**2. Observe the error screen/response**

**3. Test with expired token (optional - if you have old tokens):**
```sql
-- Find an old token (if any exist)
SELECT token, category, created_at, expires_at, used_at
FROM public.unsubscribe_tokens
WHERE expires_at < now()
ORDER BY created_at DESC
LIMIT 1;
```

If an expired token exists, try navigating to:
- `p2pkidsmarketplace://unsubscribe?token=<EXPIRED_TOKEN>`

**4. Verify preferences are NOT changed:**
```sql
SELECT category, email_enabled
FROM public.notification_preferences
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
ORDER BY category;
```

### Expected Results:

**Mobile app UnsubscribeScreen displays:**
- [ ] Red error icon or alert symbol
- [ ] Error title: "Unable to Unsubscribe" or "Invalid Link"
- [ ] Error message: "Invalid or expired token" or similar
- [ ] "Go to Home" button (or equivalent navigation)
- [ ] Screen testID `error-title` is visible (for automated tests)

**Web response (if applicable):**
- [ ] HTTP 400 or 404 status
- [ ] Error message in JSON: `{"error":"Invalid or expired unsubscribe token"}`

**Database state:**
- [ ] NO notification preferences changed
- [ ] NO `used_at` timestamp added to any unsubscribe_tokens
- [ ] Error logged in edge function logs (if checking logs)

**Status:** ☐ PASS | ☐ FAIL | ☐ SKIP (mobile app not available)  
**Notes:** _______________

---

## Test Case 12: Re-enable Email Notifications

**Goal:** Verify users can re-enable email notifications after unsubscribing

**Prerequisites:** User must have previously unsubscribed (Test Case 4) OR manually disable via SQL

### Steps:

**1. Ensure email notifications are disabled:**
```sql
-- Disable if not already
UPDATE public.notification_preferences 
SET email_enabled = false
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';

-- Verify
SELECT category, email_enabled, push_enabled
FROM public.notification_preferences 
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';
```

**Expected:** `email_enabled` = `false`

**2. Re-enable email notifications via SQL:**
```sql
UPDATE public.notification_preferences 
SET email_enabled = true
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';

-- Verify
SELECT category, email_enabled, updated_at
FROM public.notification_preferences 
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND category = 'subscription';
```

**Expected:** `email_enabled` = `true`, `updated_at` is recent

**3. Send a non-critical email (trial_expiring):**
```sql
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'trial_expiring',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', false,
    'data', jsonb_build_object(
      'daysRemaining', 5,
      'trialEndsAt', (now() + interval '5 days')::text
    )
  )
) AS request_id;
```

**4. Check response:**
```sql
SELECT id, status_code, content::text 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 1;
```

**5. Check your email inbox**

**6. Verify email log created:**
```sql
SELECT id, template_type, status, created_at
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
  AND template_type = 'trial_expiring'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Results:
- [ ] Preference update succeeds: `email_enabled` = `true`
- [ ] Function response: `status_code` = 200, `success` = true (if template configured)
- [ ] Email is received in inbox (if template configured)
- [ ] Email log entry created with `status` = `sent`
- [ ] User can receive non-critical emails again after re-enabling

**Note:** If SENDGRID_TEMPLATE_TRIAL_EXPIRING is not configured, test will return template error. Use payment_failed template instead:
```sql
-- Alternative: Use payment_failed template (already configured)
SELECT net.http_post(
  url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <YOUR_ANON_KEY>',
    'apikey', '<YOUR_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'type', 'payment_failed',
    'to', 'samer.alzubaidy@gmail.com',
    'userId', '35c70746-b7e5-4611-9f96-3857c1789d1d',
    'category', 'subscription',
    'isCritical', true,  -- Critical emails bypass preferences, so this tests re-enable indirectly
    'data', jsonb_build_object(
      'subscriptionId', 'sub_re_enable_test',
      'amount', 9.99,
      'reason', 'Re-enable test'
    )
  )
) AS request_id;
```

**Status:** ☐ PASS | ☐ FAIL | ☐ PARTIAL (template not configured)  
**Notes:** _______________

---

## Summary

| Test Case | Status | Template Required | Notes |
|-----------|--------|------------------|-------|
| TC1: Payment Failure Email | ☐ PASS ☐ FAIL | ✅ payment_failed (configured) | |
| TC2: Trial Expiring Email | ☐ PASS ☐ FAIL ☐ SKIP | ⏸️ trial_expiring | |
| TC3: Email Preference Enforcement | ☐ PASS ☐ FAIL ☐ SKIP | ⏸️ trial_expiring | Can skip if TC2 skipped |
| TC4: Unsubscribe Link Flow | ☐ PASS ☐ FAIL ☐ SKIP | ⏸️ trial_expiring | Requires template with unsubscribe link |
| TC5: Subscription Cancelled Email | ☐ PASS ☐ FAIL ☐ SKIP | ⏸️ subscription_cancelled | |
| TC6: Security Alert Email | ☐ PASS ☐ FAIL ☐ SKIP | ⏸️ security_alert | |
| TC7: Email Delivery Tracking | ☐ PASS ☐ FAIL ☐ PARTIAL | ✅ payment_failed | Partial = sent tracking works, webhook not configured |
| TC8: SendGrid Webhook Events | ☐ PASS ☐ FAIL ☐ SKIP | N/A | Requires webhook setup |
| TC9: Email Statistics | ☐ PASS ☐ FAIL ☐ PARTIAL | N/A | Partial = stats work, webhook data missing |
| TC10: Mobile Responsiveness | ☐ PASS ☐ FAIL ☐ PARTIAL | ✅ payment_failed | Partial = tested on limited devices |
| TC11: Invalid Unsubscribe Token | ☐ PASS ☐ FAIL ☐ SKIP | N/A | Requires mobile app |
| TC12: Re-enable Email Notifications | ☐ PASS ☐ FAIL ☐ PARTIAL | ⏸️ trial_expiring | Can use payment_failed as alternative |

**Overall Status:** ☐ ALL PASS | ☐ SOME FAILURES | ☐ PARTIAL (templates not fully configured)

**Test Summary:**
- **Completed:** ___ / 12
- **Passed:** ___ / 12
- **Failed:** ___ / 12
- **Skipped:** ___ / 12

**Configuration Status:**
- ✅ SendGrid API Key: Configured
- ✅ Verified Sender: samer.alzubaidy@gmail.com
- ✅ Template - payment_failed: d-f24a93405fc94f4da922407b33b69548
- ⏸️ Template - trial_expiring: Not configured
- ⏸️ Template - subscription_cancelled: Not configured
- ⏸️ Template - security_alert: Not configured
- ⏸️ Template - password_changed: Not configured
- ⏸️ SendGrid Webhook: Not configured

**Tester Signature:** _____________  
**Date:** _____________

---

## Known Issues / Bugs Found

_Record any bugs or issues discovered during testing:_

1. 
2. 
3. 

---

## Additional Notes

_Any other observations or recommendations:_

### Next Steps for Full Email System:

**1. Create Remaining SendGrid Templates:**
To test all cases, create these templates in SendGrid (Email API → Dynamic Templates):
- Trial Expiring (`trial_expiring`)
- Subscription Cancelled (`subscription_cancelled`)
- Security Alert (`security_alert`)
- Password Changed (`password_changed`)

For each template:
- Add personalization variables: `{{daysRemaining}}`, `{{gracePeriodEndsAt}}`, `{{alertType}}`, etc.
- Include unsubscribe link for non-critical emails: `{{unsubscribeUrl}}`
- Copy template ID and set secret:
  ```bash
  supabase secrets set --project-ref drntwgporzabmxdqykrp \
    SENDGRID_TEMPLATE_TRIAL_EXPIRING="d-xxxxxxxxxxxxxxxxxxxxx"
  ```
- Redeploy send-email function after adding secrets

**2. Configure SendGrid Webhook (for tracking):**
Follow Test Case 8 setup instructions to enable delivery/open/click tracking.

**3. Deploy email-webhook Edge Function:**
```bash
supabase functions deploy email-webhook --project-ref drntwgporzabmxdqykrp
```

**4. Test in Mobile App:**
For full unsubscribe flow testing (TC4, TC11), the mobile app must be running to handle deep links (`p2pkidsmarketplace://unsubscribe?token=...`).

---

## Quick Reference: Common SQL Commands

**Get your anon key:**
```
Supabase Dashboard → Settings → API → Copy "anon public" key
```

**Check recent emails sent:**
```sql
SELECT id, recipient_email, template_type, status, created_at
FROM public.email_logs
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d'
ORDER BY created_at DESC
LIMIT 10;
```

**Check email preferences:**
```sql
SELECT category, email_enabled, push_enabled
FROM public.notification_preferences
WHERE user_id = '35c70746-b7e5-4611-9f96-3857c1789d1d';
```

**Check function response:**
```sql
SELECT id, status_code, content::text
FROM net._http_response
ORDER BY id DESC
LIMIT 1;
```

**List configured secrets:**
```bash
supabase secrets list --project-ref drntwgporzabmxdqykrp
```

**View edge function logs:**
Use Supabase Dashboard:
1. Edge Functions → `send-email` → Logs
2. Filter by latest requests
