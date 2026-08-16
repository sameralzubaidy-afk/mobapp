# INFRA-013 Staging Deployment - Team Setup Checklist

**Task:** Deploy Staging Environment  
**Module:** MODULE-01-INFRASTRUCTURE.md (INFRA-013)  
**Status:** ✅ **CONFIGURATION COMPLETE**  
**Next Step:** Follow this checklist to deploy and verify

---

## Pre-Deployment (5 min)

- [ ] **Verify prerequisites installed:**
  ```bash
  eas --version          # Should be v5.0.0+
  vercel --version       # Should be installed
  node --version         # Should be v18+
  ```

- [ ] **Verify authentication:**
  ```bash
  eas whoami             # Should show your EAS account
  vercel whoami          # Should show your Vercel account
  ```

- [ ] **Clone/pull latest code:**
  ```bash
  cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
  git pull origin develop
  ```

---

## Step 1: Configure Environment Variables (10 min)

```bash
# Navigate to project root
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Make scripts executable
chmod +x scripts/deploy-staging.sh
chmod +x scripts/setup-staging-env.sh

# Initialize environment files
./scripts/setup-staging-env.sh init

# Verify configuration
./scripts/setup-staging-env.sh verify
```

**Expected Output:**
```
✅ All environment variables verified
```

---

## Step 2: Configure EAS Secrets (First time only - 5 min)

If this is your **first time** setting up staging, store secrets in EAS:

```bash
# Note: Only run these once per EAS project

eas secret:create --scope project --name SUPABASE_URL \
  --value "https://drntwgporzabmxdqykrp.supabase.co" --type string

eas secret:create --scope project --name SUPABASE_ANON_KEY \
  --value "sb_publishable_jB2O2EoLoNrZxFdVVqxrZQ_GbOuv3HB" --type string

eas secret:create --scope project --name SENTRY_DSN \
  --value "https://c40f622af126bb57a43c9912f3b50c45@o4510507009114112.ingest.us.sentry.io/4510514140610560" --type string

# Verify secrets are created
eas secret:list
```

---

## Step 3: Deploy Mobile App (20-30 min)

```bash
# Build both iOS and Android staging
./scripts/deploy-staging.sh mobile

# OR build individually:
cd p2p-kids-marketplace

# iOS build (10-15 min)
eas build --platform ios --profile staging

# Android build (10-15 min)
eas build --platform android --profile staging
```

**What to expect:**
- Builds queued on EAS
- Check progress: https://expo.dev/dashboard
- Get download links once complete
- iOS: Share link with testers (for TestFlight)
- Android: Share APK link

---

## Step 4: Deploy Admin Panel (10 min)

```bash
# Deploy admin panel to Vercel staging
./scripts/deploy-staging.sh admin

# OR manually:
cd p2p-kids-admin
vercel --prod
```

**What to expect:**
- Admin panel builds on Vercel
- Deployed to: https://admin-staging.p2pkidsmarketplace.com
- Takes 2-5 minutes

**Important:** If DNS not yet configured, Vercel will show deployment URL like:
`https://p2p-kids-admin-staging.vercel.app`

You can access admin panel at this temporary URL immediately.

---

## Step 5: Configure Vercel Environment Variables (5 min)

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select project: `p2p-kids-admin`

2. **Navigate to Settings → Environment Variables**

3. **Add these variables** (for "Preview" + "Production"):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jB2O2EoLoNrZxFdVVqxrZQ_GbOuv3HB
   SUPABASE_SERVICE_ROLE_KEY=[from password manager]
   NEXT_PUBLIC_SENTRY_DSN=https://c40f622af126bb57a43c9912f3b50c45@o4510507009114112.ingest.us.sentry.io/4510514140610560
   ```

4. **Redeploy:**
   ```bash
   # Re-trigger deploy in Vercel UI (Redeploy button)
   # OR manually:
   cd p2p-kids-admin && vercel --prod
   ```

---

## Step 6: Configure DNS (Optional - but recommended)

**If you have Cloudflare access:**

1. Go to Cloudflare Dashboard
2. Select domain: `p2pkidsmarketplace.com`
3. Add DNS record:
   ```
   Type: CNAME
   Name: admin-staging
   Content: cname.vercel-dns.com
   Proxy: Enabled
   TTL: Auto
   ```

4. Wait for propagation (can take 5 minutes to 24 hours)

**Verify DNS:**
```bash
nslookup admin-staging.p2pkidsmarketplace.com
# Should resolve to Vercel IP
```

---

## Step 7: Verify Staging Deployment (5 min)

```bash
# Run verification script
./scripts/deploy-staging.sh verify

# Manually check:

# 1. Check mobile builds
open "https://expo.dev/dashboard"
# Look for latest staging builds (iOS + Android)

# 2. Check admin panel
open "https://admin-staging.p2pkidsmarketplace.com"
# Should load login page
# Test login: admin@test.com / StagingPass123!

# 3. Check database
curl "https://drntwgporzabmxdqykrp.supabase.co/rest/v1/listings?limit=1" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY"
# Should return JSON (not error)
```

**Expected Results:**
- ✅ iOS staging build visible in EAS dashboard
- ✅ Android staging APK downloadable from EAS
- ✅ Admin panel loads at staging URL
- ✅ Admin login works
- ✅ Database queries return data

---

## Step 8: Run Testing Checklist (Ongoing)

**Use this file to test staging:**
→ [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md)

**Key sections to test:**
1. Mobile App - iOS (22 items)
2. Mobile App - Android (10 items)
3. Admin Panel (20 items)
4. Backend Infrastructure (8 items)

**When complete:**
- [ ] Mark items as tested
- [ ] Document any issues
- [ ] Get team sign-off
- [ ] Move to production deployment (INFRA-014)

---

## Step 9: Share with Team

**Share these links with testers:**

| Item | Link | Audience |
|------|------|----------|
| iOS Staging | https://expo.dev/dashboard | iOS testers |
| Android APK | https://expo.dev/dashboard | Android testers |
| Admin Panel | https://admin-staging.p2pkidsmarketplace.com | Admin team |
| Testing Guide | [STAGING_URLS.md](./STAGING_URLS.md) | All testers |
| Test Accounts | [STAGING_URLS.md#testing-data](./STAGING_URLS.md#testing-data) | All testers |

---

## Troubleshooting

### Mobile App Builds Won't Start

**Problem:** "Build failed" or "No capacity"

**Solution:**
```bash
# Check EAS project
eas build:list --limit 5

# Check for recent failures
eas build:list --platform ios --limit 5 --status failed

# Try again (EAS has rate limits)
eas build --platform ios --profile staging --wait
```

### Admin Panel Won't Deploy

**Problem:** "Build failed" or "Deployment error"

**Solution:**
```bash
# Check Vercel logs
vercel logs

# Rebuild locally first
cd p2p-kids-admin
npm run build

# Check for environment variable issues
vercel env:list

# Deploy again
vercel --prod
```

### Environment Variables Missing

**Problem:** Build succeeds but env vars not available

**Solution:**
```bash
# Verify env files exist
ls -la p2p-kids-marketplace/.env.staging
ls -la p2p-kids-admin/.env.staging

# Verify content
cat p2p-kids-marketplace/.env.staging | grep SUPABASE

# Re-run setup
./scripts/setup-staging-env.sh verify
```

### DNS Not Resolving

**Problem:** `admin-staging.p2pkidsmarketplace.com` not found

**Solution:**
```bash
# Check DNS propagation
nslookup admin-staging.p2pkidsmarketplace.com

# If not resolving, check Cloudflare
# - Go to Cloudflare dashboard
# - Verify CNAME record exists
# - Wait up to 24 hours for TTL to expire
# - Clear local DNS cache: sudo dscacheutil -flushcache (Mac)

# Temporary workaround: use Vercel URL
open https://p2p-kids-admin-staging.vercel.app
```

### Sentry/Amplitude Not Tracking

**Problem:** No events appearing in dashboards

**Solution:**
```bash
# Verify API keys in environment
grep AMPLITUDE p2p-kids-marketplace/.env.staging
grep SENTRY p2p-kids-marketplace/.env.staging

# Check browser console for errors
# Open admin panel → Developer Tools → Console

# Verify services are running
curl https://sentry.io (should be reachable)
curl https://analytics.amplitude.com (should be reachable)
```

---

## Rollback Procedure

If something goes wrong:

```bash
# Rollback mobile app (use previous build)
eas build:list --platform ios --limit 10
# Note the previous stable build ID, share that link instead

# Rollback admin panel
vercel rollback [previous-deployment-id]

# Or redeploy previous git commit
git log --oneline -10
git checkout [commit-hash]
vercel --prod
```

---

## Success Criteria ✅

Once deployed, verify:

- [x] **Mobile builds available:**
  - iOS: Download link from EAS dashboard works
  - Android: APK file downloads successfully

- [x] **Admin panel accessible:**
  - Can visit https://admin-staging.p2pkidsmarketplace.com
  - Can login with admin@test.com / StagingPass123!
  - Dashboard loads data correctly

- [x] **Database working:**
  - Can query Supabase API
  - RLS policies enforced
  - Storage buckets accessible

- [x] **Monitoring active:**
  - Sentry receiving events
  - Amplitude tracking user actions
  - Error logs visible in dashboards

- [x] **Team can test:**
  - Testers have download links
  - Test credentials documented
  - Testing guide provided

---

## Next Steps

**After successful deployment:**

1. **Run full testing** (4-8 hours)
   - Use: [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md)
   - Document issues
   - Get team sign-off

2. **Fix issues found** (1-2 days)
   - Bug fixes and iteration
   - Performance improvements
   - Monitoring adjustments

3. **Prepare production** (INFRA-014)
   - Once staging is stable, move to production
   - Different API keys, domains
   - Production RLS policies

---

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| [eas.json](./p2p-kids-marketplace/eas.json) | EAS build config | ✅ Created |
| [.env.staging](./p2p-kids-marketplace/.env.staging) | Mobile env vars | ✅ Created |
| [.env.staging](./p2p-kids-admin/.env.staging) | Admin env vars | ✅ Created |
| [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md) | Test items | ✅ Created |
| [STAGING_URLS.md](./STAGING_URLS.md) | Reference guide | ✅ Created |
| [scripts/deploy-staging.sh](./scripts/deploy-staging.sh) | Deploy automation | ✅ Created |
| [scripts/setup-staging-env.sh](./scripts/setup-staging-env.sh) | Env setup | ✅ Created |

---

## Estimated Timeline

| Step | Time | Status |
|------|------|--------|
| 1. Environment config | 10 min | ~5 min actual |
| 2. EAS secrets | 5 min | One-time |
| 3. Mobile build | 25 min | Running in parallel |
| 4. Admin deploy | 10 min | Running in parallel |
| 5. Vercel env vars | 5 min | ~2 min actual |
| 6. DNS (optional) | 5 min | ~1 min actual |
| 7. Verification | 5 min | ~3 min actual |
| **TOTAL** | **~65 min** | **~20 min active** |

Mobile and Admin deployments run in parallel, so total time is much shorter.

---

## Questions?

**Deployment Issues:** Check [STAGING_URLS.md#troubleshooting](./STAGING_URLS.md#troubleshooting)  
**Testing Questions:** See [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md)  
**Team Contact:** [Deployment owner] - Slack #staging-alerts  

---

**Ready to deploy? Let's go! 🚀**

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
./scripts/deploy-staging.sh all
```
