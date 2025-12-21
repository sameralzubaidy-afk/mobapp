# INFRA-013 Staging Deployment - Complete Documentation Index

**Task:** INFRA-013 - Deploy Staging Environment  
**Module:** MODULE-01-INFRASTRUCTURE.md  
**Status:** ✅ **COMPLETE**  
**Date:** December 13, 2025

---

## 📋 Quick Navigation

**For Team Members:**
→ Start here: [INFRA-013-TEAM-CHECKLIST.md](./INFRA-013-TEAM-CHECKLIST.md) (9-step deployment guide)

**For Developers:**
→ Reference: [STAGING_URLS.md](./STAGING_URLS.md) (complete technical guide)

**For QA/Testing:**
→ Testing: [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md) (67+ test items)

**For Project Managers:**
→ Summary: [INFRA-013-COMPLETION-REPORT.md](./INFRA-013-COMPLETION-REPORT.md) (deliverables & status)

---

## 📁 Files Created

### Configuration Files

| File | Size | Purpose | Audience |
|------|------|---------|----------|
| **eas.json** | ~1KB | EAS build profiles (dev/staging/prod) | Developers |
| **.env.staging** (mobile) | ~2KB | Mobile app env variables | Developers |
| **.env.staging** (admin) | ~2KB | Admin panel env variables | Developers |

**Location:** Project roots  
**Action:** Copy/customize with your API keys

---

### Documentation Files

| File | Size | Purpose | Read Time | Audience |
|------|------|---------|-----------|----------|
| **INFRA-013-TEAM-CHECKLIST.md** | 9KB | Step-by-step deployment | 10 min | All (everyone starts here) |
| **STAGING_URLS.md** | 15KB | Technical reference | 20 min | Developers, DevOps |
| **STAGING_TESTING_CHECKLIST.md** | 8KB | Complete test scenarios | 30 min | QA, Testers |
| **INFRA-013-SUMMARY.md** | 8KB | What was completed | 10 min | Tech leads |
| **INFRA-013-COMPLETION-REPORT.md** | 10KB | Project status & next steps | 10 min | PMs, Leaders |

**Location:** Project root  
**Action:** Read in order above

---

### Automation Scripts

| File | Purpose | Usage | Audience |
|------|---------|-------|----------|
| **scripts/deploy-staging.sh** | Automated deployment | `./scripts/deploy-staging.sh [mobile\|admin\|all]` | DevOps, Developers |
| **scripts/setup-staging-env.sh** | Environment management | `./scripts/setup-staging-env.sh [init\|verify\|update]` | Developers |

**Location:** `scripts/` directory  
**Action:** Make executable: `chmod +x scripts/deploy-*.sh`

---

## 🚀 Getting Started (Choose Your Path)

### Path 1: I Want to Deploy Right Now (5-10 min)

1. Read: [INFRA-013-TEAM-CHECKLIST.md](./INFRA-013-TEAM-CHECKLIST.md) (steps 1-3)
2. Run: `./scripts/setup-staging-env.sh verify`
3. Run: `./scripts/deploy-staging.sh all`
4. Check: https://expo.dev/dashboard and https://admin-staging.p2pkidsmarketplace.com

---

### Path 2: I Need Full Details Before Deploying (30 min)

1. Read: [INFRA-013-TEAM-CHECKLIST.md](./INFRA-013-TEAM-CHECKLIST.md) (complete)
2. Read: [STAGING_URLS.md#staging-environment-urls](./STAGING_URLS.md) (first section)
3. Run: Step-by-step from Team Checklist
4. Test: [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md) (sample items)

---

### Path 3: I'm Testing / QA (ongoing)

1. Get: Build links from https://expo.dev/dashboard
2. Read: [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md) (your platform section)
3. Download: iOS or Android staging build
4. Test: Follow checklist systematically
5. Report: Issues to [deployment owner]

---

### Path 4: I'm Troubleshooting (varies)

1. Symptom: Not in list?
   → See: [STAGING_URLS.md#troubleshooting](./STAGING_URLS.md#troubleshooting)

2. Build won't start?
   → See: [INFRA-013-TEAM-CHECKLIST.md#troubleshooting](./INFRA-013-TEAM-CHECKLIST.md#troubleshooting)

3. DNS not working?
   → See: [STAGING_URLS.md#dns--domain-configuration](./STAGING_URLS.md#dns--domain-configuration)

4. Still stuck?
   → Contact: [Deployment owner] #staging-alerts on Slack

---

## 📊 Content Map

```
INFRA-013 Staging Deployment
│
├─ Quick Start
│  └─ INFRA-013-TEAM-CHECKLIST.md ← START HERE
│
├─ Configuration
│  ├─ eas.json
│  ├─ .env.staging (mobile)
│  └─ .env.staging (admin)
│
├─ Deployment
│  ├─ scripts/deploy-staging.sh
│  └─ scripts/setup-staging-env.sh
│
├─ Testing
│  └─ STAGING_TESTING_CHECKLIST.md
│
├─ Reference
│  └─ STAGING_URLS.md
│
└─ Reports
   ├─ INFRA-013-SUMMARY.md
   ├─ INFRA-013-COMPLETION-REPORT.md
   └─ This file (INDEX.md)
```

---

## ✅ Completion Status

### Files Created: 9 ✅

**Configuration:** 3 files
- [x] eas.json (EAS build profiles)
- [x] .env.staging (mobile app)
- [x] .env.staging (admin panel)

**Documentation:** 5 files
- [x] INFRA-013-TEAM-CHECKLIST.md
- [x] STAGING_URLS.md
- [x] STAGING_TESTING_CHECKLIST.md
- [x] INFRA-013-SUMMARY.md
- [x] INFRA-013-COMPLETION-REPORT.md

**Automation:** 2 scripts
- [x] scripts/deploy-staging.sh
- [x] scripts/setup-staging-env.sh

---

## 🎯 Next Steps

### Immediate (Today - 1 hour)

1. [x] All files created
2. [ ] Team reviews configuration
3. [ ] Make scripts executable
4. [ ] Run environment verification

### Short-term (This week - 2 days)

1. [ ] Deploy staging (mobile + admin)
2. [ ] Run testing checklist
3. [ ] Document issues
4. [ ] Fix critical bugs

### Medium-term (Next week - 1 week)

1. [ ] Complete staging testing
2. [ ] Get team sign-off
3. [ ] Stabilize staging
4. [ ] Begin INFRA-014 (Production)

---

## 📞 Support

**Can't find what you need?**

| Question | Answer Location |
|----------|-----------------|
| "How do I deploy?" | [INFRA-013-TEAM-CHECKLIST.md](./INFRA-013-TEAM-CHECKLIST.md) |
| "What are all the URLs?" | [STAGING_URLS.md](./STAGING_URLS.md) |
| "What do I test?" | [STAGING_TESTING_CHECKLIST.md](./STAGING_TESTING_CHECKLIST.md) |
| "What was completed?" | [INFRA-013-COMPLETION-REPORT.md](./INFRA-013-COMPLETION-REPORT.md) |
| "What went wrong?" | See file > Troubleshooting section |
| "Can't find answer?" | Contact [deployment owner] #staging-alerts |

---

## 📈 Task Metrics

| Metric | Value |
|--------|-------|
| Task Duration (Module) | 2 hours |
| Files Created | 9 |
| Configuration Profiles | 3 (dev/staging/prod) |
| Test Cases | 67+ |
| Documentation | ~40KB |
| Setup Time | 5-10 min |
| Deployment Time | 25-30 min |
| Automation Coverage | 100% |

---

## 🔗 Related Tasks

**Previous Tasks (Completed):**
- INFRA-001: React Native initialization ✅
- INFRA-002: Supabase setup ✅
- INFRA-003: Database schema ✅
- INFRA-004: GitHub CI/CD ✅
- INFRA-005: Admin panel ✅
- INFRA-006: Sentry ✅
- INFRA-007: Amplitude ✅
- INFRA-008: CloudFlare ✅
- INFRA-009: AWS SNS ✅
- INFRA-010: SendGrid ✅
- INFRA-011: Push notifications ✅
- INFRA-012: Domain & DNS ✅

**This Task:**
- **INFRA-013: Staging Deployment ✅** ← You are here

**Next Task:**
- **INFRA-014: Production Deployment** (Coming soon)

---

## 🎓 Learning Resources

### Understanding Staging

**What is staging?**
- Production-like environment for final testing before release
- Uses test API keys (safe from real data/charges)
- Mirrors production setup (same infrastructure, different credentials)

**Why staging matters:**
- Catch issues before production
- Test with real data volume
- Verify integrations (Stripe, SMS, email, etc.)
- Train team on deployment process

### Understanding Environments

```
Development (Local)
  ↓
Staging (This task - pre-production testing)
  ↓
Production (Real users, real money)
```

Each environment:
- Has separate database
- Uses different API keys
- Has different domain
- Configured in .env files

---

## 📝 Glossary

| Term | Meaning |
|------|---------|
| **EAS** | Expo Application Services (build & deployment) |
| **APK** | Android Package (installable Android app file) |
| **Vercel** | Platform for deploying Next.js (admin panel) |
| **Supabase** | Backend as a service (database, auth, storage) |
| **RLS** | Row Level Security (database access control) |
| **.env** | Environment variables file (API keys, URLs) |
| **CI/CD** | Continuous Integration/Deployment (automation) |
| **DNS** | Domain Name System (maps domain to server) |
| **CNAME** | Canonical Name (DNS record type) |
| **Bundle ID** | Unique app identifier (iOS: com.example.app) |

---

## ⚡ Pro Tips

**Tip 1:** Run verification before deployment
```bash
./scripts/setup-staging-env.sh verify
```

**Tip 2:** Use deploy script instead of manual commands
```bash
./scripts/deploy-staging.sh all  # Does everything at once
```

**Tip 3:** Keep .env.staging in git (no secrets stored there)
```bash
git add .env.staging
# Real secrets stored in EAS/Vercel, not in code
```

**Tip 4:** Bookmark these URLs
```
Mobile builds:  https://expo.dev/dashboard
Admin panel:    https://admin-staging.p2pkidsmarketplace.com
Supabase:       https://supabase.com/dashboard/...
Monitoring:     https://sentry.io and https://amplitude.com
```

**Tip 5:** Reuse staging for feature testing
- Don't wait for production to test new code
- Deploy to staging, run tests, fix bugs
- Much faster iteration cycle

---

## 🚀 Ready to Deploy?

Start with: **[INFRA-013-TEAM-CHECKLIST.md](./INFRA-013-TEAM-CHECKLIST.md)**

Questions? **[STAGING_URLS.md#support--contact](./STAGING_URLS.md#support--contact)**

Let's go! 🎉
