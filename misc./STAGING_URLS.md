# Staging Environment URLs & Access Guide

**Environment:** Staging  
**Status:** Active  
**Last Updated:** [Deployment Date]  
**Deployment Owner:** [Team Member]

---

## Quick Access Links

| Service | URL | Notes |
|---------|-----|-------|
| **Admin Panel** | https://admin-staging.p2pkidsmarketplace.com | Main admin interface |
| **EAS Build Dashboard** | https://expo.dev/dashboard | View iOS and Android builds |
| **Supabase Console** | https://supabase.com/dashboard/project/drntwgporzabmxdqykrp | Database and auth management |
| **Sentry Staging Project** | https://sentry.io/organizations/your-org/issues/ | Error tracking |
| **Amplitude Dashboard** | https://analytics.amplitude.com | Analytics and user behavior |
| **Vercel Project** | https://vercel.com/projects | Admin panel deployments |

---

## Mobile App Downloads

### iOS Staging Build

**Distribution Method:** EAS Internal Distribution  

**Steps to Install:**
1. Visit: https://expo.dev/dashboard/builds (iOS - staging profile)
2. Click the latest staging build
3. Select "Install on this device" or scan QR code
4. Follow Apple's prompts to allow installation
5. Launch "p2p-kids-marketplace (Staging)" app

**Minimum Requirements:**
- iOS 14.0+
- Device registered in developer account

**Build Info:**
- Bundle ID: `com.p2pkids.marketplace.staging`
- Distribution: Internal (test devices only)
- Environment: `APP_ENV=staging`

---

### Android Staging Build

**Distribution Method:** APK Direct Download

**Steps to Install:**
1. Visit: https://expo.dev/dashboard/builds (Android - staging profile)
2. Click the latest staging build
3. Select "Download APK"
4. Save file to device or email link
5. On Android device:
   - Go to Settings → Security → Unknown Sources (Enable)
   - Open file manager and locate APK
   - Tap APK file to install
   - Follow prompts to confirm

**Minimum Requirements:**
- Android 11+
- ~150MB free storage

**Build Info:**
- Package Name: `com.p2pkids.marketplace.staging`
- Build Type: Release APK
- Environment: `APP_ENV=staging`

---

## Admin Panel Access

**URL:** https://admin-staging.p2pkidsmarketplace.com

### Credentials

**Test Admin Account:**
- Email: `admin@test.com`
- Password: `StagingPass123!`
- Role: `admin`
- Node: All (global admin)

**Note:** Change password immediately on first login. Store in secure password manager.

### Deployment Information

- **Hosting:** Vercel
- **Repository Branch:** `staging` or `develop` (auto-deployed)
- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Environment:** `staging`
- **Region:** US (Vercel default)

---

## Backend Services

### Supabase Project

**Project URL:** https://drntwgporzabmxdqykrp.supabase.co

**Access Methods:**
1. **Supabase Studio:**
   - https://supabase.com/dashboard/project/drntwgporzabmxdqykrp
   - Login with your Supabase account (must be invited to project)

2. **REST API:**
   - Base URL: `https://drntwgporzabmxdqykrp.supabase.co/rest/v1`
   - Auth: Bearer token (JWT or anon key)
   - Examples: See API documentation section below

3. **Command Line:**
   ```bash
   supabase projects list
   supabase functions list --project-ref drntwgporzabmxdqykrp
   ```

**Database Credentials:**
- User: `postgres`
- Password: [Stored in password manager]
- Database: `postgres`

**Storage Buckets:**
- `item-images-staging` – Item photos
- `chat-images-staging` – Chat attachments
- `user-avatars-staging` – Profile photos

---

### API Endpoints

#### Authentication
```bash
# Sign up (public)
POST https://drntwgporzabmxdqykrp.supabase.co/auth/v1/signup

# Login (public)
POST https://drntwgporzabmxdqykrp.supabase.co/auth/v1/token

# Verify phone (public)
POST https://drntwgporzabmxdqykrp.supabase.co/functions/v1/auth-verify-phone
```

#### Listings
```bash
# List all active listings
GET https://drntwgporzabmxdqykrp.supabase.co/rest/v1/listings
  ?status=eq.active&select=*

# Create listing (authenticated)
POST https://drntwgporzabmxdqykrp.supabase.co/rest/v1/listings
```

#### Transactions
```bash
# Get user's transactions
GET https://drntwgporzabmxdqykrp.supabase.co/rest/v1/transactions
  ?status=eq.completed
```

#### Swap Points
```bash
# Get SP wallet balance
GET https://drntwgporzabmxdqykrp.supabase.co/functions/v1/sp-wallet-balance

# Get SP transaction history
GET https://drntwgporzabmxdqykrp.supabase.co/rest/v1/swap_points_transactions
```

**Note:** All requests require Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Error Tracking & Monitoring

### Sentry

**Dashboard:** https://sentry.io  

**Staging Project:**
- Organization: [Your Org]
- Project: `p2p-kids-marketplace-staging`
- DSN: `https://c40f622af126bb57a43c9912f3b50c45@o4510507009114112.ingest.us.sentry.io/4510514140610560`

**View Errors:**
1. Navigate to Sentry dashboard
2. Filter by environment: `staging`
3. Sort by recency or frequency
4. Click error to see full stack trace and affected users

**Key Metrics:**
- Error Rate: [X% of requests]
- Most Common Errors: [Listed by frequency]
- Affected Users: [Total unique users affected]

**Alerts Configured:**
- [ ] Spike in error rate (> 10% increase)
- [ ] New error type detected
- [ ] Critical error (P1) in production flow

---

### Amplitude Analytics

**Dashboard:** https://analytics.amplitude.com

**Staging Project:** `p2p-kids-marketplace-staging`

**Key Events Tracked:**
- `app_launch` – App started
- `user_signup` – New account created
- `user_login` – User logged in
- `listing_created` – Item listed
- `trade_initiated` – Trade request sent
- `trade_completed` – Purchase finalized
- `message_sent` – Chat message
- `sp_earned` – Swap points earned
- `sp_spent` – Swap points redeemed

**Dashboards:**
- User Acquisition: New signups and MAU
- Conversion Funnel: Signup → Listing → Trade
- Revenue: Transaction counts and amounts
- Retention: 1-day, 7-day, 30-day cohorts

---

## Testing Data

### Test User Accounts

All passwords: `Test123!`

| Email | Role | Node | Subscription |
|-------|------|------|--------------|
| testuser1@example.com | User | Norwalk CT | Free |
| testuser2@example.com | User | Norwalk CT | Kids Club+ (trial) |
| testparent@example.com | Parent | Little Falls NJ | Free |
| testadmin@example.com | Admin | All | N/A |

**Note:** Test accounts are recreated daily. For persistent testing, create your own account.

### Test Payment Method (Stripe)

**Card Number:** `4242 4242 4242 4242`  
**Expiry:** `12/34`  
**CVC:** `123`  
**Zip Code:** `12345`

This card always succeeds in test mode. For specific scenarios:
- Declined: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

---

## Deployment & Updates

### Mobile App Updates

**Deploy Staging Build:**
```bash
cd p2p-kids-marketplace
eas login
eas build --platform ios --profile staging
eas build --platform android --profile staging
```

**Wait for build to complete (10-20 minutes). Share links with testers.**

**Update Environment Variables:**
```bash
# View current secrets
eas secret:list

# Create or update a secret
eas secret:create --scope project --name SENTRY_DSN --value "new-value"
```

---

### Admin Panel Updates

**Deploy to Staging (Vercel):**
```bash
cd p2p-kids-admin
git checkout staging
git pull origin staging
# Vercel auto-deploys on push to staging branch
```

**Manual deployment (if needed):**
```bash
# Login to Vercel
vercel --scope=your-team

# Deploy to staging
vercel --prod --env staging

# View deployment URL
# Output: https://admin-staging.p2pkidsmarketplace.com
```

**Rollback:**
```bash
# View deployment history
vercel list

# Rollback to previous deployment
vercel rollback <deployment-id>
```

---

## Monitoring & Uptime

### Health Checks

**Staging Admin Panel Status:** https://uptimerobot.com
- Check status: https://status.p2pkidsmarketplace.com/staging
- Uptime SLA: 99% (best effort, staging only)
- Incident notifications: #staging-alerts Slack channel

**Manual Check:**
```bash
# Test admin panel
curl -I https://admin-staging.p2pkidsmarketplace.com

# Test Supabase API
curl https://drntwgporzabmxdqykrp.supabase.co/rest/v1/listings?limit=1 \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test auth service
curl https://drntwgporzabmxdqykrp.supabase.co/auth/v1/settings \
  -H "apiKey: YOUR_ANON_KEY"
```

---

## Support & Contact

**Issues / Bugs:** [GitHub Issues Link]  
**Slack Channel:** #staging-deployment  
**Deployment Owner:** [Name] (@slack-handle)  
**Backup Owner:** [Name] (@slack-handle)

**Emergency Contact:** [On-call engineer number]

---

## DNS & Domain Configuration

### Domain: staging.p2pkidsmarketplace.com

**Type:** CNAME  
**Target:** [Vercel deployment URL]  
**TTL:** 3600 (1 hour)  
**Proxy:** Enabled (Cloudflare)  
**Status:** ✅ Active  

### Subdomain: admin-staging.p2pkidsmarketplace.com

**Type:** CNAME  
**Target:** cname.vercel-dns.com  
**TTL:** 3600  
**Proxy:** Enabled (Cloudflare)  
**Status:** ✅ Active  

**DNS Propagation Check:**
```bash
nslookup admin-staging.p2pkidsmarketplace.com
# Should resolve to Vercel IP
```

---

## Security Notes

⚠️ **IMPORTANT:**
- Staging uses **test API keys** (not production)
- Do **NOT** share staging credentials publicly
- Store passwords in secure password manager
- Rotate admin password monthly
- Use VPN when accessing from untrusted networks
- Report security issues to [security@example.com]

**Staging Data:**
- Regularly purged (no user data retention beyond testing)
- PII not shared with third parties
- SSL/TLS enforced on all connections
- Rate limiting enabled on all APIs

---

## Troubleshooting

**App won't install on iOS?**
- Device must be registered in Apple Developer account
- Check iOS version is 14.0+
- Try clearing .expo folder and rebuilding

**App won't install on Android?**
- Enable "Unknown Sources" in device settings
- Check device has ~150MB free storage
- Try clearing Downloads folder and redownloading

**Admin panel won't load?**
- Clear browser cache (Cmd+Shift+Delete)
- Check admin-staging.p2pkidsmarketplace.com DNS
- Verify you're logged in with valid credentials
- Check Sentry for app errors

**Database queries failing?**
- Verify JWT token hasn't expired
- Check RLS policies allow the query
- Verify API key has correct permissions
- Check Supabase project is not in "paused" state

**Push notifications not arriving?**
- Verify FCM credentials configured in Supabase
- Check notification permission granted on device
- View Supabase logs for send errors
- Test with platform-specific tools

---

## Version History

| Date | Version | Changes | Deployed By |
|------|---------|---------|-------------|
| 2025-01-XX | 1.0.0 | Initial staging setup | [Name] |

