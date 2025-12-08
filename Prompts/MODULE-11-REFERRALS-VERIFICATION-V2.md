# MODULE-17 VERIFICATION CHECKLIST
# Referrals System V2

**Module:** MODULE-17-REFERRALS-V2  
**Version:** 2.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Implementation

---

## TABLE OF CONTENTS
1. [Referral Code Generation & Storage](#1-referral-code-generation--storage)
2. [SP Bonus Rewards](#2-sp-bonus-rewards)
3. [Trial Extension](#3-trial-extension)
4. [Referral Dashboard & Sharing](#4-referral-dashboard--sharing)
5. [Referral Notifications](#5-referral-notifications)
6. [Admin Referral Analytics](#6-admin-referral-analytics)
7. [Cross-Module Integration](#7-cross-module-integration)
8. [Deployment Checklist](#8-deployment-checklist)
9. [Testing Summary](#9-testing-summary)

---

## 1. REFERRAL CODE GENERATION & STORAGE

### Database Verification
- [ ] **Migration 170**: Referral codes deployed successfully
  - [ ] `referral_codes` table created with unique code constraint
  - [ ] `referral_status` enum created (pending, completed, expired)
  - [ ] `referrals` table created with proper indexes
  - [ ] Unique constraint on `referee_id` (one referrer per referee)
  - [ ] Check constraint prevents self-referral (referrer_id != referee_id)
  - [ ] RLS policies enabled on both tables
  - [ ] `generate_referral_code()` RPC created
  - [ ] `create_referral_code()` RPC created
  - [ ] `apply_referral_code()` RPC created
  - [ ] Trigger creates referral code on user signup

### Functional Verification
- [ ] **Referral Code Generation**
  - [ ] Each user gets unique 8-character code on signup
  - [ ] Codes are alphanumeric (a-z, 0-9)
  - [ ] Codes stored in lowercase
  - [ ] Codes are case-insensitive (ABC123XY = abc123xy)
  - [ ] No duplicate codes generated
  - [ ] Code generation retries on collision

- [ ] **Referral Code Application**
  - [ ] Referral code validated on signup
  - [ ] Invalid code returns error
  - [ ] Self-referral prevented (same user_id)
  - [ ] Self-referral prevented (same email)
  - [ ] Referee can only have one referrer
  - [ ] Referral relationship created with status 'pending'
  - [ ] Referral code captured in referrals table

### Service Verification
- [ ] **ReferralCodeService**
  - [ ] `getReferralCode()` returns user's code
  - [ ] `getReferralCode()` creates code if doesn't exist
  - [ ] `createReferralCode()` generates unique code
  - [ ] `applyReferralCode()` validates and applies code
  - [ ] `getReferralLink()` returns deep link with code
  - [ ] `getReferralStats()` returns accurate counts
  - [ ] Methods handle errors gracefully

### UI Verification
- [ ] **SignupScreen**
  - [ ] Referral code input field displayed
  - [ ] Referral code pre-filled from deep link
  - [ ] Invalid code shows error message
  - [ ] Valid code applied successfully
  - [ ] Signup continues even if code invalid (not blocking)

### Security Verification
- [ ] Users can only view their own referral code
- [ ] Users can view referrals where they are referrer or referee
- [ ] RLS policies prevent cross-user data access
- [ ] Self-referral prevention cannot be bypassed
- [ ] Referrer-referee relationship immutable after creation

---

## 2. SP BONUS REWARDS

### Database Verification
- [ ] **Migration 171**: Referral rewards deployed
  - [ ] `grant_referral_rewards()` RPC created
  - [ ] `trigger_referral_rewards()` trigger created on trades table
  - [ ] Trigger fires on trade status change to 'completed'
  - [ ] Subscription status checks implemented

### Functional Verification
- [ ] **SP Reward Granting**
  - [ ] SP rewards triggered when referee completes first trade
  - [ ] Referrer receives exactly 25 SP
  - [ ] Referee receives exactly 10 SP
  - [ ] SP ledger entries created with reason 'referral_bonus'
  - [ ] SP wallet balances updated correctly
  - [ ] SP wallet total_earned updated correctly
  - [ ] Referral status updated from 'pending' to 'completed'
  - [ ] reward_granted_at timestamp set
  - [ ] completed_at timestamp set

- [ ] **Subscription Gating**
  - [ ] Rewards ONLY granted if referrer has trial/active subscription
  - [ ] Rewards ONLY granted if referee has trial/active subscription
  - [ ] Rewards NOT granted if referrer subscription expired
  - [ ] Rewards NOT granted if referee subscription expired
  - [ ] Rewards NOT granted if referrer subscription cancelled
  - [ ] Rewards NOT granted if referee subscription cancelled

- [ ] **Idempotency**
  - [ ] Rewards only granted once per referral
  - [ ] Rewards NOT granted on referee's second trade
  - [ ] Rewards NOT granted on referee's third trade
  - [ ] Referral status change prevents duplicate rewards

### Service Verification
- [ ] **ReferralRewardsService**
  - [ ] `grantRewards()` calls RPC correctly
  - [ ] `checkEligibility()` returns correct status
  - [ ] Methods handle errors gracefully

### Trigger Verification
- [ ] Trigger fires when trade status changes to 'completed'
- [ ] Trigger checks if buyer is referee
- [ ] Trigger checks if seller is referee
- [ ] Trigger only fires on first completed trade
- [ ] Trigger does NOT fire on pending/cancelled trades

---

## 3. TRIAL EXTENSION

### Database Verification
- [ ] **Migration 172**: Trial extension deployed
  - [ ] `referral_extensions_used` column added to subscriptions table
  - [ ] Constraint enforces max 3 extensions
  - [ ] `grant_referral_rewards()` RPC updated to include trial extension
  - [ ] Trial extension logic integrated with reward granting

### Functional Verification
- [ ] **Trial Extension Logic**
  - [ ] Trial extended by exactly 7 days on successful referral
  - [ ] Trial extension ONLY applies if referrer status = 'trial'
  - [ ] Trial extension NOT applied if referrer status = 'active'
  - [ ] Trial extension NOT applied if referrer status = 'expired'
  - [ ] Maximum 3 extensions enforced (21 days total)
  - [ ] Extensions counter incremented correctly
  - [ ] trial_end_date updated correctly (+7 days)
  - [ ] trial_extension_applied flag set in referrals table

- [ ] **Extension Tracking**
  - [ ] referral_extensions_used starts at 0
  - [ ] referral_extensions_used increments to 1, 2, 3
  - [ ] referral_extensions_used never exceeds 3
  - [ ] Extensions tracked per subscription (not per user)

### Service Verification
- [ ] **TrialExtensionService**
  - [ ] `getExtensionStatus()` returns correct counts
  - [ ] `canExtendTrial()` returns true if < 3 extensions
  - [ ] `canExtendTrial()` returns false if >= 3 extensions
  - [ ] `canExtendTrial()` returns false if subscription not trial

### Integration Verification
- [ ] Trial extension applied in same transaction as SP rewards
- [ ] Trial extension only applied if SP rewards successfully granted
- [ ] Trial extension failure does not prevent SP rewards
- [ ] Trial extension logged in referral record

---

## 4. REFERRAL DASHBOARD & SHARING

### UI Verification
- [ ] **ReferralDashboardScreen**
  - [ ] Referral code displayed prominently
  - [ ] Referral code formatted correctly (8 characters)
  - [ ] Copy code button works
  - [ ] Copy code shows confirmation ("Copied!")
  - [ ] Share link button works
  - [ ] Share link opens native share sheet (iOS/Android)
  - [ ] Share message includes referral code
  - [ ] Share message includes deep link
  - [ ] Statistics cards display correct data
  - [ ] Referral history list displays all referrals
  - [ ] Referral history sorted by date (newest first)
  - [ ] Empty state displayed when no referrals

- [ ] **Statistics Display**
  - [ ] Total referrals count correct
  - [ ] Pending referrals count correct
  - [ ] Completed referrals count correct
  - [ ] SP earned calculated correctly (25 SP × completed referrals)
  - [ ] Trial extensions count correct
  - [ ] Trial extensions displayed as "X / 3"

- [ ] **Referral History**
  - [ ] Each referral shows referee ID (truncated)
  - [ ] Each referral shows created date
  - [ ] Each referral shows status badge (pending/completed)
  - [ ] Completed referrals highlighted
  - [ ] Trial extension badge shown when applicable ("+7 days")
  - [ ] History updates when new referral added
  - [ ] History updates when referral status changes

### Sharing Verification
- [ ] **Native Share API**
  - [ ] Share sheet opens on iOS
  - [ ] Share sheet opens on Android
  - [ ] Share message formatted correctly
  - [ ] Deep link included in share message
  - [ ] Share to SMS works
  - [ ] Share to WhatsApp works
  - [ ] Share to social media works

- [ ] **Deep Link Handling**
  - [ ] Deep link format: `kidsclub://signup?ref=CODE`
  - [ ] Deep link opens app on click
  - [ ] Referral code pre-filled from deep link
  - [ ] Invalid deep link handled gracefully

### Performance Verification
- [ ] Dashboard loads quickly (<500ms)
- [ ] Statistics calculated efficiently
- [ ] Referral history loads with pagination (if needed)
- [ ] Real-time updates when referral status changes

---

## 5. REFERRAL NOTIFICATIONS

### Database Verification
- [ ] **Migration 173**: Referral notifications deployed
  - [ ] `send_referral_invite_accepted_notification()` trigger created
  - [ ] `send_referral_rewards_notification()` trigger created
  - [ ] Triggers insert into notifications table

### Functional Verification
- [ ] **Invite Accepted Notification**
  - [ ] Sent when referee signs up with referral code
  - [ ] Sent to referrer (not referee)
  - [ ] Title: "Your Invite Was Accepted!"
  - [ ] Body explains next steps (first trade = 25 SP)
  - [ ] Category: 'system'
  - [ ] Channels: push, in_app
  - [ ] Deep link: referral_dashboard
  - [ ] Respects user preferences

- [ ] **Rewards Granted Notification (Referrer)**
  - [ ] Sent when referee completes first trade
  - [ ] Sent to referrer
  - [ ] Title: "You Earned 25 SP!"
  - [ ] Body mentions SP earned (25 SP)
  - [ ] Body mentions trial extension (if applicable)
  - [ ] Category: 'system'
  - [ ] Channels: push, in_app
  - [ ] Deep link: referral_dashboard

- [ ] **Welcome Bonus Notification (Referee)**
  - [ ] Sent when referee completes first trade
  - [ ] Sent to referee
  - [ ] Title: "Welcome Bonus: 10 SP!"
  - [ ] Body explains welcome bonus
  - [ ] Category: 'system'
  - [ ] Channels: push, in_app
  - [ ] Deep link: sp_wallet

### Service Verification
- [ ] **ReferralNotificationService**
  - [ ] `sendCustomNotification()` creates notification
  - [ ] Methods handle errors gracefully

### Integration Verification
- [ ] Notifications integrate with MODULE-14 notification system
- [ ] Notifications respect user preferences
- [ ] Notifications delivered via push (if enabled)
- [ ] Notifications displayed in-app (if enabled)
- [ ] Notifications marked as read when viewed

---

## 6. ADMIN REFERRAL ANALYTICS

### Database Verification
- [ ] **Migration 174**: Admin analytics deployed
  - [ ] `get_referral_metrics()` RPC created
  - [ ] `get_top_referrers()` RPC created
  - [ ] `get_referral_funnel()` RPC created
  - [ ] RPCs secured with admin-only access

### Functional Verification
- [ ] **Referral Metrics**
  - [ ] Total users count correct
  - [ ] Users with referrals count correct
  - [ ] Total referrals count correct
  - [ ] Pending referrals count correct
  - [ ] Completed referrals count correct
  - [ ] K-factor calculated correctly (completed referrals / users with referrals)
  - [ ] Signup to trade conversion rate correct
  - [ ] Total SP distributed calculated correctly (35 SP × completed referrals)

- [ ] **Top Referrers Leaderboard**
  - [ ] Returns top N referrers (default 10)
  - [ ] Sorted by completed referrals (descending)
  - [ ] Shows user email
  - [ ] Shows total referrals count
  - [ ] Shows completed referrals count
  - [ ] Shows total SP earned (25 SP × completed referrals)
  - [ ] Shows trial extensions earned

- [ ] **Conversion Funnel**
  - [ ] Invites sent = total referrals
  - [ ] Signups = total referrals (since row created on signup)
  - [ ] First trades = completed referrals
  - [ ] Rewards granted = completed referrals
  - [ ] Signup rate calculated correctly
  - [ ] Trade rate calculated correctly
  - [ ] Reward rate calculated correctly

### Service Verification
- [ ] **AdminReferralAnalyticsService**
  - [ ] `getMetrics()` returns correct data
  - [ ] `getTopReferrers()` returns sorted list
  - [ ] `getFunnel()` returns conversion data
  - [ ] Methods handle errors gracefully

### UI Verification
- [ ] **AdminReferralDashboard**
  - [ ] Key metrics displayed (K-factor, total referrals, completed, SP distributed)
  - [ ] Conversion funnel displayed with percentages
  - [ ] Top referrers leaderboard displayed
  - [ ] Leaderboard shows rank, email, stats
  - [ ] Dashboard loads quickly (<1 second)
  - [ ] Dashboard updates in real-time

### Security Verification
- [ ] Analytics RPCs only accessible by admins
- [ ] Non-admins cannot view analytics
- [ ] RLS policies prevent unauthorized access
- [ ] No PII exposed in analytics (emails OK for admins)

---

## 7. CROSS-MODULE INTEGRATION

### MODULE-11 (Subscriptions) Integration
- [ ] **Trial Extension**: trial_end_date extended by 7 days
- [ ] **Subscription Status Checks**: Rewards gated by trial/active status
- [ ] **referral_extensions_used**: Counter tracked in subscriptions table
- [ ] Trial extension only applies to users with status 'trial'
- [ ] Trial extension NOT applied to paid subscriptions
- [ ] Max 3 extensions enforced via database constraint

### MODULE-09 (Swap Points) Integration
- [ ] **SP Ledger Entries**: Created with reason 'referral_bonus'
- [ ] **Referrer SP**: 25 SP added to ledger and wallet
- [ ] **Referee SP**: 10 SP added to ledger and wallet
- [ ] **Wallet Balance**: Updated correctly (balance, total_earned)
- [ ] SP rewards only granted if both users have trial/active subscription
- [ ] SP rewards linked to trade_id in ledger

### MODULE-06 (Trade Flow) Integration
- [ ] **First Trade Trigger**: Rewards granted on trade status = 'completed'
- [ ] **Referee Check**: Trigger identifies if buyer/seller is referee
- [ ] **First Trade Verification**: Only first completed trade triggers rewards
- [ ] Trigger does NOT fire on pending/cancelled trades
- [ ] Trigger handles both buyer and seller as potential referee

### MODULE-14 (Notifications) Integration
- [ ] **Invite Accepted Notification**: Sent on referral row insert
- [ ] **Rewards Granted Notification**: Sent on referral status = 'completed'
- [ ] **Welcome Bonus Notification**: Sent to referee on first trade
- [ ] Notifications respect user preferences
- [ ] Notifications delivered via push and in-app
- [ ] Deep links navigate to correct screens

### MODULE-03 (Authentication) Integration
- [ ] **Referral Code Creation**: Trigger on user signup
- [ ] **Referral Code Application**: During signup flow
- [ ] **Deep Link Handling**: Referral code pre-filled from link
- [ ] Signup continues even if referral code fails (non-blocking)

### MODULE-12 (Admin Panel) Integration
- [ ] **Admin Analytics**: Accessible from admin dashboard
- [ ] **Referral Metrics**: K-factor, conversion rates, SP distribution
- [ ] **Top Referrers**: Leaderboard with user details
- [ ] **Conversion Funnel**: Signup → first trade → rewards
- [ ] Admin can view individual user's referral history

---

## 8. DEPLOYMENT CHECKLIST

### Database Migrations
- [ ] Run migrations in order: 170, 171, 172, 173, 174
- [ ] Verify migrations applied successfully (no errors)
- [ ] Verify tables created with correct schema
- [ ] Verify indexes created (user_id, referrer_id, referee_id, status)
- [ ] Verify RLS policies enabled
- [ ] Verify triggers created and active
- [ ] Verify RPCs created and executable
- [ ] Test migrations on staging environment first

### Mobile App
- [ ] Update signup screen to include referral code input
- [ ] Implement deep link handler for referral links
- [ ] Add referral dashboard screen to navigation
- [ ] Configure native share API (iOS/Android)
- [ ] Test deep link handling on physical devices
- [ ] Build and deploy mobile app update

### Backend Services
- [ ] Deploy all referral services:
  - ReferralCodeService
  - ReferralRewardsService
  - TrialExtensionService
  - ReferralNotificationService
  - AdminReferralAnalyticsService
- [ ] Update UI components:
  - SignupScreen (referral code input)
  - ReferralDashboardScreen
  - AdminReferralDashboard
- [ ] Test services in staging environment

### Monitoring & Alerts
- [ ] Set up monitoring for:
  - Referral code generation rate
  - Referral reward success rate
  - Trial extension application rate
  - K-factor trends
  - Conversion funnel drop-off points
- [ ] Set up alerts for:
  - Referral code generation failures
  - Reward granting failures
  - Suspicious referral patterns (fraud detection)
  - K-factor drops below threshold

---

## 9. TESTING SUMMARY

### Unit Tests
- [ ] **ReferralCodeService Tests**
  - [ ] Get referral code returns existing code
  - [ ] Get referral code creates code if doesn't exist
  - [ ] Create referral code generates unique code
  - [ ] Apply referral code validates correctly
  - [ ] Apply referral code prevents self-referral
  - [ ] Get referral stats calculates correctly

- [ ] **ReferralRewardsService Tests**
  - [ ] Grant rewards creates SP ledger entries
  - [ ] Grant rewards updates wallet balances
  - [ ] Grant rewards checks subscription status
  - [ ] Grant rewards is idempotent (no duplicate rewards)
  - [ ] Check eligibility returns correct status

- [ ] **TrialExtensionService Tests**
  - [ ] Get extension status returns correct counts
  - [ ] Can extend trial returns true if < 3 extensions
  - [ ] Can extend trial returns false if >= 3 extensions
  - [ ] Can extend trial returns false if not trial status

- [ ] **AdminReferralAnalyticsService Tests**
  - [ ] Get metrics returns correct calculations
  - [ ] Get top referrers returns sorted list
  - [ ] Get funnel returns correct conversion rates

### Integration Tests
- [ ] **Referral Code Flow**
  - [ ] User signs up → Referral code created automatically
  - [ ] User shares referral link → Deep link formatted correctly
  - [ ] Referee clicks link → App opens with code pre-filled
  - [ ] Referee signs up with code → Referral relationship created
  - [ ] Referrer receives invite accepted notification

- [ ] **Reward Granting Flow**
  - [ ] Referee completes first trade → Rewards triggered
  - [ ] Referrer receives 25 SP → Ledger entry created
  - [ ] Referee receives 10 SP → Ledger entry created
  - [ ] Wallets updated correctly → Balances reflect rewards
  - [ ] Referral status updated to 'completed'
  - [ ] Both users receive notifications

- [ ] **Trial Extension Flow**
  - [ ] Referrer has trial status → Extension applied
  - [ ] trial_end_date extended by 7 days
  - [ ] referral_extensions_used incremented
  - [ ] Notification mentions trial extension
  - [ ] Referrer with active subscription → No extension applied

- [ ] **Subscription Gating Flow**
  - [ ] Both users trial/active → Rewards granted
  - [ ] Referrer expired → Rewards NOT granted
  - [ ] Referee expired → Rewards NOT granted
  - [ ] Referrer cancels before reward → Rewards NOT granted
  - [ ] Referee cancels before reward → Rewards NOT granted

### End-to-End Tests
- [ ] **Complete User Journey**
  - [ ] User A signs up → Gets referral code "ABC123XY"
  - [ ] User A shares link → Native share sheet opens
  - [ ] User B clicks link → App opens with code pre-filled
  - [ ] User B signs up → Referral relationship created
  - [ ] User A receives "Invite Accepted" notification
  - [ ] User B completes first trade → Rewards triggered
  - [ ] User A receives 25 SP + trial extension + notification
  - [ ] User B receives 10 SP + notification
  - [ ] User A views dashboard → Sees 1 completed referral, 25 SP earned
  - [ ] User A makes 2 more successful referrals → Trial extended by 21 days (3 × 7)
  - [ ] User A makes 4th successful referral → NO trial extension (max 3)

### Performance Tests
- [ ] Referral code generation <100ms
- [ ] Referral dashboard loads <500ms
- [ ] Reward granting transaction <1 second
- [ ] Admin analytics loads <2 seconds
- [ ] Database queries use indexes (explain analyze)

### Security Tests
- [ ] Self-referral prevented (same user_id)
- [ ] Self-referral prevented (same email)
- [ ] User cannot view other users' referral codes
- [ ] User cannot modify other users' referral relationships
- [ ] RLS policies prevent unauthorized access
- [ ] Admin analytics only accessible by admins

### Fraud Detection Tests
- [ ] Multiple referrals from same IP address flagged
- [ ] Multiple referrals from same device flagged
- [ ] Referrals with no activity after signup flagged
- [ ] Referrals completing first trade immediately flagged (suspicious)
- [ ] Admin can review flagged referrals

---

## VERIFICATION SIGN-OFF

| Section | Verified By | Date | Status |
|---------|-------------|------|--------|
| 1. Referral Code Generation & Storage | | | ⬜️ |
| 2. SP Bonus Rewards | | | ⬜️ |
| 3. Trial Extension | | | ⬜️ |
| 4. Referral Dashboard & Sharing | | | ⬜️ |
| 5. Referral Notifications | | | ⬜️ |
| 6. Admin Referral Analytics | | | ⬜️ |
| 7. Cross-Module Integration | | | ⬜️ |
| 8. Deployment | | | ⬜️ |
| 9. Testing | | | ⬜️ |

---

## CRITICAL SUCCESS CRITERIA

### Must-Have Features
✅ **Unique Referral Codes**: 8-character codes generated on signup  
✅ **Self-Referral Prevention**: Email and user_id checks  
✅ **SP Bonus Rewards**: 25 SP referrer, 10 SP referee on first trade  
✅ **Subscription Gating**: Rewards only for trial/active users  
✅ **Trial Extension**: +7 days per successful referral (max 3)  
✅ **Shareable Links**: Deep links with code pre-filled  
✅ **Referral Dashboard**: Stats, history, share functionality  
✅ **Referral Notifications**: Invite accepted, rewards granted  
✅ **Admin Analytics**: K-factor, conversion funnel, leaderboard  

### Performance Targets
- Referral code generation: <100ms
- Referral dashboard load: <500ms
- Reward granting: <1 second (transaction time)
- Admin analytics load: <2 seconds
- Database queries: <100ms (indexed queries only)

### Business Metrics
- **K-Factor Target**: > 1.0 (viral growth)
- **Signup to First Trade Rate**: > 30%
- **Referral Completion Rate**: > 50% (pending → completed)
- **Average Referrals per User**: > 2
- **SP Distribution via Referrals**: Track as % of total SP economy

### Compliance Requirements
- Self-referral prevention cannot be bypassed
- Referral relationships immutable after creation
- No PII exposed in public referral links
- Fraud detection for suspicious patterns
- Admin-only access to analytics with PII

---

## NOTES

### Known Limitations
1. **Referral Expiration**: Referrals never expire (pending indefinitely if no trade)
2. **Fraud Detection**: Basic checks only (IP, device, email)
3. **Referral Tiers**: Not implemented (e.g., badges for 5/10/20 referrals)
4. **Social Media Integration**: Manual share only (no auto-post to Twitter/Facebook)
5. **Referral Leaderboard**: Admin-only (not exposed to users)

### Future Enhancements
1. Implement referral expiration (e.g., 90 days to complete first trade)
2. Add referral tiers with badges (5 referrals = "Recruiter" badge)
3. Create public referral leaderboard for gamification
4. Integrate social media auto-posting (Twitter, Facebook, Instagram)
5. Build A/B testing framework for referral messaging
6. Implement advanced fraud detection (ML-based pattern recognition)
7. Add referral redemption limits (e.g., max 10 referrals per month)
8. Create referral campaigns with custom rewards

### Dependencies
- **MODULE-11 (Subscriptions)**: Trial extension logic
- **MODULE-09 (Swap Points)**: SP ledger and wallet updates
- **MODULE-06 (Trade Flow)**: First trade completion trigger
- **MODULE-14 (Notifications)**: Referral event notifications
- **MODULE-03 (Authentication)**: Deep link handling, signup flow
- **MODULE-12 (Admin Panel)**: Admin analytics dashboard

### Viral Growth Strategy
- **Incentive Alignment**: Both referrer and referee benefit (25 SP + 10 SP)
- **Quality Filter**: First trade requirement ensures engaged users
- **Early Retention**: Trial extension keeps users before payment
- **Network Effects**: More referrals → more trades → more SP circulation
- **Gamification**: K-factor tracking, leaderboards, badges

---

**END OF VERIFICATION CHECKLIST**
