# MODULE-14 VERIFICATION CHECKLIST
# Notifications System V2

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Version:** 2.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Implementation

---

## TABLE OF CONTENTS
1. [Notification Schema & Preferences](#1-notification-schema--preferences)
2. [Subscription Lifecycle Notifications](#2-subscription-lifecycle-notifications)
3. [SP Event Notifications](#3-sp-event-notifications)
4. [Badge Award Notifications](#4-badge-award-notifications)
5. [Push Notification Delivery](#5-push-notification-delivery)
6. [In-App Notification Center](#6-in-app-notification-center)
7. [Cross-Module Integration](#7-cross-module-integration)
8. [Deployment Checklist](#8-deployment-checklist)
9. [Testing Summary](#9-testing-summary)

---

## 1. NOTIFICATION SCHEMA & PREFERENCES

### Database Verification
- [ ] **Migration 140**: Notification schema deployed successfully
  - [ ] `notification_category` enum created (subscription, sp_events, badges, trades, system)
  - [ ] `notification_channel` enum created (push, in_app, email)
  - [ ] `notification_status` enum created (pending, sent, failed, read)
  - [ ] `notification_preferences` table created with all columns
  - [ ] `notifications` table created with proper indexes
  - [ ] RLS policies enabled on both tables
  - [ ] Default preferences created on user signup via trigger
  - [ ] All RPCs created (get/update preferences, mark read)

### Functional Verification
- [ ] **Default Preferences**
  - [ ] New users get all categories enabled for push + in_app
  - [ ] Email channel disabled by default (except critical)
  - [ ] Quiet hours default to 10pm-8am (22:00-08:00)
  - [ ] Quiet hours disabled by default

- [ ] **Preference Management**
  - [ ] Users can toggle push notifications per category
  - [ ] Users can toggle in-app notifications per category
  - [ ] Users can toggle email notifications per category
  - [ ] Users can enable/disable quiet hours
  - [ ] Users can set custom quiet hours start/end times
  - [ ] Preferences persist across sessions

- [ ] **Notification Storage**
  - [ ] Notifications created with correct category
  - [ ] Notifications include title, body, data fields
  - [ ] Notifications include channels array (push, in_app, email)
  - [ ] Notifications default to 'pending' status
  - [ ] read_at field null for unread notifications
  - [ ] push_sent_at field null until sent

### UI Verification
- [ ] **NotificationPreferencesScreen**
  - [ ] Category sections displayed (Subscription, SP Events, Badges, Trades, System)
  - [ ] Toggle switches for each channel (Push, In-App, Email)
  - [ ] Quiet hours toggle works
  - [ ] Quiet hours time pickers work (start/end)
  - [ ] Changes save successfully
  - [ ] Loading states display during save
  - [ ] Error states display on save failure

### Security Verification
- [ ] Users can only view/update their own preferences
- [ ] Users can only view their own notifications
- [ ] RLS policies prevent cross-user data access
- [ ] No PII exposed in notification bodies

---

## 2. SUBSCRIPTION LIFECYCLE NOTIFICATIONS

### Database Verification
- [ ] **Migration 141**: Subscription notifications deployed
  - [ ] `create_subscription_notification` RPC created
  - [ ] `send_trial_starting_notification` trigger created
  - [ ] `send_subscription_cancelled_notification` trigger created
  - [ ] Triggers fire on subscription table changes

### Functional Verification
- [ ] **Trial Starting Notification**
  - [ ] Sent immediately on subscription insert with status 'trial'
  - [ ] Title: "Welcome to Kids Club+ Trial!"
  - [ ] Body explains 30-day free trial
  - [ ] Deep link to subscription screen
  - [ ] Sent via push + in_app channels

- [ ] **Trial Expiring Notifications**
  - [ ] 7-day reminder sent when 23 days since trial_start_date
  - [ ] 3-day reminder sent when 27 days since trial_start_date
  - [ ] 1-day reminder sent when 29 days since trial_start_date
  - [ ] Each reminder title includes days remaining
  - [ ] Body explains trial expiration and payment details
  - [ ] Deep link to subscription screen
  - [ ] Sent via push + in_app channels

- [ ] **Trial Expired Notification**
  - [ ] Sent when trial status changes to 'expired'
  - [ ] Title: "Trial Expired - Subscribe to Continue"
  - [ ] Body explains subscription required for SP usage
  - [ ] Deep link to subscription screen
  - [ ] Sent via push + in_app channels

- [ ] **Subscription Renewed Notification**
  - [ ] Sent on successful subscription payment
  - [ ] Title: "Subscription Renewed"
  - [ ] Body confirms payment and next billing date
  - [ ] Deep link to subscription screen
  - [ ] Sent via push + in_app channels

- [ ] **Payment Failed Notification**
  - [ ] Sent when payment fails (critical notification)
  - [ ] Title: "Payment Failed - Action Required"
  - [ ] Body explains retry and grace period
  - [ ] Deep link to subscription screen
  - [ ] Sent via ALL channels (push + in_app + email) regardless of preferences
  - [ ] Marked as critical (always delivered)

- [ ] **Subscription Cancelled Notification**
  - [ ] Sent when subscription cancelled (trigger on update)
  - [ ] Title: "Subscription Cancelled"
  - [ ] Body explains 90-day grace period
  - [ ] Deep link to subscription screen
  - [ ] Sent via push + in_app channels

### Edge Function Verification
- [ ] **send-trial-reminders** (Daily Cron)
  - [ ] Runs daily at configured time
  - [ ] Queries trials expiring in 7, 3, 1 days
  - [ ] Creates notifications for each eligible user
  - [ ] Handles errors gracefully
  - [ ] Logs execution results

### Service Verification
- [ ] **SubscriptionNotificationService**
  - [ ] `notifyPaymentSuccess()` creates renewal notification
  - [ ] `notifyPaymentFailure()` creates critical payment failed notification
  - [ ] `notifyTrialExpired()` creates trial expired notification
  - [ ] Methods respect user preferences (except critical notifications)
  - [ ] Methods handle errors gracefully

---

## 3. SP EVENT NOTIFICATIONS

### Database Verification
- [ ] **Migration 142**: SP notifications deployed
  - [ ] `create_sp_notification` RPC created with subscription check
  - [ ] `send_sp_transaction_notification` trigger created on sp_ledger
  - [ ] `send_sp_wallet_frozen_notification` trigger created on sp_wallets
  - [ ] Triggers fire on insert/update

### Functional Verification
- [ ] **SP Earned Notification**
  - [ ] Sent when sp_ledger insert with amount > 0
  - [ ] Title: "You Earned X Swap Points!"
  - [ ] Body explains how SP was earned (reason field)
  - [ ] Deep link to SP wallet screen
  - [ ] Sent via push + in_app channels
  - [ ] **GATING**: Only sent to trial/active subscribers

- [ ] **SP Spent Notification**
  - [ ] Sent when sp_ledger insert with amount < 0
  - [ ] Title: "You Spent X Swap Points"
  - [ ] Body explains what SP was spent on (reason field)
  - [ ] Deep link to SP wallet screen
  - [ ] Sent via push + in_app channels
  - [ ] **GATING**: Only sent to trial/active subscribers

- [ ] **SP Wallet Frozen Notification**
  - [ ] Sent when sp_wallets status changes to 'frozen'
  - [ ] Title: "Swap Points Wallet Frozen"
  - [ ] Body explains subscription required
  - [ ] Deep link to subscription screen
  - [ ] Sent via push + in_app channels
  - [ ] Sent to all users (even non-subscribers)

- [ ] **SP Balance Low Notification**
  - [ ] Sent when balance drops below 10 SP
  - [ ] Title: "Low Swap Points Balance"
  - [ ] Body shows current balance and suggests earning more
  - [ ] Deep link to discovery screen (earn SP)
  - [ ] Sent via push + in_app channels
  - [ ] **DEDUPLICATION**: Only sent once per 24 hours
  - [ ] **GATING**: Only sent to trial/active subscribers

### Service Verification
- [ ] **SPNotificationService**
  - [ ] `notifyCustomSPEarned()` creates SP earned notification
  - [ ] `notifyWalletReactivated()` creates wallet reactivated notification
  - [ ] Methods check subscription status before sending
  - [ ] Methods respect user preferences
  - [ ] Methods handle errors gracefully

### Gating Verification
- [ ] Non-subscribers do NOT receive SP earned/spent notifications
- [ ] Non-subscribers do NOT receive low balance notifications
- [ ] Non-subscribers DO receive wallet frozen notifications
- [ ] Trial users receive all SP notifications
- [ ] Active subscribers receive all SP notifications

---

## 4. BADGE AWARD NOTIFICATIONS

### Database Verification
- [ ] **Migration 143**: Badge notifications deployed
  - [ ] `create_badge_notification` RPC created
  - [ ] `send_badge_earned_notification` trigger created on user_badges
  - [ ] `check_badge_milestones` RPC created
  - [ ] Trigger fires on badge award (insert)

### Functional Verification
- [ ] **Badge Earned Notification**
  - [ ] Sent immediately when user_badges insert
  - [ ] Title: "New Badge Earned: {badge_name}!"
  - [ ] Body: "Congratulations! {badge_description}"
  - [ ] Deep link to badge collection screen
  - [ ] Sent via push + in_app channels
  - [ ] Sent to ALL users (not gated by subscription)

- [ ] **Badge Milestone Approaching Notification**
  - [ ] Sent when user is 5 SP away from badge unlock
  - [ ] Title: "Almost There!"
  - [ ] Body: "You need 5 more SP to unlock {badge_name}"
  - [ ] Deep link to discovery screen
  - [ ] Sent via push + in_app channels
  - [ ] **DEDUPLICATION**: Only sent once per 7 days per badge
  - [ ] Sent to ALL users (not gated by subscription)

### Service Verification
- [ ] **BadgeNotificationService**
  - [ ] `checkMilestones()` calculates proximity to badge unlock
  - [ ] `checkMilestones()` respects 7-day deduplication
  - [ ] `celebrateCustomBadge()` shows celebration modal
  - [ ] Methods handle errors gracefully

### UI Verification
- [ ] **BadgeCelebrationModal**
  - [ ] Displays when badge earned
  - [ ] Shows badge icon/image
  - [ ] Shows badge name and description
  - [ ] Displays confetti animation (canvas-confetti)
  - [ ] Animates with framer-motion
  - [ ] "Close" button dismisses modal
  - [ ] Modal auto-dismisses after 5 seconds
  - [ ] Works on iOS and Android

### Gating Verification
- [ ] Badge notifications sent to ALL users (trial, active, expired, non-subscribers)
- [ ] Badge celebrations shown to ALL users
- [ ] No subscription checks in badge notification logic

---

## 5. PUSH NOTIFICATION DELIVERY

### Database Verification
- [ ] **Migration 144**: Push tokens deployed
  - [ ] `push_tokens` table created with all columns
  - [ ] Indexes created (user_id, is_active)
  - [ ] RLS policies enabled
  - [ ] `register_push_token` RPC created
  - [ ] RPC handles duplicate tokens correctly

### Functional Verification
- [ ] **Push Token Registration**
  - [ ] Token registered on user login
  - [ ] Token updated on app foreground
  - [ ] Multiple tokens per user supported (multiple devices)
  - [ ] Old tokens deactivated when device changes
  - [ ] Token stored with platform (ios/android)
  - [ ] Token stored with device_id

- [ ] **Rate Limiting**
  - [ ] Max 10 push notifications per user per hour enforced
  - [ ] Rate limit calculated from push_sent_at timestamps
  - [ ] Rate-limited notifications stay in pending status
  - [ ] Rate-limited notifications delivered in next batch

- [ ] **Quiet Hours Enforcement**
  - [ ] No push notifications sent during quiet hours
  - [ ] Quiet hours default to 10pm-8am (22:00-08:00)
  - [ ] User-configured quiet hours respected
  - [ ] Quiet hours notifications delivered after quiet period ends
  - [ ] Critical notifications bypass quiet hours

- [ ] **Deduplication**
  - [ ] Identical notifications within 5 minutes not sent
  - [ ] Deduplication based on user_id, type, created_at
  - [ ] Duplicate notifications marked as sent (without actual send)
  - [ ] Non-duplicate notifications sent normally

- [ ] **Retry Mechanism**
  - [ ] Failed push deliveries retried up to 3 times
  - [ ] Exponential backoff between retries
  - [ ] Permanently failed notifications marked as 'failed'
  - [ ] Error details logged for failed notifications

- [ ] **Push Receipts**
  - [ ] Push notification receipts tracked
  - [ ] Receipt status updated in database
  - [ ] Failed receipts trigger retries
  - [ ] Receipt errors logged for debugging

### Edge Function Verification
- [ ] **send-push-notifications** (Cron every 1 minute)
  - [ ] Runs every minute via cron
  - [ ] Queries pending notifications with push channel
  - [ ] Processes up to 100 notifications per run
  - [ ] Checks rate limits before sending
  - [ ] Checks quiet hours before sending
  - [ ] Checks for duplicates before sending
  - [ ] Sends push notifications via Expo SDK
  - [ ] Updates notification status after send
  - [ ] Handles errors gracefully
  - [ ] Logs execution results

### Service Verification
- [ ] **PushTokenService**
  - [ ] `registerPushToken()` requests permission
  - [ ] `registerPushToken()` gets Expo push token
  - [ ] `registerPushToken()` calls backend RPC
  - [ ] `configurePushHandlers()` sets notification handler
  - [ ] `configurePushHandlers()` handles notification taps
  - [ ] Deep links work from push notification taps

### Platform Verification
- [ ] **iOS**
  - [ ] APNs credentials configured in Expo
  - [ ] Push notifications display correctly
  - [ ] Sound plays on notification
  - [ ] Badge count updates
  - [ ] Deep links work

- [ ] **Android**
  - [ ] FCM credentials configured in Expo
  - [ ] Push notifications display correctly
  - [ ] Sound plays on notification
  - [ ] Deep links work

---

## 6. IN-APP NOTIFICATION CENTER

### Service Verification
- [ ] **NotificationCenterService**
  - [ ] `getNotifications()` returns notifications in reverse chronological order
  - [ ] `getNotifications()` supports pagination (limit, offset)
  - [ ] `getNotifications()` supports unread filter
  - [ ] `getUnreadCount()` returns correct count
  - [ ] `markAsRead()` updates notification read_at timestamp
  - [ ] `markAllAsRead()` updates all unread notifications
  - [ ] `subscribeToNotifications()` receives real-time notifications
  - [ ] Methods handle errors gracefully

### UI Verification
- [ ] **NotificationCenterScreen**
  - [ ] Displays all notifications in list
  - [ ] Shows newest notifications first
  - [ ] Unread notifications highlighted (different background)
  - [ ] Read notifications displayed normally
  - [ ] Notification icon matches category
  - [ ] Notification title displayed
  - [ ] Notification body displayed (truncated to 2 lines)
  - [ ] Notification timestamp formatted correctly (e.g., "5m ago", "2h ago", "3d ago")
  - [ ] Unread dot displayed for unread notifications
  - [ ] Pull-to-refresh reloads notifications
  - [ ] Infinite scroll loads older notifications
  - [ ] Empty state displayed when no notifications
  - [ ] "Mark All Read" button works
  - [ ] Tapping notification marks it as read
  - [ ] Tapping notification navigates to deep link screen

- [ ] **Real-Time Updates**
  - [ ] New notifications appear at top of list automatically
  - [ ] Badge count updates when new notification arrives
  - [ ] No need to refresh to see new notifications

- [ ] **NotificationBadge Component**
  - [ ] Badge displayed in tab bar/header
  - [ ] Badge shows unread count
  - [ ] Badge shows "99+" for counts > 99
  - [ ] Badge hidden when unread count is 0
  - [ ] Badge updates in real-time

### Performance Verification
- [ ] Notification list loads quickly (<500ms)
- [ ] Pagination prevents loading all notifications at once
- [ ] Real-time subscription doesn't impact app performance
- [ ] Mark as read updates optimistically (instant UI update)

---

## 7. CROSS-MODULE INTEGRATION

### MODULE-11 (Subscriptions) Integration
- [ ] **Trial Starting**: Notification sent on subscription creation
- [ ] **Trial Expiring**: Notifications sent at 7d, 3d, 1d before expiration
- [ ] **Trial Expired**: Notification sent when trial ends
- [ ] **Subscription Renewed**: Notification sent on successful payment
- [ ] **Payment Failed**: Critical notification sent on payment failure
- [ ] **Subscription Cancelled**: Notification sent when user cancels
- [ ] All subscription notifications include deep link to subscription screen
- [ ] All subscription notifications respect user preferences (except critical)

### MODULE-09 (Swap Points) Integration
- [ ] **SP Earned**: Notification sent on sp_ledger insert (amount > 0)
- [ ] **SP Spent**: Notification sent on sp_ledger insert (amount < 0)
- [ ] **Wallet Frozen**: Notification sent when sp_wallets status = 'frozen'
- [ ] **Low Balance**: Notification sent when balance < 10 SP
- [ ] SP notifications gated by subscription status (trial/active only, except frozen)
- [ ] SP notifications include deep link to SP wallet or discovery screen

### MODULE-08 (Badges) Integration
- [ ] **Badge Earned**: Notification sent on user_badges insert
- [ ] **Badge Milestone**: Notification sent when close to unlocking badge
- [ ] Badge notifications sent to ALL users (not gated)
- [ ] Badge celebration modal displays with confetti animation
- [ ] Badge notifications include deep link to badge collection screen

### MODULE-06 (Trade Flow) Integration
- [ ] Trade notification schema ready (category: 'trades')
- [ ] Trade notification triggers ready for implementation
- [ ] Trade notifications include deep link to trade detail screen
- [ ] Trade notifications respect user preferences

### MODULE-03 (Authentication) Integration
- [ ] Notification preferences initialized on user signup
- [ ] Push token registered on user login
- [ ] Push token updated on app foreground
- [ ] User ID passed to all notification services

---

## 8. DEPLOYMENT CHECKLIST

### Database Migrations
- [ ] Run migrations in order: 140, 141, 142, 143, 144
- [ ] Verify migrations applied successfully (no errors)
- [ ] Verify tables created with correct schema
- [ ] Verify indexes created
- [ ] Verify RLS policies enabled
- [ ] Verify triggers created and active
- [ ] Verify RPCs created and executable
- [ ] Test migrations on staging environment first

### Edge Functions
- [ ] Deploy `send-trial-reminders` edge function
- [ ] Deploy `send-push-notifications` edge function
- [ ] Configure cron schedules:
  - `send-trial-reminders`: Daily at 9am UTC
  - `send-push-notifications`: Every 1 minute
- [ ] Set environment variables:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
- [ ] Test edge functions manually
- [ ] Monitor edge function logs for errors

### Mobile App
- [ ] Install dependencies:
  - expo-notifications
  - expo-device
  - canvas-confetti
  - framer-motion (or react-native-reanimated)
- [ ] Configure Expo push notification credentials:
  - iOS: APNs key (from Apple Developer Portal)
  - Android: FCM server key (from Firebase Console)
- [ ] Update app.json with notification configuration
- [ ] Build and deploy mobile app update
- [ ] Test on physical devices (iOS and Android)

### Backend Services
- [ ] Deploy all notification services:
  - NotificationPreferencesService
  - SubscriptionNotificationService
  - SPNotificationService
  - BadgeNotificationService
  - NotificationCenterService
  - PushTokenService
- [ ] Update UI components:
  - NotificationPreferencesScreen
  - BadgeCelebrationModal
  - NotificationCenterScreen
  - NotificationBadge
- [ ] Test services in staging environment

### Monitoring & Alerts
- [ ] Set up monitoring for:
  - Notification delivery success rate
  - Push notification failure rate
  - Edge function execution time
  - Database query performance
- [ ] Set up alerts for:
  - High failure rate (>5%)
  - Edge function errors
  - Database connection issues
  - Push token registration failures

---

## 9. TESTING SUMMARY

### Unit Tests
- [ ] **NotificationPreferencesService Tests**
  - [ ] Get preferences returns correct data
  - [ ] Update preference saves successfully
  - [ ] Toggle category updates all channels
  - [ ] Invalid preference returns error

- [ ] **SubscriptionNotificationService Tests**
  - [ ] Payment success notification created
  - [ ] Payment failure notification marked critical
  - [ ] Trial expired notification created
  - [ ] Respects user preferences (except critical)

- [ ] **SPNotificationService Tests**
  - [ ] SP earned notification created for subscribers
  - [ ] SP earned notification NOT created for non-subscribers
  - [ ] Wallet frozen notification created for all users
  - [ ] Low balance deduplication works

- [ ] **BadgeNotificationService Tests**
  - [ ] Badge earned notification created for all users
  - [ ] Milestone notification deduplication works
  - [ ] Celebration modal displayed correctly

- [ ] **NotificationCenterService Tests**
  - [ ] Get notifications returns paginated results
  - [ ] Get unread count returns correct number
  - [ ] Mark as read updates timestamp
  - [ ] Mark all as read updates all unread
  - [ ] Real-time subscription receives new notifications

- [ ] **PushTokenService Tests**
  - [ ] Push token registration requests permission
  - [ ] Push token saved to database
  - [ ] Multiple devices supported
  - [ ] Old tokens deactivated

### Integration Tests
- [ ] **Subscription Lifecycle Flow**
  - [ ] User signs up → Trial starting notification sent
  - [ ] 23 days pass → 7-day reminder sent
  - [ ] 27 days pass → 3-day reminder sent
  - [ ] 29 days pass → 1-day reminder sent
  - [ ] Trial expires → Trial expired notification sent
  - [ ] User subscribes → Payment success notification sent
  - [ ] Payment fails → Critical payment failed notification sent (all channels)
  - [ ] User cancels → Cancellation notification sent

- [ ] **SP Earning Flow**
  - [ ] Active subscriber earns SP → Notification sent
  - [ ] Non-subscriber earns SP → NO notification sent
  - [ ] Active subscriber spends SP → Notification sent
  - [ ] Balance drops below 10 SP → Low balance notification sent
  - [ ] Balance drops below 10 SP again within 24h → NO notification sent
  - [ ] Subscription expires → Wallet frozen notification sent

- [ ] **Badge Earning Flow**
  - [ ] Any user earns badge → Notification sent + celebration modal shown
  - [ ] User 5 SP away from badge → Milestone notification sent
  - [ ] User 5 SP away from same badge within 7d → NO milestone notification sent

- [ ] **Push Notification Flow**
  - [ ] User logs in → Push token registered
  - [ ] Notification created → Push notification sent within 1 minute
  - [ ] 10 notifications sent in 1 hour → 11th notification NOT sent (rate limit)
  - [ ] Notification created during quiet hours → NOT sent until quiet hours end
  - [ ] Critical notification created during quiet hours → Sent immediately
  - [ ] Duplicate notification created within 5 min → NOT sent (marked as sent)

- [ ] **In-App Notification Flow**
  - [ ] User opens notification center → All notifications displayed
  - [ ] New notification arrives → Appears at top of list + badge count updates
  - [ ] User taps notification → Marked as read + navigates to deep link
  - [ ] User taps "Mark All Read" → All notifications marked as read

### End-to-End Tests
- [ ] **Complete User Journey**
  - [ ] User signs up → Trial starting notification received (push + in-app)
  - [ ] User views notification center → Trial starting notification displayed
  - [ ] User taps notification → Navigates to subscription screen + marked as read
  - [ ] User completes discovery → SP earned notification received
  - [ ] User opens notification center → SP earned notification displayed
  - [ ] User earns badge → Badge celebration modal shown + notification received
  - [ ] User opens preferences → Can toggle notification channels
  - [ ] User disables push for SP events → SP earned notification NOT sent via push
  - [ ] User enables quiet hours → Notifications NOT sent during quiet hours
  - [ ] Trial expires in 7 days → Trial reminder notification received
  - [ ] User subscribes → Payment success notification received
  - [ ] User cancels subscription → Cancellation notification received

### Performance Tests
- [ ] Notification center loads 100+ notifications without lag
- [ ] Real-time subscription handles high volume (100+ notifications/min)
- [ ] Edge function processes 100 notifications in <5 seconds
- [ ] Database queries use indexes (explain analyze shows index scans)
- [ ] Push notification delivery <2 seconds from creation

### Security Tests
- [ ] User cannot view other users' notifications
- [ ] User cannot update other users' preferences
- [ ] User cannot register push token for other users
- [ ] RLS policies prevent unauthorized access
- [ ] No PII exposed in notification bodies or logs

---

## VERIFICATION SIGN-OFF

| Section | Verified By | Date | Status |
|---------|-------------|------|--------|
| 1. Notification Schema & Preferences | | | ⬜️ |
| 2. Subscription Lifecycle Notifications | | | ⬜️ |
| 3. SP Event Notifications | | | ⬜️ |
| 4. Badge Award Notifications | | | ⬜️ |
| 5. Push Notification Delivery | | | ⬜️ |
| 6. In-App Notification Center | | | ⬜️ |
| 7. Cross-Module Integration | | | ⬜️ |
| 8. Deployment | | | ⬜️ |
| 9. Testing | | | ⬜️ |

---

## CRITICAL SUCCESS CRITERIA

### Must-Have Features
✅ **Multi-Channel Delivery**: Push, in-app, email notifications working  
✅ **User Preferences**: Per-category channel controls with quiet hours  
✅ **Subscription Gating**: SP notifications only to trial/active subscribers  
✅ **Critical Notifications**: Payment failures bypass all preference settings  
✅ **Rate Limiting**: Max 10 push notifications per user per hour  
✅ **Deduplication**: No duplicate notifications within 5 minutes  
✅ **Real-Time Delivery**: In-app notifications appear instantly  
✅ **Badge Celebrations**: Confetti animation on badge unlock  
✅ **Deep Linking**: All notifications navigate to relevant screens  

### Performance Targets
- Push notification delivery: <2 seconds from creation
- In-app notification delivery: <500ms (real-time)
- Notification center load time: <500ms for 100 notifications
- Edge function execution: <5 seconds for 100 notifications
- Database query time: <100ms (indexed queries only)

### Compliance Requirements
- User consent for push notifications (iOS/Android permission)
- Opt-out controls for all non-critical notifications
- Quiet hours support (no notifications during sleep hours)
- No PII in notification bodies (user names OK, emails/phone numbers NOT OK)
- Critical notifications (payment failures) always delivered

---

## NOTES

### Known Limitations
1. **Email Delivery**: Not implemented in V2 (placeholder for future)
2. **Rich Push Notifications**: Images/actions not implemented (basic text only)
3. **Notification Analytics**: Open rates, click rates not tracked yet
4. **A/B Testing**: Notification copy optimization not implemented
5. **Localization**: All notification text in English only

### Future Enhancements
1. Implement email notification delivery via SendGrid/Mailgun
2. Add rich push notifications with images and action buttons
3. Build notification analytics dashboard (open rates, click rates, conversion)
4. Create A/B testing framework for notification copy optimization
5. Add multi-language support (localized notification text)
6. Implement smart notification timing (send when user most likely to engage)
7. Add notification templates for easier content management
8. Build admin panel for sending custom notifications

### Dependencies
- **Expo Push Notifications**: Requires Expo SDK and push credentials
- **Supabase Realtime**: Required for in-app notification delivery
- **Supabase Edge Functions**: Required for push delivery and trial reminders
- **canvas-confetti**: Required for badge celebration animations
- **framer-motion** or **react-native-reanimated**: Required for modal animations

---

**END OF VERIFICATION CHECKLIST**
