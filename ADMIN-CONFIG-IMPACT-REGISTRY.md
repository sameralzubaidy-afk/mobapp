# Admin Config Impact Registry

This document tracks all admin-configurable values and their impact across the mobile app to ensure proper regression testing when config changes are made.

## How to Use This Registry

When an admin changes a config value:
1. Look up the config key in this document
2. Note all affected mobile screens, TC cases, and Maestro flows
3. Run the listed regression tests after admin changes are verified

---

## Config Keys

### `grace_period_days`

**Type:** INTEGER  
**Default:** 90  
**Description:** Number of days users have to re-subscribe before SP deletion after losing Kids Club+ access  
**Admin UI:** Subscriptions Management page

**Mobile Impact:**
- **Affected Screens:**
  - `KidsClubOverviewScreen` - Displays grace period countdown
  - `SubscriptionStatusCard` - Shows days remaining message
  - `SPWalletScreen` - Shows freeze message with countdown
  
- **TC Cases to Rerun:**
  - TC-SUB-009: Grace period countdown display
  - TC-SUB-008: Cancellation flow messaging
  
- **Maestro Flows:**
  - `subscription-grace-period.yaml` - Grace period countdown and messaging
  - `subscription-cancel.yaml` - Cancellation confirmation messaging

---

### `grace_reminder_thresholds`

**Type:** JSONB (array of integers)  
**Default:** [60, 30, 7, 1]  
**Description:** Array of day thresholds when grace period reminder notifications are sent  
**Admin UI:** Subscriptions Management page

**Mobile Impact:**
- **Affected Screens:**
  - Notification badge on `HomeScreen`
  - Push notification content
  
- **TC Cases to Rerun:**
  - TC-NOTIF-005: Grace period reminder notifications
  - TC-SUB-009: Grace period reminder timing
  
- **Maestro Flows:**
  - `notifications-grace-reminders.yaml` - Notification delivery and content

---

### `sms_rate_limit_per_hour`

**Type:** INTEGER  
**Default:** 5  
**Description:** Maximum SMS verification codes per hour per phone number  
**Admin UI:** Config Management page

**Mobile Impact:**
- **Affected Screens:**
  - `PhoneVerificationScreen` - Rate limit error messaging
  - `SignupScreen` - SMS sending flow
  
- **TC Cases to Rerun:**
  - TC-AUTH-004: Phone verification rate limiting
  
- **Maestro Flows:**
  - `auth-phone-verification.yaml` - Phone verification flow with rate limits

---

### `minimum_withdrawal_amount_cents`

**Type:** INTEGER (cents)  
**Default:** 500 ($5.00)  
**Description:** Minimum seller withdrawal amount. Set to 0 to disable minimum requirement.  
**Admin UI:** Payout Management page

**Mobile Impact:**
- **Affected Screens:**
  - `WithdrawalScreen` - Minimum amount validation
  - `SellerDashboardScreen` - Withdrawal button enable/disable logic
  
- **TC Cases to Rerun:**
  - TC-PAY-006: Minimum withdrawal validation
  - TC-PAY-007: Withdrawal button state
  
- **Maestro Flows:**
  - `seller-withdrawal.yaml` - Withdrawal flow with minimum amount validation

---

## Adding New Config Keys

When adding a new admin-configurable value:

1. Add an entry in this registry with:
   - Type and default value
   - Clear description
   - Admin UI location
   - All affected mobile screens
   - All TC cases that test behavior dependent on this value
   - All Maestro flows that should be rerun
   
2. Update this registry in the same PR/commit that adds the config value

---

## Regression Test Protocol

When admin changes a config value in production or staging:

1. **Verify admin change:**
   - Check config value persisted in `admin_config` table
   - Verify admin UI reflects the new value

2. **Run mobile regression:**
   ```bash
   # iOS
   npm run test:maestro:ios -- --include-tags <affected-flow-name>
   
   # Android
   npm run test:maestro:android -- --include-tags <affected-flow-name>
   ```

3. **Manual smoke test:**
   - Open affected screens on both platforms
   - Verify behavior reflects new config value
   - Check messaging/validation logic updates correctly

---

_Last Updated: 2026-03-01_  
_Owner: Platform Team_
