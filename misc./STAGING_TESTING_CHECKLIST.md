# Staging Testing Checklist

**Environment:** Staging  
**Date:** [Fill in deployment date]  
**Deployed by:** [Team member name]  
**Status:** [IN PROGRESS / COMPLETE]

---

## Pre-Testing Setup

- [ ] iOS staging build downloaded from EAS
- [ ] Android staging APK downloaded from EAS
- [ ] Admin panel accessible at https://admin-staging.p2pkidsmarketplace.com
- [ ] Test user accounts created in staging database
- [ ] Team members invited to Apple TestFlight or Android internal testing
- [ ] Staging database verified populated with test data

---

## Mobile App - iOS

### Installation & Launch
- [ ] App installs successfully via EAS build link
- [ ] App launches without immediate crash
- [ ] Splash screen displays correctly
- [ ] No console errors on startup

### Authentication
- [ ] User can sign up with email (new account)
- [ ] Phone verification SMS received and validated
- [ ] User can login with existing credentials
- [ ] Password reset flow works end-to-end
- [ ] Session persists after closing and reopening app
- [ ] Logout clears session properly

### User Profile
- [ ] User can view their profile
- [ ] User can edit profile (name, avatar, bio)
- [ ] Avatar upload works correctly
- [ ] Changes save immediately
- [ ] Profile is visible to other users

### Listing Management
- [ ] User can create a new listing
- [ ] Photo upload works (single and multiple)
- [ ] Image compression applied (performance check)
- [ ] Listing status transitions: draft → active → sold
- [ ] User can edit active listing
- [ ] User can delete/archive listing
- [ ] Listing appears in marketplace feed within 30 seconds

### Discovery & Search
- [ ] Marketplace feed loads smoothly (no jank)
- [ ] Swipe navigation works intuitively
- [ ] Search filters work: price range, condition, category
- [ ] Location-based filtering works
- [ ] Favorites toggle works and persists
- [ ] "No results" state displays when appropriate

### Trading / Purchasing
- [ ] User can initiate trade request on an item
- [ ] Trade request notification arrives for seller
- [ ] Seller can accept/reject trade
- [ ] Checkout flow displays correctly
- [ ] Can complete transaction with test Stripe card
- [ ] Order confirmation received
- [ ] Transaction appears in order history

### Messaging
- [ ] User can open message thread with another user
- [ ] Messages send and receive in real-time
- [ ] Message history loads on thread open
- [ ] Cannot share contact info (moderation works)
- [ ] Basic profanity filter applied
- [ ] Message timestamps display correctly
- [ ] Typing indicator shows when appropriate
- [ ] Unread message count updates

### Notifications
- [ ] Push notification received for trade request
- [ ] Push notification received for new message
- [ ] Push notification received for trade accepted
- [ ] Tap on notification opens relevant screen
- [ ] In-app notification badge displays correctly
- [ ] Notification settings can be toggled
- [ ] SMS notifications received when enabled

### Swap Points (if subscribed)
- [ ] User sees SP wallet in profile
- [ ] SP balance displays correctly
- [ ] Can view transaction history
- [ ] SP earnable on completed trade
- [ ] SP spendable in checkout (if subscriber)
- [ ] 50% cap enforced on SP usage
- [ ] Pending SP shows countdown timer

### Analytics & Error Tracking
- [ ] Sentry captures app launch event
- [ ] Sentry captures important user actions
- [ ] Amplitude logs events without errors
- [ ] No PII logged to analytics services
- [ ] Analytics dashboard shows staging data

### Performance & Stability
- [ ] App doesn't crash during 10-minute session
- [ ] Navigation doesn't stutter or freeze
- [ ] Image loading is smooth
- [ ] Chat doesn't lag with 100+ messages
- [ ] Memory usage stays reasonable (< 500MB)

---

## Mobile App - Android

### Installation & Launch
- [ ] APK installs on device/emulator
- [ ] App launches without crash
- [ ] Splash screen displays
- [ ] No logcat errors on startup

### Authentication & Core Flows
- [ ] Sign up flow completes
- [ ] SMS verification received
- [ ] Login works
- [ ] Profile editable
- [ ] Listing creation works
- [ ] Trading/purchasing works
- [ ] Messaging works
- [ ] Notifications arrive (requires FCM testing)

### Android-Specific Tests
- [ ] Back button navigation works correctly
- [ ] Orientation changes don't crash app
- [ ] Permission requests work (camera, location, contacts)
- [ ] Storage access works for photo uploads
- [ ] App resume from background works
- [ ] Deep links open correct screens (from notifications)

---

## Admin Panel

### Access & Authentication
- [ ] Admin can login at https://admin-staging.p2pkidsmarketplace.com
- [ ] Invalid credentials rejected
- [ ] Session timeout works after inactivity
- [ ] Logout redirects to login page
- [ ] Role-based access control enforced (admin role only)

### Dashboard
- [ ] Dashboard loads within 3 seconds
- [ ] User count displays correctly
- [ ] Active listings count accurate
- [ ] Today's trades count accurate
- [ ] Revenue summary shows correct numbers
- [ ] Charts/graphs render without errors

### User Management
- [ ] Can view complete user list with pagination
- [ ] Can search users by name/email
- [ ] Can view individual user profile details
- [ ] Can view user's transaction history
- [ ] Can suspend/activate user accounts
- [ ] Can view user's subscription status
- [ ] Changes reflect immediately

### Content Moderation
- [ ] Reported listings display in moderation queue
- [ ] Can approve/reject reported listings
- [ ] Can view report reasons
- [ ] Removal notifications sent to user
- [ ] Removed listings hidden from marketplace
- [ ] Can view moderation history log

### Listings Management
- [ ] Can view all active listings
- [ ] Can filter by status (active/expired/sold)
- [ ] Can view listing details (photos, description)
- [ ] Can manually remove inappropriate listings
- [ ] Changes reflect in marketplace within 1 minute

### Transactions & Analytics
- [ ] Can view all completed transactions
- [ ] Can filter by date range
- [ ] Can view transaction details (buyer, seller, amount, SP used)
- [ ] Revenue breakdown shows fees and platform revenue
- [ ] Can export transaction data (CSV)

### Configuration
- [ ] Can view and edit platform settings
- [ ] Can adjust SP earning rates (if applicable)
- [ ] Can adjust platform fees
- [ ] Can enable/disable features by country/node
- [ ] Changes apply to new transactions immediately
- [ ] Can add/edit promotional banners

### Analytics & Monitoring
- [ ] Sentry errors display in admin dashboard
- [ ] Can filter errors by severity
- [ ] Error details include stack trace
- [ ] Amplitude metrics show in analytics section
- [ ] Can segment by event type
- [ ] Database metrics accessible

### Performance
- [ ] Dashboard loads in < 3 seconds
- [ ] List views (users, listings) load in < 2 seconds per page
- [ ] Searching completes within 500ms
- [ ] Filtering updates instantly
- [ ] Large exports (1000+ records) complete in < 30 seconds

---

## Backend Infrastructure

### Database
- [ ] Supabase console accessible
- [ ] Database tables visible and populated
- [ ] RLS policies enforced (verified via queries)
- [ ] Indexes present on performance-critical columns
- [ ] Triggers firing correctly (audit logs created)

### Storage
- [ ] File uploads work (images to staging bucket)
- [ ] Files persist after 24 hours
- [ ] CloudFlare CDN serving images with <1s latency
- [ ] Storage usage within limits

### Authentication
- [ ] Email/password auth working
- [ ] Phone verification SMS sent via AWS SNS
- [ ] JWT tokens valid and refreshing correctly
- [ ] Session persistence working

### Notifications
- [ ] Push notifications received on both iOS and Android
- [ ] FCM integration working
- [ ] Email notifications sent via SendGrid
- [ ] SMS notifications sent via AWS SNS (if enabled)

### Real-time Messaging
- [ ] Supabase Realtime subscriptions working
- [ ] Messages sync across multiple devices in <2 seconds
- [ ] Presence indicators update correctly
- [ ] No duplicate messages

### SSL & Security
- [ ] HTTPS enforced on admin panel
- [ ] SSL certificate valid (no warnings)
- [ ] Security headers present (CSP, X-Frame-Options, etc.)
- [ ] CORS policies correct for staging domains

---

## DNS & Domain Configuration

- [ ] admin-staging.p2pkidsmarketplace.com resolves correctly
- [ ] DNS propagation complete (< 2 hours)
- [ ] Cloudflare cache rules working
- [ ] No DNS conflicts or redirects

---

## Known Issues & Blockers

Document any issues found during testing:

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| [Example] | P1 | Open | Reproducible on iOS 18.1 |

---

## Sign-Off

- [ ] All P0 (Critical) issues resolved
- [ ] All P1 (High) issues have workarounds or are documented
- [ ] Performance acceptable
- [ ] Security validation passed
- [ ] Ready for marketing team testing

**Tested by:** [Name]  
**Date:** [Date]  
**Overall Result:** ✅ **PASS** / ❌ **FAIL** / ⚠️ **BLOCKED**

**Notes:** [Any additional notes about staging environment]
