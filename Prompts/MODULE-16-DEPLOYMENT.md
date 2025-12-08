---

## Prompt Addendum: Deployment Runbook + Rollback + DR

### AI Prompt for Cursor (Ops Runbook)
```typescript
/*
TASK: Create deployment runbook steps and rollback procedure

REQUIREMENTS:
1. Config keys: Stripe (secret, webhook), Supabase (URL, anon, service), Vercel envs, Cloudflare DNS/SSL.
2. Validation steps: health checks for API routes, webhook receivers, CDN assets.
3. Rollback: tagged releases; database migration rollback notes; feature flags to disable modules.
4. DR plan pointer: backups schedule; restore procedure; RPO/RTO targets.

FILES:
- ops/DEPLOYMENT_RUNBOOK.md (step-by-step)
- ops/ROLLBACK.md (procedures)
*/
```

### Acceptance Criteria
- Runbook lists configs, validation checks, and timelines
- Rollback documented and tested in staging
- DR plan referenced with backup/restore steps

# MODULE 16: DEPLOYMENT & LAUNCH PREP

**Timeline:** Week 22-24  
**Total Tasks:** 17  
**Estimated Time:** ~65 hours

---

## Overview

This module covers production deployment, app store submissions, monitoring setup, security audits, beta testing, and public launch. By the end of this module, your app will be live in production with users actively trading.

**Key Deliverables:**
- Production infrastructure fully configured
- iOS and Android apps submitted to stores
- Monitoring and analytics operational
- Security and performance audited
- Beta launch with initial users
- Public rollout complete

---

## TASK DEPLOY-001: Set Up Production Supabase Project (Separate from Staging)

**Duration:** 4 hours  
**Priority:** Critical  
**Dependencies:** All previous modules

### Description
Create a new Supabase project specifically for production. This ensures staging/development changes don't affect live users. Configure all database tables, RLS policies, Edge Functions, and secrets. Migrate schema from staging to production.

---

### AI Prompt for Claude Sonnet 4.5 (Production Supabase Setup)

```bash
TASK: Set up production Supabase project

CONTEXT:
We need a separate Supabase project for production to isolate it from staging/dev environments.

REQUIREMENTS:
1. Create new Supabase project (production tier)
2. Run all database migrations in order
3. Deploy all Edge Functions
4. Configure all secrets (API keys, Stripe keys, etc.)
5. Set up connection pooling (PgBouncer)
6. Enable Point-in-Time Recovery (PITR)
7. Configure automated backups
8. Document connection strings and API keys

STEPS:

1. Create Production Project:
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Name: "yourapp-production"
   - Region: Choose closest to users (e.g., us-east-1)
   - Database Password: Generate strong password (save in 1Password/Vault)
   - Pricing Tier: Pro ($25/month minimum for production features)

2. Run Database Migrations:
   - Connect to production database via Supabase SQL Editor
   - Run migrations in order (001 through 052):
     * 001_initial_schema.sql (users, profiles tables)
     * 002_auth_policies.sql (RLS for auth)
     * 003_nodes.sql (community nodes)
     * 004_items.sql (listings)
     * 005_trades.sql (trade records)
     * ... (all migrations through 052)
   - Verify each migration succeeded before next
   - Check for errors in logs

3. Deploy Edge Functions:
   supabase login
   supabase link --project-ref <production-project-ref>
   supabase functions deploy import-cpsc-recalls
   supabase functions deploy check-item-safety
   supabase functions deploy moderate-image
   supabase functions deploy moderate-text
   supabase functions deploy send-push-notification
   supabase functions deploy send-email-notification
   supabase functions deploy send-unread-message-emails
   supabase functions deploy send-sms
   supabase functions deploy complete-trade
   supabase functions deploy cancel-trade
   supabase functions deploy create-subscription
   supabase functions deploy cancel-subscription
   supabase functions deploy subscription-webhook

4. Configure Secrets (Edge Functions):
   supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
   supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
   supabase secrets set GOOGLE_VISION_API_KEY="..."
   supabase secrets set OPENAI_API_KEY="sk-..."
   supabase secrets set SENDGRID_API_KEY="SG...."
   supabase secrets set AWS_ACCESS_KEY_ID="..."
   supabase secrets set AWS_SECRET_ACCESS_KEY="..."
   supabase secrets set EXPO_ACCESS_TOKEN="..."

5. Enable Extensions:
   -- In SQL Editor
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   CREATE EXTENSION IF NOT EXISTS "pg_cron";
   CREATE EXTENSION IF NOT EXISTS "pg_net";

6. Configure PgBouncer (Connection Pooling):
   - Supabase Pro tier includes PgBouncer automatically
   - Use pooled connection string for serverless/lambda functions
   - Use direct connection string for long-running processes
   - Connection strings found in: Project Settings > Database

7. Enable Point-in-Time Recovery:
   - Go to Project Settings > Database > Backups
   - Enable PITR (included in Pro tier)
   - Allows restore to any point in last 7 days
   - Critical for production disaster recovery

8. Schedule pg_cron Jobs:
   -- Daily CPSC import (2:00 AM)
   SELECT cron.schedule(
     'import-cpsc-recalls',
     '0 2 * * *',
     $$SELECT net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/import-cpsc-recalls',
       headers := '{"Authorization": "Bearer <anon-key>"}'::jsonb
     )$$
   );

   -- Hourly unread message emails
   SELECT cron.schedule(
     'send-unread-message-emails',
     '0 * * * *',
     $$SELECT net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/send-unread-message-emails',
       headers := '{"Authorization": "Bearer <anon-key>"}'::jsonb
     )$$
   );

   -- Daily trend snapshots (midnight)
   SELECT cron.schedule(
     'daily-trend-snapshot',
     '0 0 * * *',
     $$INSERT INTO trend_snapshots (
       snapshot_date,
       total_users,
       new_users_last_24h,
       total_trades,
       new_trades_last_24h,
       active_listings
     ) SELECT ...$$
   );

   -- Daily subscription expiration check
   SELECT cron.schedule(
     'expire-subscriptions',
     '0 1 * * *',
     $$UPDATE users SET subscription_tier = 'free' WHERE subscription_ends_at < NOW()$$
   );

9. Verify Production Setup:
   [ ] All migrations applied successfully
   [ ] All Edge Functions deployed and working
   [ ] All secrets configured
   [ ] Extensions enabled
   [ ] PgBouncer connection pooling active
   [ ] PITR enabled
   [ ] pg_cron jobs scheduled
   [ ] RLS policies active (test with regular user, not service role)

10. Document Production Credentials:
    Create .env.production file (DO NOT COMMIT):
    NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
    SUPABASE_SERVICE_ROLE_KEY=eyJ...
    DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres
    DATABASE_URL_POOLED=postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

    Store these in:
    - Vercel Environment Variables (for admin panel)
    - React Native app config (for mobile app)
    - 1Password/Vault (for team access)

ACCEPTANCE CRITERIA:
✓ Production Supabase project created (Pro tier)
✓ All database migrations applied
✓ All Edge Functions deployed
✓ All secrets configured
✓ Extensions enabled
✓ Connection pooling active
✓ PITR enabled
✓ pg_cron jobs scheduled
✓ Credentials documented and stored securely

COST: ~$25/month (Supabase Pro) + $10/GB over 8GB storage + $2.50/GB bandwidth over 50GB
```

### Time Breakdown
- Create project and configure: 1 hour
- Run all migrations: 1 hour
- Deploy Edge Functions: 1 hour
- Configure secrets and cron jobs: 1 hour

**Total: ~4 hours**

---

## TASK DEPLOY-002: Deploy Production Admin Panel to Vercel

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** DEPLOY-001 (Production Supabase)

### Description
Deploy the Next.js admin panel to Vercel with production Supabase credentials. Configure custom domain (admin.yourapp.com). Set up environment variables, build settings, and automatic deployments from main branch.

---

### AI Prompt for Claude Sonnet 4.5 (Vercel Deployment)

```bash
TASK: Deploy admin panel to Vercel

CONTEXT:
The Next.js admin panel needs to be deployed to production with proper configuration.

REQUIREMENTS:
1. Deploy to Vercel
2. Configure environment variables (production Supabase)
3. Set up custom domain (admin.yourapp.com)
4. Enable automatic deployments from GitHub main branch
5. Configure build settings
6. Test authentication and all admin features

STEPS:

1. Prepare Admin Panel for Deployment:
   cd admin
   npm run build  # Test build locally
   # Fix any build errors before deploying

2. Deploy to Vercel:
   - Install Vercel CLI: npm i -g vercel
   - Login: vercel login
   - Deploy: vercel --prod
   - Or use Vercel Dashboard:
     * Go to https://vercel.com/new
     * Import Git Repository (yourapp-admin)
     * Select main branch
     * Framework Preset: Next.js
     * Root Directory: ./admin (if monorepo)
     * Click Deploy

3. Configure Environment Variables (Vercel Dashboard):
   Project Settings > Environment Variables > Production
   
   NEXT_PUBLIC_SUPABASE_URL=https://<production-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXTAUTH_URL=https://admin.yourapp.com
   NEXTAUTH_SECRET=<generate-random-secret>
   STRIPE_SECRET_KEY=sk_live_...
   AMPLITUDE_API_KEY=...

4. Configure Custom Domain:
   Project Settings > Domains
   - Add domain: admin.yourapp.com
   - Copy DNS records shown by Vercel
   - Add to your domain provider (Cloudflare, Namecheap, etc.)
   - Wait for DNS propagation (5-60 minutes)
   - Vercel auto-provisions SSL certificate

5. Configure Build Settings:
   Project Settings > General
   - Build Command: npm run build
   - Output Directory: .next
   - Install Command: npm install
   - Node.js Version: 18.x

6. Enable Automatic Deployments:
   Project Settings > Git
   - Production Branch: main
   - Preview Branches: develop, staging
   - Auto-deploy: Enabled
   - Ignored Build Step: None

7. Test Production Admin Panel:
   - Navigate to https://admin.yourapp.com
   - Login with admin credentials
   - Test all features:
     [ ] Dashboard loads with metrics
     [ ] User management works
     [ ] Item management works
     [ ] Trade management works
     [ ] Moderation queue accessible
     [ ] Config editor functional
     [ ] All analytics load

8. Set Up Preview Deployments:
   - Every PR to main → Preview deployment
   - Preview URL: yourapp-admin-git-<branch>-yourteam.vercel.app
   - Test changes before merging to production

ACCEPTANCE CRITERIA:
✓ Admin panel deployed to Vercel
✓ Custom domain configured (admin.yourapp.com)
✓ SSL certificate active
✓ Environment variables set
✓ Automatic deployments enabled
✓ All admin features working in production
✓ Preview deployments working for PRs

COST: Free (Vercel Hobby) or $20/month (Vercel Pro for teams)
```

### Time Breakdown
- Deploy to Vercel: 1 hour
- Configure domain and SSL: 1 hour
- Test all features: 1 hour

**Total: ~3 hours**

---

## TASK DEPLOY-003: Configure Production Domain and SSL (Cloudflare)

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** DEPLOY-002 (Admin panel deployed)

### Description
Set up production domains for the app and admin panel. Configure Cloudflare for DNS management, SSL/TLS, CDN, and DDoS protection. Set up proper DNS records for all services (Supabase, Vercel, email, etc.).

---

### AI Prompt for Claude Sonnet 4.5 (Domain & SSL Setup)

```bash
TASK: Configure production domain and SSL

CONTEXT:
Need to set up custom domains with SSL for all production services.

REQUIREMENTS:
1. Register domain (yourapp.com)
2. Configure Cloudflare DNS
3. Set up SSL/TLS (Full Strict mode)
4. Configure DNS records for all services
5. Enable CDN and caching
6. Set up email forwarding (optional)
7. Configure security settings (DDoS protection, firewall)

STEPS:

1. Register Domain:
   - Use Namecheap, Google Domains, or Cloudflare Registrar
   - Recommended: yourapp.com
   - Cost: ~$10-15/year

2. Transfer DNS to Cloudflare (Free):
   - Sign up at https://cloudflare.com
   - Add site: yourapp.com
   - Copy nameservers shown by Cloudflare
   - Update nameservers at domain registrar
   - Wait for DNS propagation (2-24 hours)

3. Configure DNS Records:
   Type  | Name        | Content                                    | Proxy
   ------|-------------|--------------------------------------------|---------
   A     | @           | <your-server-ip> (or Vercel IP)           | ✓ Proxied
   CNAME | www         | yourapp.com                                | ✓ Proxied
   CNAME | admin       | cname.vercel-dns.com                       | ✓ Proxied
   CNAME | api         | <supabase-project-ref>.supabase.co         | ✓ Proxied
   TXT   | @           | "v=spf1 include:sendgrid.net ~all"         | -
   TXT   | _dmarc      | "v=DMARC1; p=none; rua=mailto:..."         | -
   CNAME | em          | u<sendgrid-id>.wl.sendgrid.net             | -
   CNAME | s1._domainkey | s1.domainkey.u<sendgrid-id>.wl.sendgrid.net | -

4. Configure SSL/TLS:
   Cloudflare Dashboard > SSL/TLS
   - SSL/TLS encryption mode: Full (Strict)
   - Edge Certificates: Universal SSL enabled
   - Always Use HTTPS: Enabled
   - Minimum TLS Version: 1.2
   - Automatic HTTPS Rewrites: Enabled
   - Certificate Transparency Monitoring: Enabled

5. Configure Caching:
   Cloudflare Dashboard > Caching
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours
   - Crawler Hints: Enabled
   - Always Online: Enabled

6. Configure Page Rules:
   - Rule 1: https://yourapp.com/* → Cache Level: Cache Everything
   - Rule 2: https://admin.yourapp.com/* → Cache Level: Bypass
   - Rule 3: https://api.yourapp.com/* → Cache Level: Bypass

7. Configure Security:
   Cloudflare Dashboard > Security
   - Security Level: Medium
   - Challenge Passage: 30 minutes
   - Browser Integrity Check: Enabled
   - Privacy Pass Support: Enabled
   - DDoS Protection: Enabled (automatic)
   - WAF (Web Application Firewall): Enabled
     * OWASP Core Ruleset: Enabled
     * Cloudflare Managed Ruleset: Enabled

8. Configure Firewall Rules:
   - Block countries: None (unless specific requirements)
   - Rate Limiting:
     * API endpoints: 100 requests/minute per IP
     * Login endpoints: 5 requests/minute per IP
   - Allow verified bots (Google, Bing, etc.)

9. Set Up Email Forwarding (Optional):
   Cloudflare Dashboard > Email > Email Routing
   - Forward support@yourapp.com → your-email@gmail.com
   - Forward admin@yourapp.com → your-email@gmail.com
   - Forward noreply@yourapp.com → /dev/null (catch-all)

10. Verify Domain Setup:
    [ ] https://yourapp.com loads (main app)
    [ ] https://www.yourapp.com redirects to yourapp.com
    [ ] https://admin.yourapp.com loads admin panel
    [ ] SSL certificate valid (green padlock)
    [ ] Email forwarding working
    [ ] CDN caching working (check response headers)
    [ ] Security headers present (CSP, X-Frame-Options, etc.)

ACCEPTANCE CRITERIA:
✓ Domain registered and DNS on Cloudflare
✓ All DNS records configured
✓ SSL/TLS working (Full Strict)
✓ CDN and caching enabled
✓ Security features active (DDoS, WAF)
✓ Email forwarding configured
✓ All services accessible via custom domains

COST: 
- Domain registration: ~$10-15/year
- Cloudflare: Free (sufficient for MVP)
- Cloudflare Pro (optional): $20/month (advanced caching, analytics)
```

### Time Breakdown
- Register domain and configure Cloudflare: 1 hour
- Configure DNS, SSL, caching, security: 1 hour

**Total: ~2 hours**

---

## TASK DEPLOY-004: Set Up Production Monitoring (Sentry, Amplitude)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** DEPLOY-001, DEPLOY-002

### Description
Set up error monitoring with Sentry to catch bugs and crashes. Configure Amplitude for product analytics to track user behavior and key metrics. Integrate both into React Native app and admin panel.

---

### AI Prompt for Claude Sonnet 4.5 (Monitoring Setup)

```bash
TASK: Set up production monitoring

CONTEXT:
Need error tracking (Sentry) and product analytics (Amplitude) for production.

REQUIREMENTS:
1. Set up Sentry for error monitoring
2. Integrate Sentry into React Native app
3. Integrate Sentry into Next.js admin panel
4. Set up Amplitude for product analytics
5. Track all key events in app
6. Configure alerts and dashboards
7. Test all integrations

STEPS:

1. Set Up Sentry (Error Monitoring):
   - Sign up at https://sentry.io
   - Create organization: "YourApp"
   - Create project: "yourapp-mobile" (React Native)
   - Create project: "yourapp-admin" (Next.js)
   - Pricing: Free tier (5K events/month) or Team ($26/month for 50K events)

2. Integrate Sentry - React Native:
   npm install @sentry/react-native
   npx @sentry/wizard -i reactNative -p ios android

   // src/main.tsx (or App.tsx)
   import * as Sentry from '@sentry/react-native';

   Sentry.init({
     dsn: 'https://...@sentry.io/...',
     environment: __DEV__ ? 'development' : 'production',
     tracesSampleRate: 1.0,
     enabled: !__DEV__, // Only in production
   });

   // Wrap root component
   export default Sentry.wrap(App);

3. Integrate Sentry - Next.js Admin:
   npm install @sentry/nextjs
   npx @sentry/wizard -i nextjs

   // sentry.client.config.ts
   import * as Sentry from '@sentry/nextjs';
   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });

   // sentry.server.config.ts
   import * as Sentry from '@sentry/nextjs';
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });

4. Configure Sentry Alerts:
   Sentry Dashboard > Alerts
   - Create alert: "High Error Rate"
     * When: Error count > 50 in 1 hour
     * Action: Email team, Slack notification
   - Create alert: "New Issue"
     * When: First seen error
     * Action: Email immediately
   - Create alert: "Crash Rate > 1%"
     * When: Crash rate exceeds 1%
     * Action: Page on-call engineer

5. Set Up Amplitude (Product Analytics):
   - Sign up at https://amplitude.com
   - Create project: "YourApp Production"
   - Get API key from Settings
   - Pricing: Free tier (10M events/month)

6. Integrate Amplitude - React Native:
   npm install @amplitude/analytics-react-native

   // src/services/analytics.ts
   import { init, track } from '@amplitude/analytics-react-native';

   export function initAnalytics() {
     init(process.env.AMPLITUDE_API_KEY, undefined, {
       defaultTracking: {
         sessions: true,
         appLifecycles: true,
         screenViews: true,
       },
     });
   }

   export function trackEvent(eventName: string, properties?: Record<string, any>) {
     track(eventName, properties);
   }

   // In App.tsx
   import { initAnalytics } from '@/services/analytics';
   useEffect(() => {
     initAnalytics();
   }, []);

7. Track Key Events (Amplitude):
   // User events
   trackEvent('user_signed_up', { method: 'email' });
   trackEvent('user_logged_in', { method: 'email' });
   trackEvent('user_logged_out');

   // Listing events
   trackEvent('listing_created', { category, price, hasImages: true });
   trackEvent('listing_viewed', { itemId, category });
   trackEvent('listing_shared');

   // Trade events
   trackEvent('trade_initiated', { itemId, amount, paymentType });
   trackEvent('payment_completed', { amount, paymentType });
   trackEvent('trade_completed', { itemId, amount });
   trackEvent('trade_cancelled', { reason });

   // Search events
   trackEvent('search_performed', { query, resultsCount });
   trackEvent('search_filter_applied', { filterType, value });

   // Messaging events
   trackEvent('message_sent', { threadId });
   trackEvent('message_received', { threadId });

   // Review events
   trackEvent('review_submitted', { rating, tradeId });

   // Subscription events
   trackEvent('subscription_upgrade_viewed');
   trackEvent('subscription_activated', { tier });
   trackEvent('subscription_cancelled', { tier });

8. Configure Amplitude Dashboard:
   - Create chart: Daily Active Users (DAU)
   - Create chart: Trade Volume (daily)
   - Create chart: Revenue (daily)
   - Create chart: Conversion Funnel:
     * Step 1: Listing Viewed
     * Step 2: Trade Initiated
     * Step 3: Payment Completed
     * Step 4: Trade Completed
   - Create chart: Retention Cohorts (weekly)

9. Set Up Amplitude Alerts:
   - Alert: DAU drops > 20% (day-over-day)
   - Alert: Conversion rate drops > 10%
   - Alert: Payment failure rate > 5%

10. Test Integrations:
    [ ] Sentry captures errors in React Native
    [ ] Sentry captures errors in admin panel
    [ ] Sentry alerts fire on high error rate
    [ ] Amplitude tracks user events
    [ ] Amplitude dashboard shows real-time data
    [ ] All key events tracked correctly

ACCEPTANCE CRITERIA:
✓ Sentry integrated into React Native app
✓ Sentry integrated into admin panel
✓ Sentry alerts configured
✓ Amplitude integrated into app
✓ All key events tracked
✓ Amplitude dashboard configured
✓ Alerts working for both services

COST:
- Sentry: Free (5K events/month) or $26/month (50K events)
- Amplitude: Free (10M events/month) or $49/month (more features)
- Total: $0-75/month depending on scale
```

### Time Breakdown
- Set up Sentry and integrate: 1.5 hours
- Set up Amplitude and integrate: 1 hour
- Configure dashboards and alerts: 0.5 hours

**Total: ~3 hours**

---

## TASK DEPLOY-005: Set Up Production Backup Strategy (Supabase Automated Backups)

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** DEPLOY-001 (Production Supabase)

### Description
Configure automated database backups, Point-in-Time Recovery (PITR), and backup retention policies. Set up backup monitoring and test restore procedures. Document disaster recovery plan.

---

### AI Prompt for Claude Sonnet 4.5 (Backup Strategy)

```bash
TASK: Set up production backup strategy

CONTEXT:
Need automated backups and disaster recovery plan for production database.

REQUIREMENTS:
1. Enable automated daily backups
2. Configure Point-in-Time Recovery (PITR)
3. Set backup retention policy
4. Test backup restore procedure
5. Document disaster recovery plan
6. Set up backup monitoring alerts

STEPS:

1. Enable Automated Backups (Supabase Pro):
   Supabase Dashboard > Project Settings > Database > Backups
   - Daily Backups: Enabled (automatic with Pro tier)
   - Backup Time: 2:00 AM UTC (low-traffic time)
   - Retention: 7 days (Pro tier default)
   - Storage: Automatic (managed by Supabase)

2. Enable Point-in-Time Recovery (PITR):
   Supabase Dashboard > Project Settings > Database > Backups > PITR
   - Enable PITR: ✓
   - Retention: 7 days (Pro tier)
   - Purpose: Restore to any point in last 7 days
   - Use Cases:
     * Accidental data deletion
     * Corrupted data from bad migration
     * Rollback after security incident

3. Configure Backup Retention Policy:
   For critical production data, consider:
   - Daily backups: 7 days (Supabase Pro default)
   - Weekly backups: 4 weeks (manual export)
   - Monthly backups: 12 months (manual export to S3)

4. Set Up Manual Backup Script (for long-term retention):
   // scripts/backup-database.sh
   #!/bin/bash
   
   DATE=$(date +%Y-%m-%d)
   BACKUP_DIR="./backups/$DATE"
   
   mkdir -p $BACKUP_DIR
   
   # Export database schema
   pg_dump -h db.<project-ref>.supabase.co \
     -U postgres \
     -d postgres \
     --schema-only \
     > $BACKUP_DIR/schema.sql
   
   # Export all data
   pg_dump -h db.<project-ref>.supabase.co \
     -U postgres \
     -d postgres \
     --data-only \
     > $BACKUP_DIR/data.sql
   
   # Export specific tables (for selective restore)
   pg_dump -h db.<project-ref>.supabase.co \
     -U postgres \
     -d postgres \
     -t users -t items -t trades \
     > $BACKUP_DIR/core-tables.sql
   
   # Compress backup
   tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
   
   # Upload to S3 (or other cloud storage)
   aws s3 cp $BACKUP_DIR.tar.gz s3://yourapp-backups/production/$DATE.tar.gz
   
   echo "Backup complete: $DATE.tar.gz"

5. Schedule Monthly Backups (cron):
   # Run on 1st of every month at 3:00 AM
   0 3 1 * * /path/to/backup-database.sh

6. Test Backup Restore Procedure:
   CRITICAL: Test restore BEFORE you need it!

   Steps to test restore:
   1. Create test Supabase project: "yourapp-restore-test"
   2. Download latest backup from Supabase:
      Supabase Dashboard > Backups > Download
   3. Restore to test project:
      psql -h db.<test-project-ref>.supabase.co \
        -U postgres \
        -d postgres \
        < backup.sql
   4. Verify data integrity:
      - Check user count matches production
      - Check trade count matches
      - Test app against restored database
   5. Document restore time (should be < 30 minutes for typical database)

7. Document Disaster Recovery Plan:
   Create DR_PLAN.md in project root:

   # Disaster Recovery Plan

   ## Scenarios & Procedures

   ### Scenario 1: Accidental Data Deletion (< 7 days ago)
   **Recovery Time Objective (RTO):** 1 hour
   **Recovery Point Objective (RPO):** Up to 1 minute (via PITR)

   Procedure:
   1. Identify exact time of deletion
   2. Go to Supabase Dashboard > Backups > PITR
   3. Select timestamp BEFORE deletion
   4. Click "Restore to new project"
   5. Update app connection strings to new project
   6. Verify data restored correctly
   7. Migrate traffic to restored database

   ### Scenario 2: Database Corruption
   **RTO:** 2 hours
   **RPO:** Up to 24 hours (daily backup)

   Procedure:
   1. Identify extent of corruption
   2. Download latest daily backup
   3. Create new Supabase project
   4. Restore backup to new project
   5. Run data integrity checks
   6. Update app connection strings
   7. Monitor for issues

   ### Scenario 3: Complete Supabase Outage
   **RTO:** 4 hours
   **RPO:** Up to 24 hours

   Procedure:
   1. Check Supabase status page
   2. If prolonged outage, restore to self-hosted Postgres:
      - Provision RDS or DigitalOcean Managed Postgres
      - Restore from latest backup
      - Update app connection strings
      - Deploy Edge Functions to AWS Lambda/Vercel
   3. Communicate with users (status page, Twitter)

   ### Scenario 4: Security Breach / Data Compromise
   **RTO:** Immediate (lock down first, restore later)

   Procedure:
   1. Immediately revoke all API keys
   2. Reset database passwords
   3. Enable maintenance mode in app
   4. Assess breach scope with Supabase support
   5. Restore from backup BEFORE breach
   6. Notify affected users (if PII compromised)
   7. Conduct security audit before reopening

8. Set Up Backup Monitoring:
   - Monitor daily backup success in Supabase Dashboard
   - Set up alert if backup fails:
     * Check Supabase email notifications
     * Or query backup logs via API
   - Monitor PITR status (should always be "Active")

9. Backup Verification Checklist:
   Weekly:
   [ ] Check latest backup completed successfully
   [ ] Verify backup file size reasonable (not 0 bytes)
   [ ] PITR status = Active

   Monthly:
   [ ] Test restore procedure to staging environment
   [ ] Verify all tables restored correctly
   [ ] Document restore time and any issues

   Quarterly:
   [ ] Full disaster recovery drill (simulate outage)
   [ ] Update DR plan with lessons learned
   [ ] Review and rotate access credentials

10. Storage Considerations:
    - Supabase backups: Included in Pro tier (no extra cost)
    - Manual backups to S3: ~$0.023/GB/month
    - Estimated database size: 10GB after 1 year
    - Estimated backup storage cost: ~$3/month (S3)

ACCEPTANCE CRITERIA:
✓ Automated daily backups enabled
✓ PITR enabled (7-day retention)
✓ Manual backup script created for long-term retention
✓ Backup restore procedure tested successfully
✓ Disaster recovery plan documented
✓ Backup monitoring alerts configured
✓ Team trained on restore procedures

COST:
- Included in Supabase Pro ($25/month)
- S3 storage for manual backups: ~$3/month
- Total: ~$0 additional cost
```

### Time Breakdown
- Configure automated backups and PITR: 0.5 hours
- Create manual backup script: 0.5 hours
- Test restore procedure: 0.5 hours
- Document disaster recovery plan: 0.5 hours

**Total: ~2 hours**

---

## Summary (Tasks 1-5)

| Task | Description | Duration | Priority |
|------|-------------|----------|----------|
| DEPLOY-001 | Production Supabase setup | 4h | Critical |
| DEPLOY-002 | Deploy admin panel to Vercel | 3h | Critical |
| DEPLOY-003 | Configure domain and SSL | 2h | High |
| DEPLOY-004 | Set up monitoring (Sentry, Amplitude) | 3h | High |
| DEPLOY-005 | Set up backup strategy | 2h | High |

**Total Time (Tasks 1-5): ~14 hours**

**Key Deliverables:**
✅ Production Supabase project fully configured  
✅ Admin panel live at admin.yourapp.com  
✅ Custom domains with SSL working  
✅ Error monitoring and analytics operational  
✅ Automated backups and disaster recovery plan in place  

**Monthly Costs (Production Infrastructure):**
- Supabase Pro: $25/month
- Vercel: Free (or $20/month for Pro)
- Cloudflare: Free
- Sentry: $26/month (Team tier)
- Amplitude: Free (10M events)
- Domain: ~$1/month
- S3 backups: ~$3/month

**Total: ~$55-75/month** (without Vercel Pro)

---

**Ready to proceed with Tasks 6-10 (App Store Submissions)?** 🚀

---

## TASK DEPLOY-006: Build and Submit iOS App to App Store (TestFlight First for Beta Testing)

**Duration:** 8 hours  
**Priority:** Critical  
**Dependencies:** DEPLOY-001, DEPLOY-004

### Description
Build production-ready iOS app, configure App Store Connect, create app listing, submit to TestFlight for beta testing, then submit for App Store review. Handle certificates, provisioning profiles, and all Apple requirements.

---

### AI Prompt for Claude Sonnet 4.5 (iOS App Store Submission)

```bash
TASK: Build and submit iOS app to App Store

CONTEXT:
React Native app needs to be built for iOS and submitted to Apple App Store.
Start with TestFlight for beta testing before full public release.

REQUIREMENTS:
1. Configure iOS build settings
2. Set up Apple Developer account
3. Create app in App Store Connect
4. Generate certificates and provisioning profiles
5. Build production IPA
6. Submit to TestFlight
7. Invite beta testers
8. Submit for App Store review
9. Handle review process

STEPS:

1. Set Up Apple Developer Account:
   - Enroll at https://developer.apple.com ($99/year)
   - Wait for approval (1-2 days)
   - Accept developer agreements
   - Set up two-factor authentication

2. Configure App in Xcode:
   cd ios
   open YourApp.xcworkspace  # Opens in Xcode

   In Xcode:
   - Select project > Signing & Capabilities
   - Team: Select your Apple Developer team
   - Bundle Identifier: com.yourcompany.yourapp (MUST be unique)
   - Signing: Automatic (Xcode manages certificates)
   - Enable capabilities:
     * Push Notifications
     * Background Modes (Remote notifications)
     * Associated Domains (for deep linking)

3. Update App Information:
   // ios/YourApp/Info.plist
   <key>CFBundleDisplayName</key>
   <string>YourApp</string>
   
   <key>CFBundleShortVersionString</key>
   <string>1.0.0</string>
   
   <key>CFBundleVersion</key>
   <string>1</string>
   
   <key>NSCameraUsageDescription</key>
   <string>We need camera access to take photos of items you're listing.</string>
   
   <key>NSPhotoLibraryUsageDescription</key>
   <string>We need photo library access to let you choose photos for your listings.</string>
   
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>We need your location to show nearby items and community nodes.</string>

4. Configure Production Environment:
   // .env.production (for iOS build)
   EXPO_PUBLIC_SUPABASE_URL=https://<production-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   EXPO_PUBLIC_AMPLITUDE_API_KEY=...
   EXPO_PUBLIC_SENTRY_DSN=...
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

5. Update App Icons and Splash Screen:
   - App Icon: 1024x1024px PNG (no transparency)
   - Place in ios/YourApp/Images.xcassets/AppIcon.appiconset/
   - Use tool like https://appicon.co to generate all sizes
   
   Splash Screen:
   - Update ios/YourApp/LaunchScreen.storyboard
   - Or use react-native-splash-screen

6. Build for Production:
   # Clean previous builds
   cd ios
   rm -rf build
   pod install
   
   # Build in Xcode
   - Select "Any iOS Device (arm64)" as build target
   - Product > Archive
   - Wait for archive to complete (5-15 minutes)
   - Organizer opens automatically

7. Create App in App Store Connect:
   - Go to https://appstoreconnect.apple.com
   - My Apps > + > New App
   - Platform: iOS
   - Name: YourApp (must be unique globally)
   - Primary Language: English (US)
   - Bundle ID: com.yourcompany.yourapp (must match Xcode)
   - SKU: yourapp-ios-001 (internal identifier)
   - User Access: Full Access

8. Submit to TestFlight (Beta):
   In Xcode Organizer:
   - Select your archive
   - Click "Distribute App"
   - Method: App Store Connect
   - Upload: All symbols and bitcode
   - Signing: Automatic
   - Click "Upload"
   - Wait for processing (30-60 minutes)
   
   In App Store Connect:
   - Go to TestFlight tab
   - Internal Testing:
     * Create internal group (up to 100 testers)
     * Add testers (use team email addresses)
     * Enable automatic distribution
   - External Testing (optional, requires Apple review):
     * Create external group
     * Add testers (up to 10,000)
     * Submit for Beta App Review
   
   Beta testers receive email with TestFlight link:
   - Install TestFlight app from App Store
   - Redeem code or click link
   - Install beta app
   - Provide feedback via TestFlight

9. Prepare App Store Listing:
   App Store Connect > App Information
   
   App Name: YourApp (30 char max)
   Subtitle: Buy, sell, and swap locally (30 char max)
   
   Privacy Policy URL: https://yourapp.com/privacy
   Support URL: https://yourapp.com/support
   Marketing URL: https://yourapp.com (optional)
   
   Category: Primary = Shopping, Secondary = Lifestyle
   
   Age Rating:
   - Run through questionnaire
   - Likely result: 12+ (due to user-generated content)
   
   App Store Localizations (English US):
   - Description (4000 char max) - See DEPLOY-008 for content
   - Keywords (100 char max): local,marketplace,buy,sell,swap,trade,community,toys,books,secondhand
   - Screenshots: See DEPLOY-008
   - App Preview (video): Optional but recommended

10. Submit for App Store Review:
    App Store Connect > App Store > + Version
    
    Version: 1.0.0
    
    Build: Select TestFlight build (must be processed)
    
    What's New in This Version:
    "Initial release of YourApp - your local marketplace for buying, selling, and swapping items with neighbors. Features include:
    - Browse items in your community
    - Buy with cash or points
    - Secure messaging
    - User profiles and reviews
    - Safe trading features"
    
    App Review Information:
    - Sign-in required: Yes
    - Demo account:
      * Username: demo@yourapp.com
      * Password: DemoPassword123!
      * Notes: "This demo account has pre-populated data for testing."
    
    - Contact Information:
      * First Name: [Your Name]
      * Last Name: [Your Name]
      * Phone: [Your Phone]
      * Email: support@yourapp.com
    
    - Notes:
      "Payment features use Stripe in test mode for this review build.
       Location features work best in [your launch city].
       Please contact us if you need additional testing information."
    
    Content Rights: Check "I own the rights"
    Advertising Identifier: Check if using ads (unlikely for MVP)
    
    Click "Submit for Review"

11. Monitor Review Process:
    Timeline:
    - Waiting for Review: 1-3 days
    - In Review: Few hours to 1 day
    - Pending Developer Release: Ready to go live
    
    Possible Outcomes:
    - Approved: App goes live automatically (or on your schedule)
    - Rejected: Read rejection reason, fix issues, resubmit
    
    Common Rejection Reasons:
    - Missing privacy policy
    - Broken demo account
    - Crashes on launch
    - Incomplete functionality
    - Guideline violations (spam, inappropriate content)

12. Handle App Review Rejection (if occurs):
    1. Read rejection notice carefully
    2. Reproduce issue if possible
    3. Fix issue in code
    4. Build new version
    5. Upload to TestFlight
    6. Respond in Resolution Center:
       "Thank you for the feedback. We have addressed [specific issue] by [specific fix]. The new build [version] is now available for review."
    7. Resubmit for review

13. Release to App Store:
    Once approved:
    - App Store Connect > App Store > Version
    - Status: "Pending Developer Release"
    - Click "Release This Version"
    - App goes live within 24 hours
    
    Or schedule release:
    - Select "Manually release this version"
    - Choose date/time
    - App releases automatically at that time

14. Post-Release Monitoring:
    - Monitor crashes in Sentry
    - Check App Store reviews daily
    - Respond to reviews within 48 hours
    - Track downloads in App Store Connect
    - Monitor Amplitude for usage metrics

ACCEPTANCE CRITERIA:
✓ iOS app built successfully
✓ App submitted to TestFlight
✓ Beta testers invited and testing
✓ App Store listing complete (screenshots, description)
✓ App submitted for App Store review
✓ Demo account working for reviewers
✓ App approved and live on App Store

COST:
- Apple Developer Program: $99/year
- No per-download fees

TIMELINE:
- Build and TestFlight: 1 day
- Beta testing: 1-2 weeks (recommended)
- App Store review: 1-3 days
- Total: 2-3 weeks from build to live
```

### Time Breakdown
- Set up Apple Developer account and certificates: 2 hours
- Configure build and create IPA: 2 hours
- Submit to TestFlight and test: 2 hours
- Create App Store listing: 1 hour
- Submit for review and handle process: 1 hour

**Total: ~8 hours** (not including review wait time)

---

## TASK DEPLOY-007: Build and Submit Android App to Google Play (Closed Testing First for Beta)

**Duration:** 6 hours  
**Priority:** Critical  
**Dependencies:** DEPLOY-001, DEPLOY-004

### Description
Build production-ready Android app, configure Google Play Console, create app listing, submit to Closed Testing track for beta, then submit for production review. Handle app signing, Play Store requirements, and Google's review process.

---

### AI Prompt for Claude Sonnet 4.5 (Android Google Play Submission)

```bash
TASK: Build and submit Android app to Google Play

CONTEXT:
React Native app needs to be built for Android and submitted to Google Play Store.
Start with Closed Testing for beta before production release.

REQUIREMENTS:
1. Configure Android build settings
2. Set up Google Play Console account
3. Generate release keystore
4. Build production APK/AAB
5. Create app listing in Play Console
6. Submit to Closed Testing track
7. Invite beta testers
8. Submit for production review
9. Handle review process

STEPS:

1. Set Up Google Play Console Account:
   - Go to https://play.google.com/console
   - Pay one-time $25 registration fee
   - Complete account setup (takes 24-48 hours for verification)
   - Accept Developer Distribution Agreement

2. Generate Release Keystore (IMPORTANT - Store Securely):
   cd android/app
   
   keytool -genkeypair -v \
     -storetype PKCS12 \
     -keystore yourapp-release.keystore \
     -alias yourapp-key \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   
   # You'll be prompted for:
   # - Keystore password (SAVE IN 1PASSWORD!)
   # - Key password (SAVE IN 1PASSWORD!)
   # - Name, Organization, etc.
   
   # Move keystore to safe location (NOT in git!)
   mv yourapp-release.keystore ~/.android/keystores/
   
   # CRITICAL: Backup keystore and passwords
   # If lost, you can NEVER update your app!

3. Configure Gradle for Release:
   // android/gradle.properties
   MYAPP_RELEASE_STORE_FILE=yourapp-release.keystore
   MYAPP_RELEASE_KEY_ALIAS=yourapp-key
   MYAPP_RELEASE_STORE_PASSWORD=****  # Use environment variable in CI/CD
   MYAPP_RELEASE_KEY_PASSWORD=****

   // android/app/build.gradle
   android {
     ...
     signingConfigs {
       release {
         if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
           storeFile file(MYAPP_RELEASE_STORE_FILE)
           storePassword MYAPP_RELEASE_STORE_PASSWORD
           keyAlias MYAPP_RELEASE_KEY_ALIAS
           keyPassword MYAPP_RELEASE_KEY_PASSWORD
         }
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
         minifyEnabled true
         proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
     }
   }

4. Update App Information:
   // android/app/build.gradle
   android {
     defaultConfig {
       applicationId "com.yourcompany.yourapp"  // MUST be unique
       minSdkVersion 23  // Android 6.0+
       targetSdkVersion 33  // Latest Android
       versionCode 1  // Increment for each release
       versionName "1.0.0"  // User-facing version
     }
   }

5. Configure Production Environment:
   Same as iOS - use .env.production

6. Update App Icon:
   - Icon: 512x512px PNG (adaptive icon)
   - Place in android/app/src/main/res/mipmap-*/
   - Use Android Studio > Image Asset tool
   - Or https://icon.kitchen

7. Build Release AAB (Android App Bundle):
   cd android
   ./gradlew clean
   ./gradlew bundleRelease
   
   # Output: android/app/build/outputs/bundle/release/app-release.aab
   
   # Verify bundle:
   ls -lh app/build/outputs/bundle/release/
   # Should see app-release.aab (~30-50MB)

8. Create App in Google Play Console:
   Play Console > All apps > Create app
   
   App name: YourApp
   Default language: English (United States)
   App or game: App
   Free or paid: Free
   
   Declarations:
   - Developer Program Policies: Accept
   - US export laws: Not applicable (or follow guidance)
   
   Click "Create app"

9. Set Up App Access:
   Dashboard > App access
   
   - All or some functionality restricted: Yes
   - Provide demo credentials:
     * Email: demo@yourapp.com
     * Password: DemoPassword123!
     * Instructions: "Use this account to browse listings, initiate trades, and test messaging."

10. Fill Out Privacy Policy:
    Dashboard > App content > Privacy policy
    - Privacy policy URL: https://yourapp.com/privacy
    - Save

11. Complete App Content:
    Dashboard > App content
    
    - App access: Completed ✓
    - Ads: No (or Yes if you have ads)
    - Content ratings:
      * Click "Start questionnaire"
      * Category: Shopping
      * Answer questions about user-generated content
      * Likely rating: PEGI 12 / ESRB Teen
    - Target audience:
      * Age range: 18+
      * Appeal to children: No
    - News app: No
    - COVID-19 contact tracing: No
    - Data safety:
      * Click "Start"
      * Data collected:
        - Personal info (name, email, phone)
        - Location (approximate)
        - Photos (user uploads)
        - Messages (user-to-user messaging)
      * Data sharing: With service providers (Stripe, SendGrid)
      * Data security:
        - Encryption in transit: Yes
        - User can request deletion: Yes
        - Committed to Google Play Families: No
      * Save

12. Upload to Closed Testing:
    Dashboard > Testing > Closed testing
    
    - Create new release
    - Upload app-release.aab
    - Release name: 1.0.0 (1)
    - Release notes (English):
      "Initial beta release for testing. Features:
      - Browse local items
      - Buy/sell/swap functionality
      - Secure messaging
      - User reviews"
    
    - Create testers list:
      * Add email addresses (up to 100 for closed testing)
      * Or share opt-in URL publicly (for open testing)
    
    - Save and review release
    - Start rollout to Closed testing
    
    Testers receive email with opt-in link:
    - Click link
    - Accept beta invite
    - Install from Play Store
    - Provide feedback

13. Create Store Listing:
    Dashboard > Main store listing
    
    App name: YourApp (30 char max)
    Short description: Local marketplace for buying, selling & swapping (80 char max)
    Full description: See DEPLOY-008 for content (4000 char max)
    
    Graphics:
    - App icon: 512x512px PNG
    - Feature graphic: 1024x500px PNG (see DEPLOY-008)
    - Phone screenshots: 2-8 screenshots (see DEPLOY-008)
    - Tablet screenshots: Optional
    - App video: YouTube URL (optional)
    
    Categorization:
    - App category: Shopping
    - Tags: marketplace, local, buy, sell, swap
    
    Contact details:
    - Email: support@yourapp.com
    - Phone: Optional
    - Website: https://yourapp.com
    
    Save draft

14. Submit for Production Review:
    Dashboard > Production
    
    - Create new release
    - Copy from Closed testing (or upload new AAB)
    - Version code: 1 (must be higher than any previous)
    - Version name: 1.0.0
    - Release notes (English):
      "Initial release of YourApp - your local marketplace.
       Features include:
       - Browse items nearby
       - Buy with cash or points
       - Secure in-app messaging
       - User profiles and reviews
       - Safe trading features"
    
    - Countries: Select all (or specific countries)
    - Release type: Full rollout (or staged rollout 10% → 50% → 100%)
    
    - Review and rollout
    - Submit for review

15. Monitor Review Process:
    Timeline:
    - Review typically takes 1-3 days (faster than Apple)
    - You'll receive email when approved or rejected
    
    Status in Play Console:
    - Under review
    - Approved (pending publishing)
    - Published (live on Play Store)
    
    Common Rejection Reasons:
    - Missing privacy policy
    - Broken demo account
    - Crashes
    - Policy violations (similar to Apple)

16. Handle Rejection (if occurs):
    Similar process to iOS:
    1. Read rejection notice
    2. Fix issue
    3. Build new AAB (increment versionCode)
    4. Upload to production
    5. Respond to review team
    6. Resubmit

17. Release to Production:
    Once approved:
    - Status changes to "Pending publishing"
    - App goes live within 24 hours
    - Or schedule release for specific date/time

18. Post-Release Monitoring:
    - Monitor crashes in Play Console
    - Check reviews daily (respond within 48 hours)
    - Track installs, uninstalls, ratings
    - Monitor ANRs (App Not Responding) errors
    - Update app regularly (Google favors active apps)

ACCEPTANCE CRITERIA:
✓ Android app built successfully (AAB)
✓ Keystore generated and backed up securely
✓ App submitted to Closed Testing
✓ Beta testers invited and testing
✓ Store listing complete (screenshots, description)
✓ App submitted for production review
✓ Demo account working for reviewers
✓ App approved and live on Google Play

COST:
- Google Play Developer Registration: $25 (one-time)
- No per-download fees

TIMELINE:
- Build and upload: 1 day
- Beta testing: 1-2 weeks (recommended)
- Production review: 1-3 days
- Total: 2-3 weeks from build to live
```

### Time Breakdown
- Set up Play Console and generate keystore: 1 hour
- Configure build and create AAB: 2 hours
- Upload to Closed Testing and test: 1 hour
- Create store listing: 1 hour
- Submit for production and handle review: 1 hour

**Total: ~6 hours** (not including review wait time)

---

## TASK DEPLOY-008: Create App Store Assets (Screenshots, Descriptions, Keywords)

**Duration:** 6 hours  
**Priority:** High  
**Dependencies:** DEPLOY-006, DEPLOY-007

### Description
Create all marketing assets required for App Store and Google Play: screenshots for multiple devices, app descriptions, keywords for ASO (App Store Optimization), feature graphics, and promotional materials.

---

### AI Prompt for Claude Sonnet 4.5 (App Store Assets)

```bash
TASK: Create app store marketing assets

CONTEXT:
Need compelling screenshots, descriptions, and graphics for both App Store and Google Play.

REQUIREMENTS:
1. iOS screenshots (6.5", 5.5" displays)
2. Android screenshots (phone and tablet)
3. App descriptions (short and full)
4. Keywords for ASO
5. Feature graphic (Google Play)
6. Promotional materials
7. App preview video (optional but recommended)

STEPS:

1. Take App Screenshots:
   Tools:
   - iOS Simulator (Xcode)
   - Android Emulator (Android Studio)
   - Or use real devices
   
   Required screenshots (for each platform):
   - Screenshot 1: Home/Browse screen (show items)
   - Screenshot 2: Item details with Buy button
   - Screenshot 3: Search and filters
   - Screenshot 4: Messaging interface
   - Screenshot 5: User profile with reviews
   - Screenshot 6: Payment options screen (optional)
   
   iOS Requirements:
   - 6.5" display: 1284 x 2778 pixels (iPhone 14 Pro Max)
   - 5.5" display: 1242 x 2208 pixels (iPhone 8 Plus)
   - Format: PNG or JPEG
   - Max 10 screenshots per device size
   - Minimum 2 screenshots required
   
   Android Requirements:
   - Phone: 1080 x 1920 pixels minimum
   - Tablet: 1920 x 1080 pixels (7" tablet)
   - Format: PNG or JPEG (24-bit)
   - Max file size: 8MB each
   - Minimum 2 screenshots, maximum 8

2. Add Text Overlays to Screenshots:
   Use Figma, Canva, or Photoshop
   
   Screenshot 1 overlay:
   "Discover Local Treasures"
   "Browse items in your neighborhood"
   
   Screenshot 2 overlay:
   "Safe & Easy Trading"
   "Buy with cash or points"
   
   Screenshot 3 overlay:
   "Find What You Need"
   "Search and filter locally"
   
   Screenshot 4 overlay:
   "Stay Connected"
   "Secure in-app messaging"
   
   Screenshot 5 overlay:
   "Trust the Community"
   "Verified users and reviews"
   
   Design tips:
   - Use your brand colors
   - Readable fonts (40-60pt)
   - High contrast text
   - Consistent style across all screenshots
   - Show actual app UI (don't fake it)

3. Write App Description (iOS):
   App Store has 30-second rule: Hook users in first 2 lines
   
   SHORT DESCRIPTION (Subtitle - 30 characters):
   "Buy, sell & swap locally"
   
   FULL DESCRIPTION (4000 characters max):
   
   "Transform your neighborhood into a thriving marketplace with YourApp. Buy, sell, and swap items locally with trusted community members.
   
   WHY YOURAPP?
   
   🏘️ Hyperlocal Trading
   Connect with neighbors in your community. Buy and sell within walking distance. Support local sustainability.
   
   💎 Unique Finds
   Discover one-of-a-kind items: toys, books, electronics, home goods, and more. Every listing is from a real person in your area.
   
   💰 Flexible Payments
   Pay with cash, earn points through trades, or mix both. Our point system rewards active traders.
   
   ⭐ Trusted Community
   User reviews, verified badges, and safety features ensure every trade is secure. Trade with confidence.
   
   🔒 Safe & Secure
   In-app messaging keeps conversations private. AI moderation flags unsafe items. CPSC recall checking protects your family.
   
   KEY FEATURES:
   
   ✓ Browse local listings by category or distance
   ✓ Post items in minutes with photos
   ✓ Search and filter to find exactly what you need
   ✓ Secure messaging with buyers and sellers
   ✓ Earn points for every successful trade
   ✓ User profiles with reviews and ratings
   ✓ Badge system rewards reliable traders
   ✓ Push notifications for messages and trades
   ✓ Subscription tiers for power users
   
   PERFECT FOR:
   
   • Parents decluttering outgrown toys and clothes
   • Book lovers building their library
   • Eco-conscious shoppers reducing waste
   • Collectors finding rare items
   • Anyone looking to save money and support neighbors
   
   HOW IT WORKS:
   
   1. Create your free account
   2. Browse items in your community node
   3. Message sellers to arrange pickup
   4. Complete trade and leave a review
   5. Earn points and badges as you trade
   
   JOIN THE MOVEMENT
   
   YourApp brings neighbors together through local commerce. Reduce waste, save money, and build community connections. Download now and start trading!
   
   ---
   
   Privacy Policy: https://yourapp.com/privacy
   Terms of Service: https://yourapp.com/terms
   Support: support@yourapp.com"

4. Write App Description (Google Play):
   Similar to iOS but can be slightly more keyword-dense
   
   SHORT DESCRIPTION (80 characters):
   "Local marketplace for buying, selling & swapping items with trusted neighbors"
   
   FULL DESCRIPTION (4000 characters):
   Similar to iOS description above, but optimize for Google Play search:
   - Include keywords naturally: marketplace, local, buy, sell, swap, trade, community
   - Emphasize Android-specific features if any
   - Add emojis for visual interest (Google Play supports them)

5. Research and Select Keywords (iOS):
   App Store allows 100 characters for keywords
   
   Keyword Research:
   - Use App Store search suggestions
   - Check competitor apps
   - Use tools like Sensor Tower, App Annie
   
   Recommended keywords (separate with commas, no spaces):
   "local,marketplace,buy,sell,swap,trade,community,nearby,secondhand,thrift,resale,preloved,used,items,toys,books,electronics,furniture,kids,family,sustainable,recycle,points,rewards"
   
   Tips:
   - Don't repeat words (App Store combines them)
   - Don't include app name or category (already indexed)
   - Avoid trademarked terms
   - Use singular form (App Store finds plurals)
   - High-volume, low-competition keywords

6. Create Feature Graphic (Google Play Only):
   Size: 1024 x 500 pixels
   Format: PNG or JPEG (24-bit)
   
   Design:
   - App logo on left
   - Tagline: "Trade Locally, Live Sustainably"
   - Show 2-3 phone screenshots
   - Brand colors and fonts
   - Call to action: "Join Your Community"
   
   Tools:
   - Canva (has Play Store templates)
   - Figma
   - Photoshop

7. Create App Icon:
   Already done in app, but verify:
   - iOS: 1024 x 1024 pixels (no transparency)
   - Android: 512 x 512 pixels (adaptive icon)
   - Consistent across platforms
   - Recognizable at small sizes
   - Follows platform design guidelines

8. Create App Preview Video (Optional but Recommended):
   Duration: 15-30 seconds
   
   Script:
   0:00 - Show app icon and name
   0:03 - Browse screen: "Discover local treasures"
   0:08 - Item details: "Buy what you need"
   0:13 - Messaging: "Connect safely"
   0:18 - Profile: "Build trust"
   0:23 - Trade complete: "Trade locally, live sustainably"
   0:28 - App icon with download CTA
   
   Tools:
   - Screen record app walkthrough
   - Edit in iMovie, Final Cut, or Adobe Premiere
   - Add captions (auto-play with sound off)
   - Add background music (royalty-free)
   
   Upload:
   - iOS: Directly to App Store Connect
   - Android: Upload to YouTube, link in Play Console

9. Localization (Optional for MVP, Recommended Later):
   If targeting multiple countries:
   - Translate descriptions
   - Localize screenshots (change UI language)
   - Adapt keywords for each market
   
   Priority markets after English:
   - Spanish (large US demographic)
   - French, German (if targeting Europe)

10. Create Marketing Website Landing Page:
    URL: https://yourapp.com
    
    Sections:
    - Hero: App icon, tagline, download buttons
    - Features: 3-4 key features with icons
    - How It Works: 4-step process
    - Screenshots: Carousel of app screenshots
    - Testimonials: Beta tester quotes
    - Download: App Store and Google Play badges
    - Footer: Privacy, Terms, Support links
    
    Tools:
    - Webflow (no-code)
    - Next.js + Tailwind (custom)
    - Carrd (simple landing pages)

DELIVERABLES CHECKLIST:
[ ] iOS screenshots (6.5" and 5.5") - 5-10 screenshots each
[ ] Android screenshots (phone and tablet) - 5-8 screenshots each
[ ] App descriptions (short and full) for both stores
[ ] Keywords researched and selected (iOS)
[ ] Feature graphic created (Google Play)
[ ] App icon finalized (both platforms)
[ ] App preview video created (optional)
[ ] Marketing website landing page live

ACCEPTANCE CRITERIA:
✓ All screenshots visually appealing with text overlays
✓ Descriptions highlight key features and benefits
✓ Keywords optimized for search (ASO)
✓ Feature graphic eye-catching and on-brand
✓ All assets uploaded to App Store Connect and Play Console
✓ Marketing website live with download links

TOOLS & RESOURCES:
- Screenshots: iOS Simulator, Android Emulator
- Editing: Figma, Canva, Photoshop
- ASO Research: Sensor Tower, App Annie, AppFollow
- Video: iMovie, Premiere, CapCut
- Stock photos: Unsplash, Pexels (if needed)
- Icons: Heroicons, Font Awesome
```

### Time Breakdown
- Take and edit screenshots: 2 hours
- Write descriptions and research keywords: 2 hours
- Create feature graphic and marketing materials: 1 hour
- Create app preview video (optional): 1 hour

**Total: ~6 hours**

---

## TASK DEPLOY-009: Set Up App Analytics Tracking (Amplitude Events for All Key Actions)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** DEPLOY-004 (Amplitude setup)

### Description
Ensure all critical user actions are tracked in Amplitude. Verify events are firing correctly, set up conversion funnels, cohort analysis, and retention tracking. Create dashboards for key metrics.

---

### AI Prompt for Claude Sonnet 4.5 (Analytics Tracking)

```bash
TASK: Set up comprehensive app analytics tracking

CONTEXT:
Amplitude already integrated (DEPLOY-004), now need to ensure all key events tracked and dashboards configured.

REQUIREMENTS:
1. Verify all events firing correctly
2. Set up conversion funnels
3. Create retention cohorts
4. Build key metric dashboards
5. Set up alerts for anomalies
6. Document analytics taxonomy

STEPS:

1. Verify Core Events Are Tracked:
   Run through app and check Amplitude Live Events:
   
   User Events:
   [ ] user_signed_up (properties: method, timestamp)
   [ ] user_logged_in (method, timestamp)
   [ ] user_logged_out
   [ ] profile_viewed (user_id, is_own_profile)
   [ ] profile_edited
   
   Listing Events:
   [ ] listing_created (category, price, has_images, lat/lng)
   [ ] listing_viewed (item_id, category, price, distance)
   [ ] listing_edited
   [ ] listing_deleted
   [ ] listing_shared (platform: sms, email, etc.)
   
   Search Events:
   [ ] search_performed (query, filters, results_count)
   [ ] search_filter_applied (filter_type, value)
   [ ] search_result_clicked (item_id, position)
   
   Trade Events:
   [ ] trade_initiated (item_id, amount, payment_type)
   [ ] payment_option_selected (payment_type: cash/points/mixed)
   [ ] payment_processing
   [ ] payment_completed (amount, payment_type, fees)
   [ ] payment_failed (error_message)
   [ ] trade_confirmed (trade_id)
   [ ] trade_completed (trade_id, amount, points_earned)
   [ ] trade_cancelled (reason)
   
   Messaging Events:
   [ ] message_sent (thread_id, is_first_message)
   [ ] message_received
   [ ] thread_viewed
   
   Review Events:
   [ ] review_submitted (rating, trade_id, has_text)
   [ ] review_viewed
   
   Subscription Events:
   [ ] subscription_upgrade_viewed
   [ ] subscription_tier_selected (tier)
   [ ] subscription_checkout_started
   [ ] subscription_activated (tier, price)
   [ ] subscription_cancelled (tier, reason)
   
   Points Events:
   [ ] points_earned (amount, source: trade/referral/etc.)
   [ ] points_spent (amount, purpose)
   [ ] points_balance_viewed
   
   Notification Events:
   [ ] push_notification_received (type)
   [ ] push_notification_opened (type)
   [ ] email_notification_sent (type)
   
   Error Events:
   [ ] error_occurred (screen, error_type, message)
   [ ] api_error (endpoint, status_code)

2. Create Conversion Funnels:
   Amplitude > Create Chart > Funnel
   
   Funnel 1: Listing to Trade
   - Step 1: listing_viewed
   - Step 2: trade_initiated
   - Step 3: payment_completed
   - Step 4: trade_completed
   - Conversion window: 7 days
   - Goal: >10% conversion listing → trade
   
   Funnel 2: Signup to First Listing
   - Step 1: user_signed_up
   - Step 2: listing_created
   - Conversion window: 7 days
   - Goal: >30% new users create listing
   
   Funnel 3: First Visit to Active User
   - Step 1: user_signed_up
   - Step 2: listing_viewed (any, within 24h)
   - Step 3: message_sent (within 7 days)
   - Step 4: trade_completed (within 30 days)
   - Goal: >15% new users complete trade in first month
   
   Funnel 4: Subscription Conversion
   - Step 1: subscription_upgrade_viewed
   - Step 2: subscription_tier_selected
   - Step 3: subscription_activated
   - Goal: >5% of viewers upgrade

3. Set Up Retention Cohorts:
   Amplitude > Create Chart > Retention
   
   Cohort 1: Weekly Retention (New Users)
   - Starting event: user_signed_up
   - Return event: Any Event
   - Cohort by: Week
   - Show: 12 weeks
   - Goal: >20% Week 4 retention
   
   Cohort 2: Trade Retention
   - Starting event: trade_completed
   - Return event: trade_completed
   - Cohort by: Week
   - Goal: >40% repeat traders within 4 weeks
   
   Cohort 3: Subscription Retention
   - Starting event: subscription_activated
   - Return event: subscription_renewed
   - Cohort by: Month
   - Goal: >80% monthly renewal rate

4. Create Key Metric Dashboards:
   
   Dashboard 1: Growth Metrics
   - Daily Active Users (DAU)
   - Weekly Active Users (WAU)
   - Monthly Active Users (MAU)
   - New Signups (daily)
   - DAU/MAU ratio (stickiness) - Goal: >20%
   
   Dashboard 2: Engagement Metrics
   - Listings created (daily)
   - Trades completed (daily)
   - Messages sent (daily)
   - Search queries (daily)
   - Avg session duration
   - Avg sessions per user per week
   
   Dashboard 3: Monetization Metrics
   - Revenue (daily) - cash trades
   - Points value exchanged (daily)
   - Subscription activations (daily)
   - Subscription MRR (Monthly Recurring Revenue)
   - ARPU (Average Revenue Per User)
   - LTV (Lifetime Value) - estimated
   
   Dashboard 4: Platform Health
   - Trade completion rate
   - Payment success rate
   - Search conversion rate (search → view → trade)
   - Error rate
   - Crash rate
   - User reports / flags

5. Set Up User Properties:
   Track these properties for each user:
   
   // On signup/login
   amplitude.setUserId(user.id);
   amplitude.setUserProperties({
     email: user.email,
     signup_date: user.created_at,
     subscription_tier: user.subscription_tier,
     badge_level: user.badge_level,
     points_balance: user.points_balance,
     location_city: user.city,
     location_state: user.state,
   });
   
   // Update on relevant events
   amplitude.setUserProperties({
     total_listings: count,
     total_trades: count,
     total_messages_sent: count,
     avg_rating: rating,
     last_active: new Date(),
   });

6. Create User Segments:
   Amplitude > Create Segment
   
   Segment: Active Traders
   - Condition: trade_completed count >= 3 in last 30 days
   
   Segment: Churned Users
   - Condition: Last active > 30 days ago
   
   Segment: Power Users
   - Condition: DAU in last 7 days >= 5
   
   Segment: Subscribers
   - Condition: subscription_tier = 'basic' OR 'premium'
   
   Segment: High-Value Users
   - Condition: Total trade value > $500
   
   Use segments to:
   - Analyze behavior differences
   - Target re-engagement campaigns
   - Identify features that drive retention

7. Set Up Alerts:
   Amplitude > Alerts
   
   Alert 1: DAU Drop
   - Metric: Daily Active Users
   - Condition: Decreases by >20% day-over-day
   - Action: Email team immediately
   
   Alert 2: Payment Failure Spike
   - Metric: payment_failed event count
   - Condition: >10% of payment_processing events
   - Action: Page on-call engineer
   
   Alert 3: Low Trade Volume
   - Metric: trade_completed event count
   - Condition: <10 trades per day (below baseline)
   - Action: Email team
   
   Alert 4: Signup Spike
   - Metric: user_signed_up event count
   - Condition: >100% increase day-over-day
   - Action: Email team (could indicate viral growth or bot attack)

8. Document Analytics Taxonomy:
   Create ANALYTICS.md in project root:
   
   # Analytics Tracking Documentation
   
   ## Event Naming Convention
   - Format: `{noun}_{past_tense_verb}`
   - Example: `listing_created`, `trade_completed`
   - No spaces or special characters
   - Use snake_case
   
   ## Event Properties
   - Always include: `timestamp`, `user_id`, `platform` (iOS/Android)
   - Optional but recommended: `screen_name`, `source`
   
   ## User Properties
   - Updated on: Signup, login, profile edit, subscription change
   - Includes: Tier, badge, points, location, lifetime stats
   
   ## Complete Event Reference
   [Link to spreadsheet or table with all events, properties, and business logic]
   
   ## Amplitude Access
   - Dashboard: https://analytics.amplitude.com/yourapp
   - Login: SSO or team@yourapp.com
   - Permissions: View-only for analysts, Edit for admins

9. Test Analytics in Production:
   1. Download production app from TestFlight/Closed Testing
   2. Create test account (test+analytics@yourapp.com)
   3. Perform all key actions:
      - Signup
      - Create listing
      - Search
      - Initiate trade
      - Send message
      - Complete trade
      - Leave review
   4. Check Amplitude Live Events for each action
   5. Verify properties are correct
   6. Check user properties updated
   7. Confirm events appear in funnels and charts

10. Weekly Analytics Review Routine:
    Every Monday morning:
    - Review DAU/WAU/MAU trends
    - Check conversion funnels (any drops?)
    - Review retention cohorts (improving or declining?)
    - Check alerts (any triggered?)
    - Identify top-performing listing categories
    - Identify drop-off points in user journey
    - Export weekly report for stakeholders

ACCEPTANCE CRITERIA:
✓ All key events tracked and firing correctly
✓ Conversion funnels created and monitored
✓ Retention cohorts configured
✓ Dashboards created for growth, engagement, monetization
✓ User properties tracked accurately
✓ Alerts set up for critical metrics
✓ Analytics taxonomy documented
✓ Production testing completed

COST:
- Amplitude: Free tier (10M events/month) sufficient for MVP
- If exceeding: $49/month for Growth plan
```

### Time Breakdown
- Verify all events firing: 1 hour
- Create funnels, cohorts, dashboards: 1.5 hours
- Set up alerts and documentation: 0.5 hours

**Total: ~3 hours**

---

## TASK DEPLOY-010: Create Onboarding/Help Documentation for Users

**Duration:** 4 hours  
**Priority:** Medium  
**Dependencies:** None

### Description
Create user-facing help documentation, onboarding tutorials, FAQs, and support resources. Set up a knowledge base accessible from the app and website. Ensure new users understand how to use the app effectively.

---

### AI Prompt for Claude Sonnet 4.5 (User Documentation)

```bash
TASK: Create user onboarding and help documentation

CONTEXT:
New users need clear guidance on how to use the app. Create comprehensive documentation accessible via app and website.

REQUIREMENTS:
1. In-app onboarding flow (first-time user experience)
2. Help/FAQ section in app
3. Support website with knowledge base
4. Video tutorials (optional but recommended)
5. Tooltips for complex features
6. Contact support flow

STEPS:

1. Create In-App Onboarding Flow:
   Trigger on first app launch after signup
   
   Screen 1: Welcome
   - "Welcome to YourApp!"
   - "Trade locally, live sustainably"
   - [Next] button
   
   Screen 2: How It Works
   - Icon 1: Browse - "Discover items in your neighborhood"
   - Icon 2: Connect - "Message sellers securely"
   - Icon 3: Trade - "Buy, sell, or swap"
   - Icon 4: Earn - "Build reputation and earn points"
   - [Next] button
   
   Screen 3: Location Permission
   - "Find items nearby"
   - "We need your location to show local listings"
   - [Allow Location] button
   - [Skip for now] link
   
   Screen 4: Notifications Permission
   - "Never miss a message"
   - "Get notified about new messages and trade updates"
   - [Enable Notifications] button
   - [Skip for now] link
   
   Screen 5: Ready to Start
   - "You're all set!"
   - "Start by browsing items or creating your first listing"
   - [Browse Items] button (primary)
   - [Create Listing] button (secondary)
   
   Implementation:
   // src/screens/onboarding/OnboardingFlow.tsx
   - Use react-native-onboarding-swiper or custom screens
   - Track completion: trackEvent('onboarding_completed')
   - Save to user profile: onboarding_completed = true
   - Skip button (top right) for experienced users

2. Create FAQ Section:
   Accessible via app Settings > Help & FAQ
   
   FAQs (organized by category):
   
   GETTING STARTED
   Q: How do I create a listing?
   A: Tap the "+" button, add photos, title, description, price, and category. Your listing goes live after AI safety check (usually within minutes).
   
   Q: How do I search for items?
   A: Use the search bar on the home screen. Filter by category, price range, and distance to find exactly what you need.
   
   Q: What are community nodes?
   A: Geographic areas where you can trade. By default, you see items within 5 miles. You can browse other nodes too.
   
   BUYING & SELLING
   Q: How do I buy an item?
   A: View the listing and tap "Buy Now". Choose payment method (cash, points, or mix). Message the seller to arrange pickup.
   
   Q: What payment methods are accepted?
   A: Cash (paid via Stripe), Points (earned from trades), or a mix of both. Payment is held securely until you confirm receipt.
   
   Q: How do I earn points?
   A: Complete trades to earn points. Both buyers and sellers get points for each successful trade. Use points to buy items without cash!
   
   Q: What fees does YourApp charge?
   A: 5% on cash transactions, 10% on points transactions. This helps us maintain the platform and keep it safe.
   
   Q: Can I cancel a trade?
   A: Yes, within 24 hours of initiating the trade. After that, contact the other party to arrange cancellation.
   
   SAFETY & TRUST
   Q: How does YourApp keep me safe?
   A: We use AI to scan images and text for prohibited items. We check listings against CPSC recall databases. All users have ratings and reviews.
   
   Q: What if an item arrives damaged?
   A: Don't confirm receipt in the app. Contact the seller first. If unresolved, contact our support team within 48 hours.
   
   Q: How do I report a suspicious listing or user?
   A: Tap the "..." menu on any listing or profile and select "Report". Our moderation team will review it promptly.
   
   Q: What are badges?
   A: Badges (Bronze, Silver, Gold) indicate trustworthy users based on completed trades, ratings, and account age. Trade with confidence!
   
   POINTS & SUBSCRIPTIONS
   Q: Do points expire?
   A: No, your points never expire. Use them anytime!
   
   Q: What are the subscription tiers?
   A: Free (5 listings), Basic ($9.99/mo, 20 listings), Premium ($29.99/mo, unlimited listings + priority support).
   
   Q: Can I cancel my subscription?
   A: Yes, anytime. You'll keep your benefits until the end of your billing period.
   
   ACCOUNT & PROFILE
   Q: How do I edit my profile?
   A: Settings > Profile > Edit. Update your name, photo, bio, and location.
   
   Q: How do I change my notification settings?
   A: Settings > Notifications. Toggle each notification type (push, email, SMS).
   
   Q: How do I delete my account?
   A: Settings > Account > Delete Account. This is permanent and deletes all your data.
   
   MESSAGING
   Q: How do messaging work?
   A: In-app messaging keeps conversations private and secure. Message history is saved. You'll get push notifications for new messages.
   
   Q: Can sellers see my phone number?
   A: No, your contact info is private unless you choose to share it in a message.
   
   Implementation:
   // src/screens/settings/HelpScreen.tsx
   - Searchable FAQ list
   - Accordion UI (expand/collapse)
   - "Was this helpful?" feedback buttons
   - "Contact Support" button at bottom

3. Create Support Website (Knowledge Base):
   URL: https://yourapp.com/support or https://help.yourapp.com
   
   Structure:
   - Home: Search bar + top FAQs + categories
   - Categories:
     * Getting Started
     * Buying & Selling
     * Safety & Trust
     * Points & Subscriptions
     * Account & Profile
     * Messaging
     * Troubleshooting
   - Each article: Title, content, screenshots, "Was this helpful?"
   - Contact form: For questions not answered by FAQs
   
   Tools:
   - Intercom (knowledge base + live chat) - $79/month
   - Zendesk Guide - $49/agent/month
   - Notion (free, public pages) - $0
   - Custom Next.js site with MDX articles - $0
   
   Recommended for MVP: Notion Public Pages (free, easy to update)

4. Add Tooltips for Complex Features:
   Use react-native-walkthrough or react-native-tooltip
   
   Tooltip locations:
   - First time creating listing: "Add clear photos for faster sales"
   - First time setting price: "Consider using points to attract swaps"
   - First time initiating trade: "Payment is held securely until you confirm receipt"
   - Subscription page: "Upgrade for more listings and priority support"
   - Points balance: "Earn points by completing trades"
   
   Implementation:
   - Show once per user (save in user_metadata)
   - Dismissable with "Got it" button
   - Optional "Don't show tips again" toggle in Settings

5. Create Video Tutorials (Optional but Recommended):
   Duration: 30-60 seconds each
   
   Video 1: How to Create a Listing
   - Open app → Tap + button
   - Add photos (show photo picker)
   - Enter title, description, price
   - Select category
   - Tap "Post"
   - Show item going live
   
   Video 2: How to Buy an Item
   - Browse screen → Tap item
   - Item details → Tap "Buy Now"
   - Choose payment method
   - Message seller
   - Show confirmation
   
   Video 3: How to Earn Points
   - Complete a trade
   - Show points added to balance
   - Use points to buy another item
   
   Upload to YouTube (unlisted or public)
   Embed in app (WebView or link)
   Link from help.yourapp.com
   
   Tools:
   - Screen recording: QuickTime (Mac), OBS (Windows)
   - Editing: iMovie, DaVinci Resolve (free), CapCut
   - Captions: YouTube auto-captions (edit for accuracy)

6. Set Up Contact Support Flow:
   In-app: Settings > Help > Contact Support
   
   Form fields:
   - Name (pre-filled from profile)
   - Email (pre-filled)
   - Issue Type: [Select: Account, Listing, Trade, Payment, Bug, Other]
   - Description: (text area)
   - Attach screenshot (optional)
   - [Submit] button
   
   Backend: Email to support@yourapp.com
   Or integrate Intercom/Zendesk for ticket management
   
   Auto-response email:
   "Thanks for contacting YourApp Support! We've received your message and will respond within 24 hours. In the meantime, check our FAQ: https://yourapp.com/support"
   
   SLA (Service Level Agreement):
   - Response time: 24 hours (business days)
   - Resolution time: 3-5 business days
   - Critical issues (payment, safety): 4 hours

7. Create Troubleshooting Guides:
   Common issues and solutions:
   
   Issue: Can't log in
   - Check email/phone entered correctly
   - Reset password via "Forgot Password"
   - Check internet connection
   - Clear app cache: Settings > App > Clear Cache
   
   Issue: Payment failed
   - Check card details
   - Ensure sufficient funds
   - Try different card
   - Contact bank (may be blocking transaction)
   
   Issue: Listing not showing up
   - May be under AI review (up to 24 hours)
   - Check for CPSC safety flags
   - Verify all required fields filled
   
   Issue: Not receiving notifications
   - Settings > Notifications > Enable
   - Check phone settings (iOS: Settings > YourApp > Notifications)
   - Re-login to refresh push token
   
   Issue: App crashing
   - Update to latest version
   - Restart app
   - Clear cache
   - Reinstall app
   - Contact support if persists

8. Document Community Guidelines:
   URL: https://yourapp.com/guidelines
   
   Content:
   - Prohibited items (weapons, drugs, alcohol, adult content, etc.)
   - Prohibited behavior (harassment, spam, fraud)
   - Listing best practices (clear photos, honest descriptions)
   - Communication etiquette (be respectful, respond promptly)
   - Consequences (warnings, suspensions, bans)
   
   Show on signup: "By signing up, you agree to our Community Guidelines"
   Link from app: Settings > About > Community Guidelines

9. Create Release Notes Template:
   For each app update, include in App Store/Play Store:
   
   "What's New in v1.1.0:
   
   ✨ New Features
   - Dark mode support
   - Improved search filters
   
   🐛 Bug Fixes
   - Fixed messaging notification delay
   - Resolved payment processing error
   
   🎨 Improvements
   - Faster image uploads
   - Smoother animations
   
   As always, we'd love to hear your feedback! Contact us at support@yourapp.com"

10. Test Documentation with Beta Users:
    - Ask beta testers to use only documentation (no direct support)
    - Track which FAQs are accessed most
    - Identify gaps in documentation
    - Iterate based on feedback

DELIVERABLES CHECKLIST:
[ ] In-app onboarding flow implemented (5 screens)
[ ] FAQ section created (20+ questions)
[ ] Support website live (help.yourapp.com)
[ ] Video tutorials created (3 videos)
[ ] Tooltips added for complex features
[ ] Contact support form functional
[ ] Troubleshooting guides documented
[ ] Community guidelines published
[ ] Release notes template created

ACCEPTANCE CRITERIA:
✓ New users can onboard without external help
✓ Top 20 FAQs answered comprehensively
✓ Support website accessible and searchable
✓ Video tutorials embedded in app and website
✓ Contact support flow working (tickets arrive)
✓ Beta testers report improved onboarding experience

TOOLS & RESOURCES:
- In-app onboarding: react-native-onboarding-swiper
- FAQs: Accordion component (react-native-collapsible)
- Knowledge base: Notion, Intercom, or custom Next.js
- Video hosting: YouTube (unlisted or public)
- Screen recording: QuickTime, OBS
- Video editing: iMovie, CapCut, DaVinci Resolve
```

### Time Breakdown
- Create in-app onboarding flow: 1.5 hours
- Write FAQs and set up help section: 1.5 hours
- Create support website and contact form: 1 hour

**Total: ~4 hours**

---

## Summary (Tasks 6-10)

| Task | Description | Duration | Priority |
|------|-------------|----------|----------|
| DEPLOY-006 | iOS App Store submission | 8h | Critical |
| DEPLOY-007 | Android Google Play submission | 6h | Critical |
| DEPLOY-008 | Create app store assets | 6h | High |
| DEPLOY-009 | Set up analytics tracking | 3h | High |
| DEPLOY-010 | Create user documentation | 4h | Medium |

**Total Time (Tasks 6-10): ~27 hours**

**Key Deliverables:**
✅ iOS app live on App Store  
✅ Android app live on Google Play  
✅ Professional app store listings with screenshots  
✅ Comprehensive analytics tracking operational  
✅ User onboarding and help documentation complete  

**Costs:**
- Apple Developer Program: $99/year
- Google Play Registration: $25 one-time
- Support tools: $0 (using free Notion for knowledge base)

**Total: ~$124 first year, ~$99/year ongoing**

---

**Ready to proceed with Tasks 11-17 (Security Audit, Beta Launch, Public Rollout)?** 🎯

---

## TASK DEPLOY-011: Create Admin User Guide (Operations & Moderation Handbook)

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** DEPLOY-002 (Admin panel live)

### Description
Produce a comprehensive admin handbook covering daily operational routines, moderation workflows, escalation paths, emergency procedures, configuration changes, reporting/auditing, and tooling usage. This becomes the single source of truth for internal operations.

---

### AI Prompt for Claude Sonnet 4.5 (Admin Guide Generation)

```bash
TASK: Generate an Admin Operations & Moderation Guide

CONTEXT:
Admin panel deployed. Need structured guide so new admin can be productive in <2 hours. Include daily, weekly, monthly routines.

REQUIREMENTS:
1. Overview of admin roles & permissions
2. Daily checklist
3. Moderation workflow (flags, recalls, AI overrides)
4. Configuration change procedure (fees, tiers, badges)
5. Escalation & incident response
6. Reporting (weekly metrics dashboard usage)
7. Data access & audit logging
8. Security practices & key management
9. Glossary of internal terms
10. Quick start section (first 60 minutes)

OUTLINE:
1. Introduction
2. Roles & Permissions Matrix
3. Daily Operations Checklist
4. Moderation & Safety Flow
5. Configuration Management Procedure
6. Incident Response Playbook
7. Reporting & Metrics
8. Data Access & Auditing
9. Security & Compliance
10. Glossary
11. Appendix: Common Queries / SQL snippets

KEY DETAILS:
Roles:
- SuperAdmin: Full access, can modify system configs.
- Moderator: Can review flags, approve/reject items.
- SupportAgent: Can view users/items, limited edits.
- Analyst: Read-only + metrics.

Daily Checklist (AM):
- Review overnight error alerts (Sentry). Resolve high severity.
- Check trade volume vs baseline.
- Process moderation queue (target SLA < 2h)
- Review new high-value listings (> $500) manually.

Afternoon:
- Scan abuse reports (flagged users/items).
- Verify cron jobs executed (trend snapshots, unread emails).
- Spot-check subscription activations.

Moderation Flow:
1. Item flagged (AI or user report) enters `item_safety_flags` table.
2. Moderator opens flagged item detail view.
3. Actions: Approve (clears flag), Reject (item hidden), Escalate (security review).
4. Escalation triggers Slack pager + adds row to `admin_activity_log`.
5. Resolution documented; if false positive pattern detected, update AI override rules.

Configuration Changes:
1. Open Config Editor.
2. Clone current values to staging (safe preview).
3. Apply change in production (fee %, badge thresholds).
4. Log change: `admin_config_change` (who, what, before/after).
5. Notify team (#admin-changes channel). Wait 30 min; monitor metrics.

Incident Response Severity Levels:
- SEV1: Data breach/payment exploitation → immediate lockdown, rotate keys.
- SEV2: Extended downtime (> 30 min) → status page update, hourly comms.
- SEV3: Feature degradation (moderation queue stuck) → work-around plan.
- SEV4: Minor bug → backlog ticket.

Escalation Contacts:
- Tech Lead: techlead@yourapp.com
- Security: security@yourapp.com
- Compliance: compliance@yourapp.com

Weekly Reporting:
- Metrics pulled from Amplitude dashboard.
- KPIs: DAU, WAU, trades completed, listing creation, conversion funnel %, payment success %, churn ratio.
- Publish summary in Notion + Slack Monday 10 AM.

Audit Logging:
- Every admin write action enters `admin_activity_log`.
- Quarterly export: CSV retention for 2 years.

Security Practices:
- Use 2FA for all admin accounts.
- Rotate service role keys every 90 days.
- Principle of least privilege applied to roles.

Glossary Examples:
- Node: Geographic cluster of users & listings.
- Flag: Safety/moderation indicator.
- PITR: Point-In-Time Recovery (database restore capability).

Acceptance Criteria Section at end.

OUTPUT FORMAT:
Markdown file: ADMIN_GUIDE.md with headings & checklists.
```

### Acceptance Criteria
✓ `ADMIN_GUIDE.md` created with full outlined sections  
✓ Roles & permissions matrix documented  
✓ Daily/weekly/monthly routines defined  
✓ Moderation workflow diagram textual description included  
✓ Incident response severity + actions clear  
✓ Config change procedure auditable  
✓ Glossary covers ≥15 key terms  
✓ Stored in repo root or `docs/` (choose `docs/` if exists)  

### Time Breakdown
- Outline & structure: 1h  
- Draft content: 2h  
- Review & refine + add examples: 1h  

**Total: ~4 hours**

---

## TASK DEPLOY-012: Security Audit (RLS, Secrets, OWASP, Dependency Review)

**Duration:** 5 hours  
**Priority:** Critical  
**Dependencies:** DEPLOY-001, DEPLOY-004

### Description
Perform a focused production security audit: verify Row Level Security policies, inspect Edge Function scopes, rotate critical secrets, run dependency vulnerability scans, review authentication flows for common attack vectors, and document remediation actions.

---

### AI Prompt for Claude Sonnet 4.5 (Security Audit)

```bash
TASK: Conduct security audit of production environment

SCOPE:
1. Database RLS & privilege review
2. Edge Functions secret handling
3. Auth flows (signup, login, password reset)
4. Dependency vulnerabilities (npm audit, Snyk)
5. OWASP Top 10 quick assessment
6. Keys & secrets rotation checklist
7. Logging & monitoring coverage
8. Actionable remediation report

STEPS:
1. Export RLS definitions & review for unintended broad access.
2. Attempt unauthorized queries using regular user token (expect failures).
3. Inspect each Edge Function: confirm service role key only used where strictly required.
4. Run: npm audit --production; document high severity issues & resolutions.
5. Run: npx snyk test (if Snyk integrated) -> capture report.
6. Check OWASP items: Injection, Auth, Sensitive Data Exposure, Access Control, Misconfig, XSS, Insecure Deserialization (N/A if RN), SSRF (external calls), Components w/ known vulns.
7. Secrets rotation plan:
   - STRIPE_SECRET_KEY
   - OPENAI_API_KEY
   - SENDGRID_API_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - SENTRY_DSN (if compromised)
8. Verify HTTPS everywhere & HSTS header on web surfaces.
9. Confirm password reset flow rate limits & token expiry.
10. Produce SECURITY_AUDIT_REPORT.md with: Findings, Severity, Recommended Fix, Owner, Target Date.

REPORT FORMAT TABLE:
| ID | Finding | Severity | Surface | Recommendation | Owner | Target Date |
|----|---------|----------|---------|----------------|-------|-------------|

ACCEPTANCE CRITERIA included.
```

### Acceptance Criteria
✓ RLS tested (unauthorized access blocked)  
✓ Edge Functions secrets usage minimized  
✓ Dependency scan completed & high severity addressed/ ticketed  
✓ OWASP Top 10 checklist filled  
✓ Secrets rotation schedule documented  
✓ `SECURITY_AUDIT_REPORT.md` created with table of findings  
✓ Follow-up tickets created for unresolved items  

### Time Breakdown
- RLS + function review: 2h  
- Dependency & OWASP assessment: 2h  
- Report + ticket creation: 1h  

**Total: ~5 hours**

---

## TASK DEPLOY-013: Performance Audit & Optimization (Load, Query Tuning, Frontend Metrics)

**Duration:** 5 hours  
**Priority:** High  
**Dependencies:** DEPLOY-004 (Monitoring live)

### Description
Measure and optimize system performance: simulate concurrent usage (trades, searches, messaging), profile slow SQL queries, optimize indexes, measure frontend startup & interaction times, establish baseline performance metrics for ongoing tracking.

---

### AI Prompt for Claude Sonnet 4.5 (Performance Audit)

```bash
TASK: Execute performance audit & implement quick optimizations

TARGETS:
1. API latency (p50/p95/p99) for core endpoints
2. DB query timing & index coverage
3. Load test: 500 concurrent active users scenario
4. React Native app cold start + time-to-interactive
5. Admin panel page load metrics
6. Identify top 5 bottlenecks & fix ≥3 immediately

STEPS:
1. Define test scenarios (k6 scripts):
   - User signup burst
   - Listing search & view
   - Trade initiation + payment flow
   - Messaging send/receive
2. k6 example snippet:
   // performance/tests/trade-flow.js
   import http from 'k6/http';
   import { sleep } from 'k6';
   export const options = { vus: 100, duration: '5m' };
   export default function() {
     http.get('https://api.yourapp.com/items?query=toy');
     http.post('https://api.yourapp.com/trades', JSON.stringify({ item_id: 'x', amount: 120 }), { headers: { 'Content-Type': 'application/json'} });
     sleep(1);
   }
3. Capture results; record p95 latency thresholds.
4. Enable PG_STAT_STATEMENTS extension (if not already) & query top slow statements.
5. Index review: ensure columns used in WHERE / JOIN have indexes (e.g., trades.status, items.node_id, items.created_at).
6. Add missing indexes; re-run sample queries & capture improvement.
7. App performance: Use React Native Performance + Xcode Instruments.
   - Aim cold start < 2.5s, first interactive < 3.5s.
8. Admin panel: Lighthouse run on dashboard page (target performance score ≥ 85).
9. Document baseline metrics in PERFORMANCE_BASELINE.md.
10. Implement 3 quick wins (e.g., caching frequent read queries, lazy loading heavy components, compressing images).
```

### Acceptance Criteria
✓ Load test results captured with p50/p95/p99  
✓ Slow queries identified & ≥3 optimized  
✓ Index improvements documented  
✓ App cold start & TTI measured & targets recorded  
✓ Admin panel Lighthouse report stored  
✓ `PERFORMANCE_BASELINE.md` created  
✓ At least 3 performance improvements shipped  

### Time Breakdown
- Load test scripting & execution: 2h  
- Query/index analysis: 1.5h  
- Frontend performance measurement: 1h  
- Documentation + quick wins: 0.5h  

**Total: ~5 hours**

---

## TASK DEPLOY-014: Beta Launch (Controlled Release to Initial Geography)

**Duration:** 6 hours  
**Priority:** High  
**Dependencies:** DEPLOY-006, DEPLOY-007, DEPLOY-011 (docs ready)

### Description
Execute a structured beta launch in a single target locality (e.g., Norwalk CT). Onboard first 50-100 users, seed initial listings, monitor engagement, collect qualitative feedback, and validate core retention assumptions before broader release.

---

### AI Prompt for Claude Sonnet 4.5 (Beta Launch Plan)

```bash
TASK: Plan & execute beta launch

GOALS:
- Acquire 50-100 real users in a single locality.
- Achieve ≥ 10 completed trades within first 14 days.
- Gather structured feedback from ≥ 20 users.

STEPS:
1. Pre-Launch Seeding:
   - Create 30 high-quality sample listings (varied categories).
   - Recruit 10 'Champion Users' (friends/community members) to post genuine items.
2. Beta Invite Wave:
   - Email template: introduction, value proposition, download links, call to list first item.
   - Channels: Local Facebook groups, Nextdoor, school parent lists.
3. In-App Beta Flag:
   - Show "Beta" badge in header + feedback button.
4. Feedback Collection:
   - In-app modal after 3rd session: NPS survey (0-10) + open text.
   - Weekly email: "What blocked you? What do you love?"
5. Metrics to Track:
   - DAU / WAU in beta locality.
   - Listings created per user.
   - Trade initiation → completion funnel.
   - Messaging engagement rate (messages per active user).
6. Manual Support & Observation:
   - Admin reviews every listing manually first 72 hours for quality.
   - Daily check of flagged content.
7. Adjustments During Beta:
   - Tweak listing categories based on usage.
   - Resolve top 5 UX friction points quickly.
8. Beta Exit Criteria:
   - ≥ 10 completed trades.
   - ≥ 20 feedback submissions.
   - Trade completion rate ≥ 60% (initiated → completed).
   - Crash rate < 1%. Payment failure rate < 5%.
9. Produce BETA_SUMMARY_REPORT.md with outcomes & recommendations.
```

### Acceptance Criteria
✓ 50–100 beta users onboarded  
✓ ≥10 trades completed in beta window  
✓ ≥20 structured feedback responses  
✓ Beta metrics dashboard created  
✓ `BETA_SUMMARY_REPORT.md` compiled  
✓ Exit criteria evaluated & documented  

### Time Breakdown
- Seeding + outreach setup: 2h  
- Instrument feedback + metrics: 2h  
- Monitoring & adjustments (active work): 2h  

**Total: ~6 hours** (spread across beta period)

---

## TASK DEPLOY-015: Monitor Metrics & Gather Feedback (14-Day Beta Window)

**Duration:** 4 hours (active analysis & setup)  
**Priority:** High  
**Dependencies:** DEPLOY-014

### Description
Establish daily rhythm for beta metrics monitoring, compile qualitative feedback, categorize issues (P0-P3), and feed into iteration backlog. This task covers constructing tracking artifacts & weekly synthesis, not the entire elapsed two-week span.

---

### AI Prompt for Claude Sonnet 4.5 (Beta Monitoring Routine)

```bash
TASK: Set up beta monitoring & feedback synthesis system

COMPONENTS:
1. Daily metrics snapshot script
2. Feedback tagging taxonomy
3. Issue triage board
4. Weekly synthesis doc
5. Escalation triggers

STEPS:
1. Create METRICS_SNAPSHOT.md updated daily with:
   - DAU
   - New listings
   - Trades initiated/completed
   - Messages sent
   - Crash rate / error rate
   - Payment failures
2. Automate snapshot:
   - Use Amplitude export API or manual copy (MVP).
   - Append table per day.
3. Feedback Taxonomy Tags:
   - UX_NAVIGATION, PERFORMANCE, BUG, FEATURE_REQUEST, TRUST_SAFETY, PAYMENTS, ONBOARDING
4. Issue Triage Board (Notion / GitHub Projects):
   - Columns: Backlog, Investigating, In Progress, Shipped.
   - Severity: P0 (blocker), P1 (high), P2 (medium), P3 (low).
5. Escalation Rules:
   - Crash rate > 2% day: Immediate P0 investigation.
   - Payment failure rate > 8%: Flag engineering.
   - Negative NPS (< 20 average): Deep dive user interviews.
6. Weekly Synthesis (WEEKLY_BETA_SYNTHESIS.md):
   - Highlights
   - Top friction points
   - Quick wins executed
   - Pending strategic issues
   - Recommendation for next week focus.
```

### Acceptance Criteria
✓ Metrics snapshot mechanism established  
✓ Feedback taxonomy defined & applied  
✓ Issue triage board active  
✓ Weekly synthesis template created  
✓ Escalation triggers documented  
✓ First week synthesis completed  

### Time Breakdown
- Setup metrics & docs: 1.5h  
- Taxonomy + board + rules: 1.5h  
- First synthesis pass: 1h  

**Total: ~4 hours**

---

## TASK DEPLOY-016: Iterate Based on Feedback (Implement High-Impact Improvements)

**Duration:** 6 hours  
**Priority:** High  
**Dependencies:** DEPLOY-015

### Description
Select the highest impact beta improvements (UX friction, performance fixes, clarity enhancements) and ship rapid iterations before public launch. Focus on changes improving activation & trade completion funnel.

---

### AI Prompt for Claude Sonnet 4.5 (Iteration Planning)

```bash
TASK: Plan & execute iteration sprint based on beta feedback

INPUTS:
- WEEKLY_BETA_SYNTHESIS.md
- Issue triage board
- Metrics trends

STEPS:
1. Identify top 5 friction points impacting conversion.
2. Map each to root cause & possible fix.
3. Prioritize using ICE scoring (Impact, Confidence, Effort).
4. Create ITERATION_PLAN.md with:
   | Friction | Root Cause | Proposed Fix | ICE Score | Status |
5. Implement 3–5 quick fixes (e.g., clearer CTA, reduce listing form steps, improve error messaging, add loading skeletons).
6. Track post-change metrics deltas for 72 hours.
7. Update plan with outcomes & next recommendations.
```

### Acceptance Criteria
✓ ITERATION_PLAN.md created with scoring  
✓ ≥3 high-impact fixes shipped  
✓ Post-change metric comparison documented  
✓ Remaining backlog items re-prioritized  
✓ Improvement rationale clear for each fix  

### Time Breakdown
- Analysis & selection: 2h  
- Implement fixes: 3h  
- Post-change evaluation & doc: 1h  

**Total: ~6 hours**

---

## TASK DEPLOY-017: Public Launch (Full Rollout & Marketing Activation)

**Duration:** 5 hours  
**Priority:** Critical  
**Dependencies:** DEPLOY-016 (Iterations applied)

### Description
Transition from beta to public availability: finalize marketing site, publish press/social posts, remove beta flags, verify scalability settings, execute launch-day monitoring plan, and communicate roadmap for upcoming releases.

---

### AI Prompt for Claude Sonnet 4.5 (Public Launch Execution)

```bash
TASK: Execute public launch sequence

CHECKLIST:
1. Remove "Beta" labels & feedback banners.
2. Switch feature flags enabling full subscription tiers.
3. Marketing Site:
   - Add App Store + Play badges.
   - Publish Launch Blog Post.
4. Social / PR:
   - LinkedIn company post.
   - Local community announcement.
   - Email to beta users thanking them & highlighting improvements.
5. Monitoring War Room (Launch Day):
   - Dedicated channel #launch-watch.
   - Metrics live dashboard pinned.
   - Roles assigned: Incident lead, Comms, Metrics watch.
6. Launch Metrics Targets (first 48h):
   - > 200 downloads
   - > 40 listings created
   - > 15 trades initiated
   - Payment success rate ≥ 95%
7. Post-Launch 24h Review:
   - Summarize metrics vs targets.
   - Capture unexpected issues.
   - Draft NEXT_RELEASE_PLAN.md (top 10 enhancements).
```

### Acceptance Criteria
✓ All beta branding removed  
✓ Marketing assets live & accessible  
✓ Launch communications executed  
✓ Real-time monitoring active launch day  
✓ 24h post-launch summary documented  
✓ NEXT_RELEASE_PLAN.md created  

### Time Breakdown
- Pre-launch prep & cleanup: 2h  
- Marketing & comms execution: 2h  
- Post-launch synthesis: 1h  

**Total: ~5 hours**

---

## Summary (Tasks 11-17)

| Task | Description | Duration | Priority |
|------|-------------|----------|----------|
| DEPLOY-011 | Admin user guide | 4h | High |
| DEPLOY-012 | Security audit | 5h | Critical |
| DEPLOY-013 | Performance audit | 5h | High |
| DEPLOY-014 | Beta launch execution | 6h | High |
| DEPLOY-015 | Beta monitoring & feedback | 4h | High |
| DEPLOY-016 | Iteration sprint | 6h | High |
| DEPLOY-017 | Public launch | 5h | Critical |

**Total Time (Tasks 11-17): ~35 hours**

**Cumulative Module Time:** 14h (1-5) + 27h (6-10) + 35h (11-17) = **~76 hours** (buffer above original 65h to account for launch contingencies)

**Additional Costs:**
- Security tooling (optional Snyk): $0–$59/month
- Monitoring scaling (if event volume grows): variable
- Marketing spend (optional paid ads): TBD

**Key Final Deliverables:**
✅ Admin operations handbook  
✅ Security & performance baselines  
✅ Successful beta metrics & summary report  
✅ Iteration improvements applied  
✅ Public launch executed with monitoring & follow-up plan  

---

**Review Tasks 11-17 now. Confirm when ready for MODULE-16-VERIFICATION.md generation.** ✅
