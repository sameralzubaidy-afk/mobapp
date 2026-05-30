# PRODUCTION SETUP: admin_config Migration Instructions

## Status: ✅ CONFIGURATION FILES UPDATED

### ✅ COMPLETED CHANGES:

1. **Mobile App (.env.local)** - Updated to PRODUCTION
   - File: `p2p-kids-marketplace/.env.local`
   - Now points to: `https://drntwgporzabmxdqykrp.supabase.co`
   - ✅ Status: READY

2. **Admin Portal (.env.local)** - Updated to PRODUCTION
   - File: `p2p-kids-admin/.env.local`
   - Now points to: `https://drntwgporzabmxdqykrp.supabase.co`
   - ✅ Status: READY

3. **Migration SQL Created** - Database schema
   - File: `supabase/migrations/20250113_create_admin_config.sql`
   - Contains: Full admin_config table + 36 settings + RLS policies
   - ✅ Status: READY

### ⏳ PENDING: Create admin_config Table in PRODUCTION

The table needs to be created in the production database with all settings. Here are your options:

---

## Option 1: Using Supabase Studio SQL Editor (EASIEST) ✅ RECOMMENDED

1. Go to: https://app.supabase.com
2. Select your project: **kids_marketplace_app** (drntwgporzabmxdqykrp)
3. Click **SQL Editor** in left sidebar
4. Click **+ New Query**
5. Copy all SQL from below and paste into the editor
6. Click **Run**

**SQL to Execute:**
```sql
-- Create enum for config categories
CREATE TYPE IF NOT EXISTS admin_config_category AS ENUM (
  'subscription',
  'swap_points',
  'fees',
  'sms',
  'email',
  'moderation',
  'safety',
  'analytics',
  'feature_flags'
);

-- Create admin_config table
CREATE TABLE IF NOT EXISTS admin_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category admin_config_category NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string',
  is_secret BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  
  CONSTRAINT valid_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  CONSTRAINT valid_key_format CHECK (key ~ '^[a-z0-9_]+$')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(key);
CREATE INDEX IF NOT EXISTS idx_admin_config_category ON admin_config(category);
CREATE INDEX IF NOT EXISTS idx_admin_config_is_active ON admin_config(is_active);

-- Enable RLS
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS admin_config_select_all ON admin_config
  FOR SELECT
  USING (TRUE);

CREATE POLICY IF NOT EXISTS admin_config_update_service_role ON admin_config
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS admin_config_delete_service_role ON admin_config
  FOR DELETE
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS admin_config_insert_service_role ON admin_config
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Seed configuration values (36 total)
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active) VALUES
('subscription_price_monthly', '7.99', 'Monthly subscription price in USD', 'subscription', 'number', FALSE, TRUE),
('subscription_price_yearly', '79.99', 'Annual subscription price in USD (12% discount)', 'subscription', 'number', FALSE, TRUE),
('trial_period_days', '30', 'Trial period duration in days', 'subscription', 'number', FALSE, TRUE),
('trial_enabled', 'true', 'Enable free trial for new subscribers', 'subscription', 'boolean', FALSE, TRUE),
('grace_period_days', '90', 'Grace period after subscription cancellation (SP frozen)', 'subscription', 'number', FALSE, TRUE),
('sp_earn_multiplier', '1.0', 'Multiplier for SP earned per $1 spent by buyer', 'swap_points', 'number', FALSE, TRUE),
('sp_max_percentage_per_purchase', '50', 'Max % of item price payable with SP (0-100)', 'swap_points', 'number', FALSE, TRUE),
('sp_pending_days', '3', 'Days SP stays pending before release (cancelable on return)', 'swap_points', 'number', FALSE, TRUE),
('sp_expiration_days', '90', 'Days until SP expires if inactive', 'swap_points', 'number', FALSE, TRUE),
('sp_min_balance_for_redemption', '100', 'Minimum SP balance required to spend', 'swap_points', 'number', FALSE, TRUE),
('sp_redemption_multiplier', '1.0', 'Exchange rate: 1 SP = X cents in discount', 'swap_points', 'number', FALSE, TRUE),
('sp_subscriber_only', 'true', 'Only Kids Club+ subscribers can earn/spend SP', 'swap_points', 'boolean', FALSE, TRUE),
('platform_fee_buyer_fixed_cents', '25', 'Fixed buyer fee in cents ($0.25)', 'fees', 'number', FALSE, TRUE),
('platform_fee_buyer_percentage', '2.5', 'Buyer fee as % of item price', 'fees', 'number', FALSE, TRUE),
('platform_fee_seller_percentage', '5', 'Seller fee as % of item price', 'fees', 'number', FALSE, TRUE),
('platform_fee_seller_discount_percentage_freemium', '0', 'Seller fee discount for free users (%)', 'fees', 'number', FALSE, TRUE),
('platform_fee_seller_discount_percentage_kids_club_plus', '0', 'Seller fee discount for Kids Club+ (%)', 'fees', 'number', FALSE, TRUE),
('stripe_transaction_fee_percentage', '2.9', 'Stripe transaction fee (%)', 'fees', 'number', FALSE, TRUE),
('stripe_transaction_fee_fixed_cents', '30', 'Stripe transaction fee (fixed cents)', 'fees', 'number', FALSE, TRUE),
('min_transaction_amount_cents', '100', 'Minimum transaction amount in cents ($1.00)', 'fees', 'number', FALSE, TRUE),
('twilio_enabled', 'true', 'Enable SMS verification via Twilio', 'sms', 'boolean', FALSE, TRUE),
('sms_verification_timeout_minutes', '10', 'SMS verification code expiration in minutes', 'sms', 'number', FALSE, TRUE),
('sms_daily_limit_per_user', '5', 'Max SMS verification attempts per user per day', 'sms', 'number', FALSE, TRUE),
('sendgrid_enabled', 'true', 'Enable transactional emails via SendGrid', 'email', 'boolean', FALSE, TRUE),
('email_from_address', 'noreply@kidsp2p.com', 'Sender email address for transactional emails', 'email', 'string', FALSE, TRUE),
('moderation_ai_enabled', 'true', 'Enable AI content moderation', 'moderation', 'boolean', FALSE, TRUE),
('moderation_human_review_threshold', 'medium', 'Trigger human review for: low/medium/high risk items', 'moderation', 'string', FALSE, TRUE),
('moderation_auto_reject_high_risk', 'false', 'Auto-reject high-risk items without review', 'moderation', 'boolean', FALSE, TRUE),
('cpsc_recall_check_enabled', 'true', 'Enable CPSC product recall checking', 'safety', 'boolean', FALSE, TRUE),
('prohibited_items_check_enabled', 'true', 'Enable prohibited items list checking', 'safety', 'boolean', FALSE, TRUE),
('firebase_analytics_enabled', 'true', 'Enable Firebase analytics event tracking', 'analytics', 'boolean', FALSE, TRUE),
('analytics_user_session_tracking', 'true', 'Track detailed user session analytics', 'analytics', 'boolean', FALSE, TRUE),
('feature_flag_sp_redemption_enabled', 'true', 'Enable Swap Points redemption feature', 'feature_flags', 'boolean', FALSE, TRUE),
('feature_flag_referral_program_enabled', 'false', 'Enable referral program (future feature)', 'feature_flags', 'boolean', FALSE, TRUE),
('feature_flag_bundle_purchases_enabled', 'false', 'Enable purchasing multiple items at once', 'feature_flags', 'boolean', FALSE, TRUE);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_admin_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_config_updated_at_trigger ON admin_config;
CREATE TRIGGER admin_config_updated_at_trigger
BEFORE UPDATE ON admin_config
FOR EACH ROW
EXECUTE FUNCTION update_admin_config_timestamp();

-- Verify the table and seeding
SELECT COUNT(*) as total_config_items FROM admin_config;
SELECT * FROM admin_config LIMIT 5;
```

**Expected Output:**
- `total_config_items` = 36
- Shows 5 sample config rows

---

## Option 2: Using Supabase CLI

If you have the CLI set up and authenticated:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Execute the migration file
supabase db execute --project-ref drntwgporzabmxdqykrp < supabase/migrations/20250113_create_admin_config.sql
```

---

## Option 3: Manual psql Connection

If you have direct database access credentials:

```bash
cat /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20250113_create_admin_config.sql | \
  psql -h db.drntwgporzabmxdqykrp.supabase.co \
       -U postgres \
       -d postgres \
       -c "password"
```

---

## ✅ After Creating the Table:

### 1. Restart Admin Portal
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run dev
```
The admin portal should now:
- ✅ Connect to PRODUCTION Supabase
- ✅ Load all 36 config settings
- ✅ Display them in the config page

### 2. Restart Mobile App
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
yarn start
```
The mobile app should now:
- ✅ Fetch subscription pricing from PRODUCTION admin_config
- ✅ Show "$7.99/month (30-Day Free Trial)"
- ✅ Allow changing price in admin portal and reflect changes immediately

### 3. Verify Everything Works

**Mobile App Test:**
1. Start the app
2. Go through signup
3. Get to SubscriptionChoiceScreen
4. Should show: "$7.99/month (30-Day Free Trial)"
5. Change price in admin portal to (e.g., $9.99)
6. Restart the mobile app
7. Should now show "$9.99/month"

**Admin Portal Test:**
1. Open admin portal
2. Go to Config Page
3. Should see all 36 settings organized by category
4. Edit any setting and save
5. Changes should persist in database

---

## 📋 Config Categories:

The 36 settings are organized into 9 categories:

1. **Subscription** (5 items)
   - subscription_price_monthly
   - subscription_price_yearly
   - trial_period_days
   - trial_enabled
   - grace_period_days

2. **Swap Points** (7 items)
   - sp_earn_multiplier
   - sp_max_percentage_per_purchase
   - sp_pending_days
   - sp_expiration_days
   - sp_min_balance_for_redemption
   - sp_redemption_multiplier
   - sp_subscriber_only

3. **Fees** (8 items)
   - platform_fee_buyer_fixed_cents
   - platform_fee_buyer_percentage
   - platform_fee_seller_percentage
   - platform_fee_seller_discount_percentage_freemium
   - platform_fee_seller_discount_percentage_kids_club_plus
   - stripe_transaction_fee_percentage
   - stripe_transaction_fee_fixed_cents
   - min_transaction_amount_cents

4. **SMS** (3 items)
   - twilio_enabled
   - sms_verification_timeout_minutes
   - sms_daily_limit_per_user

5. **Email** (2 items)
   - sendgrid_enabled
   - email_from_address

6. **Moderation** (3 items)
   - moderation_ai_enabled
   - moderation_human_review_threshold
   - moderation_auto_reject_high_risk

7. **Safety** (2 items)
   - cpsc_recall_check_enabled
   - prohibited_items_check_enabled

8. **Analytics** (2 items)
   - firebase_analytics_enabled
   - analytics_user_session_tracking

9. **Feature Flags** (3 items)
   - feature_flag_sp_redemption_enabled
   - feature_flag_referral_program_enabled
   - feature_flag_bundle_purchases_enabled

---

## 🔍 Troubleshooting:

**Issue:** "Table 'admin_config' does not exist"
- **Solution:** Run the SQL from Option 1 above in Supabase Studio

**Issue:** "Permission denied" when updating config
- **Solution:** Check that service_role key is correct in admin portal .env.local

**Issue:** Mobile app still shows old price
- **Solution:** 
  1. Make sure migration ran successfully (check database)
  2. Restart mobile app (kill and restart `yarn start`)
  3. Force refresh: `yarn start --clear`

**Issue:** Admin portal shows "Read-Only Mode"
- **Solution:** Make sure SUPABASE_SERVICE_ROLE_KEY is set in `.env.local`

---

## 📝 Files Changed Today:

1. `p2p-kids-marketplace/.env.local` - ✅ Updated to PRODUCTION
2. `p2p-kids-admin/.env.local` - ✅ Updated to PRODUCTION
3. `supabase/migrations/20250113_create_admin_config.sql` - ✅ Created

**Next Step:** Execute the SQL from "Option 1" in Supabase Studio to create the table
