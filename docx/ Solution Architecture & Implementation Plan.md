P2P Kids Marketplace - Solution Architecture & Implementation Plan
SECTION 1: ARCHITECTURE OVERVIEW
1.1 Executive Summary
Based on your requirements and answers, I'm designing a lean, cost-optimized architecture for a mobile-first P2P Kids Marketplace with subscription-gated Swap Points.
Key Decisions Confirmed:
Decision
Choice
Mobile App
React Native (iOS + Android)
Admin Portal
React Web (included in MVP)
Backend
Node.js + TypeScript + Express
Database/Auth/Storage
Supabase (free tier → Pro)
Hosting
Vercel (frontend) + Supabase (backend) - US East
ID Verification
Phone required + optional manual ID upload
Billing
Stripe-only (with App Store IAP as post-MVP epic)
Delivery
Post-MVP (chat-coordinated in MVP)
AI Moderation
NSFW.js (open-source) + CPSC API (free)
Figma
Figma Make (AI full-stack React export)
SP Ledger
Pre-designed for direct swaps (feature-flagged)
Node Management
Manual admin configuration
Real-time
Supabase Realtime (chat) + FCM (push notifications)
Analytics
Firebase Analytics + custom admin dashboards
Team
Solo founder + AI agents
Timeline
Flexible - launch when ready


1.2 High-Level Architecture Diagram
┌─────────────────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐      ┌──────────────────────────────────────┐ │
│  │   REACT NATIVE APP       │      │      REACT WEB ADMIN PORTAL          │ │
│  │   (iOS + Android)        │      │      (Vercel Hosted)                 │ │
│  │                          │      │                                      │ │
│  │  • Expo SDK (managed)    │      │  • Tailwind CSS                      │ │
│  │  • NativeWind (Tailwind) │      │  • Shadcn/UI components             │ │
│  │  • React Navigation      │      │  • React Query                       │ │
│  │  • Stripe RN SDK         │      │  • Recharts (analytics)              │ │
│  │  • Firebase Analytics    │      │  • Firebase Auth (admin SSO)         │ │
│  │  • NSFW.js (client-side) │      │                                      │ │
│  │                          │      │  Features:                           │ │
│  │  Features:               │      │  • User management                   │ │
│  │  • Swipe-based browse    │      │  • SP configuration                  │ │
│  │  • Listing creation      │      │  • Node/waitlist management          │ │
│  │  • SP wallet             │      │  • Moderation queue                  │ │
│  │  • Chat messaging        │      │  • Analytics dashboards              │ │
│  │  • Profile management    │      │  • Manual SP adjustments             │ │
│  │  • Subscription mgmt     │      │  • Cost monitoring                   │ │
│  └──────────────┬───────────┘      └──────────────────┬───────────────────┘ │
│                 │                                      │                     │
└─────────────────┼──────────────────────────────────────┼─────────────────────┘
                  │  HTTPS/WSS                           │ HTTPS
                  │                                      │
┌─────────────────▼──────────────────────────────────────▼─────────────────────┐
│                           API LAYER (Supabase)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    SUPABASE EDGE FUNCTIONS (Deno/TS)                    │ │
│  │                                                                          │ │
│  │   /auth/*          /listings/*       /transactions/*    /admin/*        │ │
│  │   • signup         • create          • create           • config        │ │
│  │   • verify-phone   • update          • complete         • users         │ │
│  │   • login          • search          • refund           • moderation    │ │
│  │   • refresh        • moderate        • dispute          • analytics     │ │
│  │                                                                          │ │
│  │   /sp/*            /subscriptions/*  /messages/*        /nodes/*        │ │
│  │   • wallet         • create          • send             • list          │ │
│  │   • calculate      • cancel          • history          • waitlist      │ │
│  │   • release        • webhook         • realtime         • assign        │ │
│  │   • adjust         • reactivate                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │   SUPABASE AUTH      │  │  SUPABASE REALTIME   │  │ ROW LEVEL SECURITY│  │
│  │   • Phone (Twilio)   │  │  • Chat channels     │  │ • User isolation  │  │
│  │   • Email            │  │  • SP balance updates│  │ • Node scoping    │  │
│  │   • JWT tokens       │  │  • New listings      │  │ • Admin roles     │  │
│  └──────────────────────┘  └──────────────────────┘  └───────────────────┘  │
│                                                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                              DATA LAYER                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                  SUPABASE POSTGRESQL                                    │  │
│  │                                                                         │  │
│  │  CORE TABLES:                      SP LEDGER:                          │  │
│  │  ├── users                         ├── sp_wallets                      │  │
│  │  ├── children                      ├── sp_transactions                 │  │
│  │  ├── listings                      │   (with from_user_id,             │  │
│  │  ├── transactions                  │    to_user_id for future          │  │
│  │  ├── messages                      │    direct swaps)                  │  │
│  │  ├── ratings                       └── sp_config (per node)            │  │
│  │  └── reports                                                            │  │
│  │                                                                         │  │
│  │  ADMIN TABLES:                     GEO TABLES:                         │  │
│  │  ├── admin_users                   ├── nodes                           │  │
│  │  ├── moderation_queue              ├── zip_codes                       │  │
│  │  ├── audit_log                     └── waitlist                        │  │
│  │  └── feature_flags                                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐                     │
│  │  SUPABASE STORAGE      │  │  UPSTASH REDIS         │                     │
│  │  (or Cloudflare R2)    │  │  (Serverless Cache)    │                     │
│  │                        │  │                        │                     │
│  │  Buckets:              │  │  Uses:                 │                     │
│  │  • listing-photos      │  │  • Session tokens      │                     │
│  │  • id-documents        │  │  • Rate limiting       │                     │
│  │  • profile-avatars     │  │  • Feed caching        │                     │
│  │  (private)             │  │  • SMS code store      │                     │
│  └────────────────────────┘  └────────────────────────┘                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL INTEGRATIONS                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   STRIPE    │  │   TWILIO    │  │    CPSC     │  │ FIREBASE CLOUD MSG  │ │
│  │             │  │             │  │   API       │  │                     │ │
│  │ • Payments  │  │ • SMS codes │  │             │  │ • Push notifications│ │
│  │ • Subscript.│  │ • Phone     │  │ • Recall    │  │ • iOS + Android     │ │
│  │ • Webhooks  │  │   verify    │  │   lookup    │  │ • Topic-based       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │      FIREBASE ANALYTICS     │  │         CLOUDFLARE                  │   │
│  │                             │  │                                     │   │
│  │  • Mobile events            │  │  • CDN for images                   │   │
│  │  • Conversion tracking      │  │  • DDoS protection                  │   │
│  │  • User properties          │  │  • Free SSL                         │   │
│  │  • Custom dashboards        │  │  • R2 storage (if needed)           │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND JOBS (Supabase)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │  SP RELEASE CRON   │  │  LISTING EXPIRY    │  │  SUBSCRIPTION SYNC     │ │
│  │  (Daily midnight)  │  │  (Daily)           │  │  (Stripe webhooks)     │ │
│  │                    │  │                    │  │                        │ │
│  │  • Check pending SP│  │  • Check 90-day    │  │  • Trial reminders     │ │
│  │  • Auto-release    │  │    expiration      │  │  • Grace period start  │ │
│  │    after 3 days    │  │  • Send reminders  │  │  • SP freeze/unfreeze  │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────┘ │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐                             │
│  │  GRACE PERIOD      │  │  COST MONITORING   │                             │
│  │  EXPIRY (Daily)    │  │  (Weekly)          │                             │
│  │                    │  │                    │                             │
│  │  • Check 90-day    │  │  • Aggregate usage │                             │
│  │    grace periods   │  │  • Check thresholds│                             │
│  │  • Delete SP       │  │  • Send alerts     │                             │
│  └────────────────────┘  └────────────────────┘                             │
│                                                                              │




1.3 Component Breakdown & Responsibilities
Component
Responsibilities
Primary Data
Key APIs
Identity & Access
Auth, phone/email verification, JWT tokens, admin SSO
users, admin_users
/auth/*
User & Child Profiles
Profile management, child profiles, preferences
users, children
/users/*, /children/*
Listings & Catalog
CRUD listings, photo upload, AI moderation, search
listings, listing-photos bucket
/listings/*
Checkout & Transactions
Purchase flow, fee calculation, SP+cash split, Stripe
transactions
/transactions/*
Swap Points & Ledger
SP wallet, pending/release, FIFO, ledger integrity
sp_wallets, sp_transactions
/sp/*
Kids Club+ Subscription
Trial, billing, grace period, cancellation
users.subscription_*, Stripe
/subscriptions/*
Safety & Moderation
NSFW.js, CPSC lookup, reports, manual queue
moderation_queue, reports
/moderation/*
Messaging
Real-time chat, no contact info sharing
messages, Supabase Realtime
/messages/*
Node & Waitlist
ZIP-to-node mapping, waitlist management
nodes, zip_codes, waitlist
/nodes/*
Admin Config
SP formula, fees, feature flags, node settings
sp_config, feature_flags
/admin/*
Analytics
Firebase events, admin dashboards, cost tracking
Firebase, custom views
Firebase + custom


1.4 Data Schema Design (Core Tables)
SP Ledger Design (Critical for Integrity)
-- SP Wallet (one per subscriber)
CREATE TABLE sp_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  available_sp INTEGER NOT NULL DEFAULT 0 CHECK (available_sp >= 0),
  pending_sp INTEGER NOT NULL DEFAULT 0 CHECK (pending_sp >= 0),
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Lifetime stats
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_received INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- SP Transaction Ledger (immutable append-only)
CREATE TABLE sp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id),
  
  -- Transaction type
  type TEXT NOT NULL CHECK (type IN (
    'earned',           -- Seller earns from sale
    'received',         -- Seller receives buyer's SP
    'spent',            -- Buyer spends SP
    'released',         -- Pending → Available
    'cancelled',        -- Pending cancelled (return)
    'expired',          -- Grace period expired
    'admin_adjustment', -- Manual admin change
    'starter_pack',     -- Initial bonus
    'transfer_out',     -- Future: direct swap (outgoing)
    'transfer_in'       -- Future: direct swap (incoming)
  )),
  
  amount INTEGER NOT NULL, -- Positive for credits, negative for debits
  
  -- Status for pending transactions
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN (
    'pending', 'completed', 'cancelled'
  )),
  
  -- Pending release tracking
  pending_until TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  
  -- Context
  description TEXT NOT NULL,
  listing_id UUID REFERENCES listings(id),
  transaction_id UUID REFERENCES transactions(id),
  
  -- For future direct swaps (feature-flagged)
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  
  -- Audit
  admin_id UUID REFERENCES users(id), -- If admin adjustment
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Immutable - no updated_at
  INDEX idx_wallet_id (wallet_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_pending_until (pending_until)
);

-- SP Configuration per Node
CREATE TABLE sp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT NOT NULL UNIQUE,
  
  -- Formula settings
  formula_type TEXT NOT NULL DEFAULT 'percentage' CHECK (formula_type IN (
    'price_bands', 'percentage', 'hybrid'
  )),
  base_percentage DECIMAL(5,2) DEFAULT 25.00,
  min_sp_per_transaction INTEGER DEFAULT 10,
  max_sp_per_transaction INTEGER DEFAULT 200,
  
  -- Category multipliers (JSONB)
  category_multipliers JSONB DEFAULT '{
    "baby_gear": 1.5,
    "clothes": 1.0,
    "toys": 1.0,
    "books": 1.0,
    "shoes": 1.0,
    "outdoor": 1.0,
    "sports": 1.0
  }'::jsonb,
  
  -- Redemption settings
  max_sp_percentage INTEGER DEFAULT 50,
  platform_fee_subscribers DECIMAL(10,2) DEFAULT 0.99,
  platform_fee_free DECIMAL(10,2) DEFAULT 2.99,
  
  -- Lifecycle
  pending_period_days INTEGER DEFAULT 3,
  grace_period_days INTEGER DEFAULT 90,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

Node Segmentation


-- Geographic Nodes
CREATE TABLE nodes (
  id TEXT PRIMARY KEY, -- e.g., 'norwalk_ct', 'little_falls_nj'
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waitlist', 'inactive')),
  launch_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ZIP Code to Node Mapping
CREATE TABLE zip_codes (
  zip TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waitlist for inactive nodes
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  zip TEXT NOT NULL,
  kids_count INTEGER,
  kids_ages TEXT[], -- e.g., ['2', '4', '7']
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ, -- When node launched
  converted_user_id UUID REFERENCES users(id)
);
1.5 External Integrations Summary
Integration
Purpose
Cost (MVP Scale)
Implementation
Stripe
Payments, subscriptions
2.9% + $0.30/tx
Stripe SDK + webhooks
Twilio
SMS verification
~$40/mo (5K users)
Supabase Auth phone provider
CPSC API
Product recall lookup
Free
REST API calls
Firebase Analytics
Mobile analytics
Free
React Native Firebase SDK
Firebase Cloud Messaging
Push notifications
Free
FCM + Supabase triggers
Cloudflare
CDN, DDoS, SSL
Free tier
DNS + proxy
NSFW.js
Image moderation
Free (client-side)
NPM package


1.6 Security, Privacy & Compliance
Concern
Implementation
Data Encryption (Transit)
TLS 1.3 enforced via Supabase + Cloudflare
Data Encryption (Rest)
Supabase PostgreSQL encryption + encrypted storage buckets
PII Protection
Phone/email encrypted at rest, RLS policies isolate user data
Child Data (COPPA)
Child profiles contain only first name, age, sizes (no PII collected from children)
Password Security
Supabase Auth uses bcrypt (cost 12)
ID Documents
Stored in private bucket, admin-only access, deleted after verification
Audit Trail
audit_log table tracks all admin actions, SP adjustments, moderation decisions
SP Ledger Integrity
Append-only ledger, no updates/deletes, checksums on critical transactions
RLS (Row Level Security)
All tables have RLS policies: users see only their data + their node's listings
Admin Access
Separate admin_users table, Firebase Auth for SSO, IP allowlist (optional)


1.7 Scalability, Performance & Cost
Performance Targets vs. Implementation
Target
How We Achieve It
Page load < 2s
Vercel edge deployment, image optimization, lazy loading, Cloudflare CDN
Image load < 1s
Supabase Storage with Cloudflare CDN, WebP format, responsive sizes
Chat < 500ms
Supabase Realtime (WebSocket), edge-close to US East
99.9% uptime
Supabase managed, Vercel auto-scaling, no single points of failure

Cost Projections
Service
Free Tier Limit
MVP Usage (500 users)
Cost at 5K Users
Supabase
500MB DB, 1GB storage, 2GB bandwidth
Within free
$25/mo (Pro)
Vercel
100GB bandwidth
Within free
Free (likely)
Upstash Redis
10K commands/day
Within free
Free (likely)
Twilio SMS
Pay-as-you-go
~$5/mo
~$40/mo
Cloudflare
Unlimited bandwidth
Free
Free
Firebase Analytics
Unlimited
Free
Free
Firebase FCM
Unlimited
Free
Free
Stripe
2.9% + $0.30
~$50/mo in fees
~$500/mo
TOTAL
—
~$55/mo
~$565/mo

Cost Monitoring Plan (MVP)
Supabase Dashboard: Set usage alerts at 400MB DB, 800MB storage
Vercel Dashboard: Monitor bandwidth weekly
Stripe Dashboard: Track transaction volume and fees
Weekly Review: 15-minute cost check every Monday
80% Alerts: Configure email alerts when approaching limits

SECTION 2: IMPLEMENTATION PLAN
2.1 Phase 0: MVP Epics Overview
Epic #
Epic Name
Priority
Dependencies
Est. Effort
E0.1
Project Setup & Infrastructure
P0
None
1 week
E0.2
Authentication & Onboarding
P0
E0.1
1.5 weeks
E0.3
Kids Club+ Subscription
P0
E0.2
1 week
E0.4
Swap Points Core
P0
E0.3
1.5 weeks
E0.5
Listings & Marketplace
P0
E0.2, E0.4
2 weeks
E0.6
Checkout & Transactions
P0
E0.4, E0.5
1.5 weeks
E0.7
Messaging
P1
E0.2
1 week
E0.8
Safety & Moderation
P1
E0.5
1 week
E0.9
Node & Waitlist Management
P1
E0.1
0.5 weeks
E0.10
Admin Portal (Core)
P0
E0.1-E0.9
2 weeks
E0.11
Analytics & Cost Monitoring
P1
E0.10
1 week
E0.12
Testing & QA
P0
All
1.5 weeks

Total Estimated MVP Duration: 12-14 weeks (with parallel work where possible)

2.2 Post-MVP Epics Overview
Epic #
Epic Name
Priority
Notes
E1.1
App Store IAP Integration
P1
iOS/Android in-app subscriptions for compliance
E1.2
Delivery Integration
P2
Third-party (Uber Connect, DoorDash Drive)
E1.3
Direct Swaps
P2
User-to-user SP transfers (feature-flagged)
E1.4
SP Minimum Purchase Threshold
P2
Require X SP before first spend
E1.5
Boosts Using SP
P3
Pay SP to boost listing visibility
E1.6
Advanced AI Moderation
P2
Cloud AI (Rekognition) for edge cases
E1.7
Unified Cost Dashboard
P2
Single view for all service costs
E1.8
Advanced Admin Analytics
P2
Metabase/custom BI dashboards
E1.9
Node Expansion Automation
P3
Dynamic node boundaries, auto-assignment


2.3 Detailed Task Breakdown: MVP Epics

EPIC E0.1: Project Setup & Infrastructure
Goal: Establish development environment, CI/CD, and core infrastructure.
Task ID
Task
Description
Dependencies
Done Criteria
E0.1.1
Initialize React Native project
Create Expo-managed RN project with TypeScript
None
Project builds for iOS/Android
E0.1.2
Initialize Admin Web project
Create React + Vite + Tailwind + Shadcn/UI
None
Project builds, deploys to Vercel
E0.1.3
Supabase project setup
Create project, configure auth providers, RLS
None
Supabase dashboard accessible
E0.1.4
Database schema migration
Create all MVP tables with RLS policies
E0.1.3
All tables created, RLS enabled
E0.1.5
Supabase Edge Functions setup
Configure functions directory, deploy pipeline
E0.1.3
Hello world function deploys
E0.1.6
Stripe account setup
Create account, configure webhooks, test keys
None
Test payments work
E0.1.7
Twilio setup
Create account, get phone number, configure SMS
None
Test SMS sends
E0.1.8
Firebase project setup
Create project, configure Analytics + FCM
None
Test events log
E0.1.9
Cloudflare DNS + CDN
Point domain, configure SSL, caching rules
None
Domain serves via Cloudflare
E0.1.10
GitHub Actions CI/CD
Create workflows for RN, web, functions
E0.1.1-5
Automated builds on push
E0.1.11
Environment configuration
Set up .env files, secrets management
E0.1.1-9
All services connect
E0.1.12
Upstash Redis setup
Create instance, configure connection
None
Connection verified


EPIC E0.2: Authentication & Onboarding
Goal: Complete signup, phone verification, child profile, and node assignment flows.
Task ID
Task
Description
Dependencies
Done Criteria
E0.2.1
Signup screen (RN)
Email, phone, password, ZIP, subscription choice
E0.1.1
Screen renders, validates inputs
E0.2.2
Supabase Auth integration
Configure phone + email auth providers
E0.1.3, E0.1.7
Auth tokens generated
E0.2.3
Phone verification flow (RN)
SMS code entry, validation, retry logic
E0.2.1, E0.2.2
Phone verified, user created
E0.2.4
Subscription choice screen (RN)
Free vs Trial selection during onboarding
E0.2.3
Choice saved to user record
E0.2.5
Child profile setup (RN)
Name, birthdate, sizes form
E0.2.3
Child profiles saved
E0.2.6
Node assignment logic
ZIP → node lookup, waitlist if not active
E0.1.4
Users assigned correctly
E0.2.7
Waitlist screen (RN)
Show waitlist status if ZIP not active
E0.2.6
Waitlist users see messaging
E0.2.8
Login screen (RN)
Email/phone + password login
E0.2.2
Users can log in
E0.2.9
Password reset flow (RN)
Email-based password reset
E0.2.2
Password resets work
E0.2.10
Session management
JWT storage, refresh tokens, logout
E0.2.2
Sessions persist, logout works
E0.2.11
ID upload screen (RN)
Optional ID document upload for verification
E0.2.3
Docs upload to private bucket
E0.2.12
Profile screen (RN)
View/edit profile, children, verification status
E0.2.5
Profile displays correctly


EPIC E0.3: Kids Club+ Subscription

Goal: Complete subscription lifecycle: trial, billing, cancellation, grace period.
Task ID
Task
Description
Dependencies
Done Criteria
E0.3.1
Stripe customer creation
Create Stripe customer on user signup
E0.1.6, E0.2.2
Customer ID saved to user
E0.3.2
Trial start logic
Start 30-day trial when user chooses KC+
E0.3.1
Trial dates set correctly
E0.3.3
Subscription upgrade screen (RN)
Free → KC+ upgrade with payment method
E0.3.1
Payment method added
E0.3.4
Stripe subscription creation
Create subscription after trial/upgrade
E0.3.3
Stripe subscription active
E0.3.5
Subscription status sync
Webhook: subscription.updated → user status
E0.3.4
Status syncs correctly
E0.3.6
Trial reminder notifications
Push at Day 23, 28, 29 of trial
E0.3.2, E0.1.8
Notifications sent
E0.3.7
Cancellation flow (RN)
Cancel button, confirmation, immediate freeze
E0.3.4
Subscription cancelled, SP frozen
E0.3.8
Grace period logic
90-day countdown, SP freeze, expiry
E0.3.7
Grace period tracked
E0.3.9
Grace period notifications
Push at Day 60, 30, 7, 1 before expiry
E0.3.8
Notifications sent
E0.3.10
Resubscription flow (RN)
Resubscribe during grace → unfreeze SP
E0.3.7
SP unfrozen on resubscribe
E0.3.11
SP expiry job
Daily cron: expire SP after 90-day grace
E0.3.8
SP deleted after grace period
E0.3.12
Subscription status display (RN)
Show status (trial/active/cancelled) in app
E0.3.5
Status displays correctly


EPIC E0.4: Swap Points Core
Goal: SP wallet, earning, receiving, spending, pending release, ledger integrity.
Task ID
Task
Description
Dependencies
Done Criteria
E0.4.1
SP wallet creation
Create wallet when user subscribes to KC+
E0.3.2
Wallet exists for subscribers
E0.4.2
SP wallet screen (RN)
Available, pending balances, activity feed
E0.4.1
Wallet displays correctly
E0.4.3
SP calculation service
Calculate SP from price + category + config
E0.1.4
Correct SP calculated
E0.4.4
SP earning on sale
Add pending SP when sale completes
E0.4.3
Pending SP added to wallet
E0.4.5
SP receiving from buyer
Add available SP when buyer uses SP
E0.4.1
Received SP immediate
E0.4.6
SP spending at checkout
Deduct SP, validate balance, 50% cap
E0.4.1
SP deducted correctly
E0.4.7
3-day pending release job
Daily cron: release pending SP after 3 days
E0.4.4
Pending → Available after 3d
E0.4.8
SP cancellation on return
Cancel pending SP if return filed
E0.4.4
SP cancelled on return
E0.4.9
SP freeze/unfreeze logic
Freeze on cancel, unfreeze on resubscribe
E0.3.7
Freeze works correctly
E0.4.10
SP admin adjustment
Admin can add/deduct SP with reason
E0.4.1
Adjustments logged
E0.4.11
SP transaction history (RN)
List of all SP transactions with details
E0.4.2
History displays correctly
E0.4.12
SP explainer modals (RN)
"Why pending?" and other education UX
E0.4.2
Modals explain SP system


EPIC E0.5: Listings & Marketplace
Goal: Create listings, browse with swipe interface, search/filter, favorites.
Task ID
Task
Description
Dependencies
Done Criteria
E0.5.1
Photo upload (RN)
Camera/gallery access, multi-photo upload
E0.1.1
Photos upload to storage
E0.5.2
NSFW.js integration (RN)
Client-side image moderation before upload
E0.5.1
Inappropriate images blocked
E0.5.3
Listing creation form (RN)
Title, category, size, condition, price, desc
E0.5.1
Form submits correctly
E0.5.4
Payment preference selection (RN)
Cash Only / Accept SP / Donate (KC+ only)
E0.5.3
Preference saved, enforced
E0.5.5
Estimated SP display (RN)
Show "You may earn ~XX SP" on listing
E0.4.3
Estimate displays
E0.5.6
CPSC recall check
Lookup brand/category against CPSC API
E0.5.3
Recalls flagged
E0.5.7
Listing submission API
Validate, save listing, add to moderation queue
E0.5.3
Listing created
E0.5.8
Swipe browse interface (RN)
Card-based swipe (like/pass) with animations
E0.1.1
Swipe gestures work
E0.5.9
Feed algorithm
Match child profiles, distance, recency, KC+ priority
E0.5.8
Relevant items shown
E0.5.10
Early access (30 min)
KC+ users see new listings first
E0.5.9
Delay for free users
E0.5.11
Listing detail view (RN)
Photos, price, SP options, seller info, buy CTA
E0.5.8
Detail view complete
E0.5.12
Search & filters (RN)
Category, size, price, distance, condition
E0.5.8
Search returns results
E0.5.13
Favorites (RN)
Save listings, view favorites list
E0.5.11
Favorites persist
E0.5.14
Listing edit (RN)
Edit before buyer contact, limited after
E0.5.7
Edit restrictions enforced
E0.5.15
Listing expiration job
90-day expiry, 7-day reminder
E0.5.7
Listings expire correctly


EPIC E0.6: Checkout & Transactions
Goal: Complete purchase flow with SP + cash, fees, seller notifications, completion.
Task ID
Task
Description
Dependencies
Done Criteria
E0.6.1
Checkout screen (RN)
Item summary, SP slider, payment method, totals
E0.5.11, E0.4.6
Checkout renders correctly
E0.6.2
SP slider component (RN)
Drag to select SP amount (0 to 50% of price)
E0.6.1
Slider updates totals
E0.6.3
Fee calculation service
Calculate buyer fee ($0.99/$2.99), seller fee (5%)
E0.6.1
Fees calculated correctly
E0.6.4
Stripe Payment Intent
Create payment intent for cash portion + fees
E0.6.3
Payment intent created
E0.6.5
Payment confirmation
Confirm payment, deduct SP, create transaction
E0.6.4
Transaction recorded
E0.6.6
Seller notification
Push + in-app: "Your item sold!" with breakdown
E0.6.5
Notification sent
E0.6.7
Buyer confirmation screen (RN)
Order summary, next steps, message seller CTA
E0.6.5
Confirmation displays
E0.6.8
Transaction status tracking
Pending → Completed states, pickup coordination
E0.6.5
Status updates correctly
E0.6.9
Buyer confirms receipt
Button to confirm item received, release funds
E0.6.8
Confirmation triggers release
E0.6.10
Seller payout
Transfer cash to seller's bank (minus 5% fee)
E0.6.9
Payout processed
E0.6.11
Return request flow
Buyer can request return within 3 days
E0.6.9
Return request created
E0.6.12
Return processing
Refund cash + SP to buyer, cancel seller pending SP
E0.6.11
Return completed
E0.6.13
Transaction history (RN)
List of all user's transactions (buyer + seller)
E0.6.5
History displays


EPIC E0.7: Messaging
Goal: Real-time chat between buyers and sellers with privacy protection.
Task ID
Task
Description
Dependencies
Done Criteria
E0.7.1
Messages table + RLS
Create messages table with conversation scoping
E0.1.4
Table created with RLS
E0.7.2
Supabase Realtime channels
Set up realtime subscription for chat
E0.7.1
Messages sync in real-time
E0.7.3
Chat list screen (RN)
List of all conversations with last message
E0.7.1
Chat list displays
E0.7.4
Chat thread screen (RN)
Message bubbles, input, send button
E0.7.2
Messages send/receive
E0.7.5
Contact info detection
Block phone/email in messages
E0.7.4
Contact info blocked
E0.7.6
Push notifications for messages
FCM notification on new message
E0.7.4
Push notifications work
E0.7.7
Unread badge
Show unread count on tab bar
E0.7.3
Badge updates correctly
E0.7.8
Message from listing (RN)
"Message Seller" button on listing detail
E0.7.4
Conversation starts


EPIC E0.8: Safety & Moderation
Goal: Content moderation, CPSC checks, reporting, manual review queue.
Task ID
Task
Description
Dependencies
Done Criteria
E0.8.1
Moderation queue table
Create queue with status, flags, admin notes
E0.1.4
Table created
E0.8.2
Auto-queue new listings
First 3 listings from new sellers → queue
E0.5.7
Listings queued correctly
E0.8.3
Flag high-value listings
Listings >$200 → auto-queue
E0.5.7
High-value flagged
E0.8.4
CPSC recall flagging
CPSC match → add to queue with warning
E0.5.6
Recalls flagged
E0.8.5
Report listing (RN)
User can report listing with reason
E0.5.11
Report created
E0.8.6
Report user (RN)
User can report another user
E0.2.12
Report created
E0.8.7
Admin moderation queue (Web)
List of pending items with actions
E0.8.1
Queue displays in admin
E0.8.8
Admin approve/reject
Approve (publish) or reject (notify seller)
E0.8.7
Actions work correctly
E0.8.9
User suspension logic
Suspend users for violations
E0.8.7
Suspended users blocked
E0.8.10
Audit log
Log all moderation actions
E0.8.8
Audit trail created


EPIC E0.9: Node & Waitlist Management
Goal: Geographic node configuration, ZIP mapping, waitlist management.
Task ID
Task
Description
Dependencies
Done Criteria
E0.9.1
Seed initial nodes
Create Norwalk CT + Little Falls NJ nodes
E0.1.4
Nodes exist in DB
E0.9.2
Seed ZIP codes
Map ZIP codes to nodes
E0.9.1
ZIPs mapped correctly
E0.9.3
Admin node management (Web)
Create/edit nodes, add ZIPs
E0.9.1
Admin can manage nodes
E0.9.4
Waitlist signup API
Add email/phone/ZIP to waitlist
E0.1.4
Waitlist entries created
E0.9.5
Admin waitlist view (Web)
View waitlist by ZIP, send launch notifications
E0.9.4
Waitlist visible in admin
E0.9.6
Node launch notification
Email waitlist when node goes active
E0.9.5
Notifications sent


EPIC E0.10: Admin Portal (Core)

Goal: Web admin portal for configuration, moderation, user management, analytics.
Task ID
Task
Description
Dependencies
Done Criteria
E0.10.1
Admin auth (Firebase SSO)
Admin login with Firebase Auth, role check
E0.1.8
Admins can log in
E0.10.2
Admin dashboard layout
Sidebar nav, header, main content area
E0.1.2
Layout renders
E0.10.3
SP configuration screen
Formula type, percentages, multipliers, preview
E0.4.3
Config saves correctly
E0.10.4
User management screen
Search users, view details, suspend, adjust SP
E0.2.2
User management works
E0.10.5
Moderation queue screen
(From E0.8.7)
E0.8.7
Queue integrated
E0.10.6
Node management screen
(From E0.9.3)
E0.9.3
Nodes integrated
E0.10.7
Transaction overview screen
List recent transactions, filter, search
E0.6.5
Transactions visible
E0.10.8
Feature flags screen
Toggle features (direct swaps, etc.)
E0.1.4
Flags toggle correctly
E0.10.9
Audit log viewer
View all admin actions
E0.8.10
Audit log visible
E0.10.10
Export data (CSV)
Export users, transactions, SP data
E0.10.7
CSV downloads


EPIC E0.11: Analytics & Cost Monitoring
Goal: Firebase Analytics setup, admin dashboards, cost alerts.
Task ID
Task
Description
Dependencies
Done Criteria
E0.11.1
Firebase Analytics events
Track key events (signup, listing, purchase, SP)
E0.1.8
Events appear in Firebase
E0.11.2
User properties
Set subscription type, node, SP balance
E0.11.1
Properties tracked
E0.11.3
Conversion funnels
Signup → Trial → Paid, Browse → Purchase
E0.11.1
Funnels visible
E0.11.4
Admin analytics dashboard
Key metrics: MAU, subscribers, GMV, SP circulation
E0.10.2
Dashboard displays
E0.11.5
SP health metrics
Circulation rate, avg balance, hoarding alerts
E0.11.4
SP metrics visible
E0.11.6
Cost monitoring alerts
Configure Supabase, Vercel, Stripe alerts at 80%
E0.1.3
Alerts configured
E0.11.7
Weekly cost review checklist
Document manual review process
E0.11.6
Checklist created


EPIC E0.12: Testing & QA
Goal: Comprehensive testing before launch.
Task ID
Task
Description
Dependencies
Done Criteria
E0.12.1
Unit tests: SP calculation
Test all formula types, edge cases
E0.4.3
90%+ coverage
E0.12.2
Unit tests: Fee calculation
Test all user types, SP splits
E0.6.3
90%+ coverage
E0.12.3
Integration tests: Stripe
Test subscription lifecycle, payments
E0.3.4, E0.6.4
All flows work
E0.12.4
Integration tests: Auth
Test signup, login, verification
E0.2.2
All flows work
E0.12.5
E2E test: Free user journey
Signup → Browse → Buy → Rate
All
Flow completes
E0.12.6
E2E test: Subscriber journey
Trial → List → Sell → Earn SP → Spend SP
All
Flow completes
E0.12.7
E2E test: Admin journey
Login → Moderate → Adjust SP → Config
All
Flow completes
E0.12.8
Performance testing
Load test 100 concurrent users
All
Targets met
E0.12.9
Security review
RLS policies, auth, data exposure
All
No vulnerabilities
E0.12.10
Manual QA
Test on iOS + Android devices
All
No critical bugs


2.4 Suggested Sequencing (Gantt-Style)


Week 1-2:   [E0.1 Infrastructure ███████████████████████████████████]
Week 2-3:   [E0.2 Auth & Onboarding      ████████████████████████████████████████]
Week 3-4:                                [E0.3 Subscription  ████████████████████████]
Week 4-5:                                [E0.9 Nodes ████████]
Week 4-6:                                         [E0.4 SP Core  ████████████████████████████████]
Week 5-7:                                                  [E0.5 Listings  ████████████████████████████████████████████]
Week 7-8:                                                                   [E0.7 Messaging  ████████████████████]
Week 7-8:                                                                   [E0.8 Moderation  ████████████████████]
Week 8-9:                                                                            [E0.6 Checkout  ████████████████████████████████]
Week 9-11:                                                                                    [E0.10 Admin Portal  ████████████████████████████████████████████]
Week 11-12:                                                                                                     [E0.11 Analytics  ████████████████████]
Week 12-14:                                                                                                              [E0.12 Testing  ████████████████████████████████]

SECTION 2.5: Post-MVP Epic Details
Epic E1.1: App Store IAP Integration
Goal: Implement iOS/Android in-app purchase subscriptions for App Store compliance.
Priority: P1 (implement if Stripe-only approach causes app rejection)
Task ID
Task
Description
Dependencies
Done Criteria
E1.1.1
Research App Store guidelines
Confirm physical goods marketplace exemption
None
Legal/compliance sign-off
E1.1.2
iOS StoreKit integration
Implement StoreKit 2 for subscriptions
E0.3.4
iOS IAP works
E1.1.3
Android Billing Library
Implement Google Play Billing
E0.3.4
Android IAP works
E1.1.4
Receipt validation server
Server-side receipt validation for both platforms
E1.1.2, E1.1.3
Receipts validated
E1.1.5
Subscription sync logic
Sync IAP status with Supabase user record
E1.1.4
Status syncs correctly
E1.1.6
Dual billing support
Support both Stripe (web) and IAP (mobile)
E1.1.5
Both methods work
E1.1.7
Revenue reconciliation
Track 30% App Store cut in analytics
E1.1.6
Revenue tracked correctly

Cost Impact: 15-30% revenue reduction on mobile subscriptions (Apple/Google cut)

Epic E1.2: Delivery Integration
Goal: Enable platform-coordinated delivery via third-party providers.
Priority: P2
Task ID
Task
Description
Dependencies
Done Criteria
E1.2.1
Delivery provider research
Evaluate Uber Connect, DoorDash Drive, Roadie
None
Provider selected
E1.2.2
Provider API integration
Integrate selected provider's API
E1.2.1
API calls work
E1.2.3
Delivery option in checkout
Add delivery method selection with $10 fee
E0.6.1
Delivery selectable
E1.2.4
Address collection
Collect/validate delivery address
E1.2.3
Addresses saved
E1.2.5
Delivery tracking (RN)
Show delivery status in transaction detail
E1.2.2
Tracking displays
E1.2.6
Delivery notifications
Push updates for pickup, in-transit, delivered
E1.2.5
Notifications sent
E1.2.7
Delivery analytics
Track delivery usage, success rate, costs
E1.2.6
Metrics visible
E1.2.8
Seller delivery preferences
Sellers can enable/disable delivery per listing
E1.2.3
Preference saved


Epic E1.3: Direct Swaps (Feature-Flagged)
Goal: Enable user-to-user SP transfers for direct item swaps.
Priority: P2
Task ID
Task
Description
Dependencies
Done Criteria
E1.3.1
Feature flag setup
Create direct_swaps_enabled flag per node
E0.10.8
Flag toggleable
E1.3.2
Swap request flow (RN)
User A proposes swap: their item for User B's item
E1.3.1
Request created
E1.3.3
Swap acceptance flow (RN)
User B accepts/rejects swap proposal
E1.3.2
Acceptance works
E1.3.4
SP transfer logic
Transfer SP between users (ledger entries)
E1.3.3
SP transfers correctly
E1.3.5
Swap value balancing
If items differ in value, calculate SP difference
E1.3.4
Balance calculated
E1.3.6
Swap completion
Both parties confirm receipt, finalize swap
E1.3.5
Swap completes
E1.3.7
Swap history (RN)
View past swaps in transaction history
E1.3.6
History displays
E1.3.8
Admin swap monitoring
View swap activity, flag suspicious patterns
E1.3.7
Admin visibility


Epic E1.4: SP Minimum Purchase Threshold
Goal: Require users to accumulate minimum SP before first spend.
Priority: P2
Task ID
Task
Description
Dependencies
Done Criteria
E1.4.1
Threshold configuration
Admin sets minimum SP to unlock spending (e.g., 25 SP)
E0.10.3
Config saves
E1.4.2
Spending eligibility check
Validate user has reached threshold before first spend
E1.4.1
Check enforced
E1.4.3
Progress indicator (RN)
Show progress to unlock: "15/25 SP to unlock spending"
E1.4.2
Progress displays
E1.4.4
Unlock notification
Notify when threshold reached
E1.4.3
Notification sent
E1.4.5
Bypass for returning users
Users who previously spent don't need threshold again
E1.4.2
Bypass works


Epic E1.5: Boosts Using SP
Goal: Allow users to pay SP for enhanced listing visibility.
Priority: P3
Task ID
Task
Description
Dependencies
Done Criteria
E1.5.1
Boost product design
Define boost tiers (24h, 3 days, 7 days) and SP costs
None
Design documented
E1.5.2
Boost purchase flow (RN)
Buy boost for listing using SP
E1.5.1
Boost purchased
E1.5.3
Feed algorithm update
Prioritize boosted listings in feed
E1.5.2
Boosted items shown first
E1.5.4
Boost indicator (RN)
Show "Boosted" badge on listing
E1.5.3
Badge displays
E1.5.5
Boost expiration
Auto-expire boost after duration
E1.5.2
Expiration works
E1.5.6
Boost analytics
Track boost purchases, effectiveness
E1.5.5
Metrics visible


Epic E1.6: Advanced AI Moderation
Goal: Cloud-based AI for edge cases and enhanced detection.
Priority: P2
Task ID
Task
Description
Dependencies
Done Criteria
E1.6.1
Cloud AI provider selection
Evaluate AWS Rekognition vs Google Vision vs Clarifai
None
Provider selected
E1.6.2
Cloud AI integration
Send flagged images to cloud AI for secondary review
E1.6.1
API integration works
E1.6.3
Confidence threshold tuning
Tune thresholds for auto-approve/reject/queue
E1.6.2
Thresholds optimized
E1.6.4
Brand detection enhancement
Use cloud AI for better brand recognition
E1.6.2
Brand detection improved
E1.6.5
Condition assessment
AI-assisted condition grading
E1.6.2
Condition suggestions
E1.6.6
Cost monitoring
Track AI API costs, set budget alerts
E1.6.2
Costs tracked

Cost Impact: ~$50-100/month at scale (5K users)

Epic E1.7: Unified Cost Dashboard
Goal: Single admin view for all service costs and projections.
Priority: P2
Task ID
Task
Description
Dependencies
Done Criteria
E1.7.1
Cost data aggregation
Pull usage data from Supabase, Vercel, Stripe, Twilio
E0.11.6
Data collected
E1.7.2
Cost dashboard UI (Web)
Display current month costs by service
E1.7.1
Dashboard displays
E1.7.3
Cost projections
Project next month based on growth trends
E1.7.2
Projections shown
E1.7.4
Free tier warnings
Highlight services approaching free tier limits
E1.7.2
Warnings visible
E1.7.5
Cost alerts configuration
Configure alert thresholds per service
E1.7.4
Alerts configurable
E1.7.6
Historical cost trends
Show cost trends over time
E1.7.2
Trends visible
E1.7.7
Cost per user metrics
Calculate cost/user, cost/transaction
E1.7.2
Metrics calculated


Epic E1.8: Advanced Admin Analytics
Goal: Comprehensive BI dashboards for business metrics.
Priority: P2
Task ID
Task
Description
Dependencies
Done Criteria
E1.8.1
Metabase/Retool setup
Deploy open-source BI tool connected to Supabase
E0.11.4
Tool deployed
E1.8.2
Unit economics dashboard
LTV, CAC, LTV:CAC ratio by cohort
E1.8.1
Metrics visible
E1.8.3
Cohort analysis
Retention curves by signup month
E1.8.2
Cohorts displayed
E1.8.4
Node performance dashboard
Compare metrics across nodes
E1.8.1
Node comparison
E1.8.5
SP system health dashboard
Circulation, velocity, hoarding indicators
E1.8.1
SP health visible
E1.8.6
Subscription funnel dashboard
Trial → Paid conversion, churn analysis
E1.8.1
Funnel visible
E1.8.7
Automated reports
Weekly email with key metrics
E1.8.6
Reports sent
E1.8.8
Custom query interface
Run ad-hoc SQL queries
E1.8.1
Queries work


Epic E1.9: Node Expansion Automation
Goal: Streamline launching new geographic nodes.
Priority: P3
Task ID
Task
Description
Dependencies
Done Criteria
E1.9.1
Node launch checklist
Automated checklist for new node requirements
E0.9.3
Checklist created
E1.9.2
ZIP code bulk import
Upload CSV of ZIP codes for new node
E1.9.1
Bulk import works
E1.9.3
Waitlist auto-notification
Auto-email waitlist when node launches
E1.9.2
Notifications sent
E1.9.4
Dynamic node boundaries
Expand/contract node ZIP coverage based on demand
E1.9.2
Boundaries adjustable
E1.9.5
Node health scoring
Calculate node health based on activity metrics
E1.9.4
Health scores visible
E1.9.6
Cross-node visibility
Allow browsing adjacent nodes (read-only)
E1.9.5
Cross-node browse works
E1.9.7
Node merge capability
Merge underperforming nodes
E1.9.6
Merge works



SECTION 3: RISKS, TRADE-OFFS & RECOMMENDATIONS
3.1 Major Architectural Risks
Risk
Likelihood
Impact
Mitigation
Owner
Supabase free tier exceeded early
Medium
High
Monitor weekly, set alerts at 80%, have Pro upgrade ready
Founder
Stripe-only billing rejected by App Stores
Low
Critical
Have IAP implementation ready (E1.1), research exemption thoroughly
Founder
SP ledger integrity issues
Low
Critical
Append-only design, checksums, daily reconciliation job
Backend
NSFW.js client-side bypass
Medium
Medium
Server-side revalidation for flagged content, human review queue
Backend
Twilio costs spike from SMS abuse
Medium
Medium
Rate limiting, CAPTCHA for repeat requests, monitor daily
Backend
React Native Expo limitations
Low
Medium
Expo has good coverage; eject to bare workflow if needed
Mobile
Supabase Realtime performance
Low
Medium
Optimize channel subscriptions, consider dedicated Redis for scale
Backend
Single region (US East) latency
Low
Low
Acceptable for CT/NJ users; add regions post-MVP if expanding
Infra

3.2 Business Risks
Risk
Likelihood
Impact
Mitigation
Low free→paid conversion (<20%)
Medium
High
A/B test pricing, extend trial, strengthen SP value messaging
SP hoarding (circulation <40%)
Medium
High
Consider SP expiration, flash sales, spending incentives
High subscriber churn (>15%/mo)
Medium
Critical
Exit surveys, winback campaigns, pause subscription option
SP confusion driving support tickets
Medium
Medium
Interactive onboarding, in-app education, video tutorials
Insufficient listings (supply)
Medium
High
Seed marketplace with founder listings, referral bonuses for sellers
Insufficient buyers (demand)
Medium
High
Marketing focus on buyers, "window shopping" for waitlist users
Fraud: sell→buy→return loops
Medium
High
3-day pending, pattern detection, manual review, bans

3.3 Technical Trade-offs Made
Decision
Trade-off
Rationale
Supabase Edge Functions vs. separate Node.js server
Less flexibility, cold starts
Zero additional infra, stays in free tier, faster MVP
Expo managed vs. bare React Native
Some native limitations
Faster development, OTA updates, easier for solo dev
NSFW.js client-side vs. cloud AI
Lower accuracy, bypassable
Zero cost, good enough for MVP, add cloud AI post-MVP
Supabase Storage vs. Cloudflare R2
Slightly higher bandwidth cost
Simpler integration, single vendor, switch later if needed
Firebase Analytics vs. self-hosted
Google dependency
Free, mobile-first, good enough for MVP analytics
Single region vs. multi-region
Higher latency for non-US users
All MVP users in CT/NJ, add regions only when expanding
Manual ID verification vs. automated
Slower, admin burden
Zero cost, builds trust through human review

3.4 Recommendations
Immediate (Before Development)
Legal Review: Get legal sign-off on SP structure (closed-loop, no money transmission)
App Store Consultation: Pre-submit inquiry to Apple about external billing for physical goods marketplace
Figma Export: Extract components from Figma Make to accelerate frontend development
Domain & Brand: Secure domain, set up Cloudflare, configure SSL
During MVP Development
Weekly Cost Check: 15-minute review every Monday of Supabase, Twilio, Stripe usage
Early User Testing: Get 5-10 parents to test key flows every 2 weeks
SP Formula Testing: Simulate SP circulation with test data before launch
Seed Content: Prepare 50+ listings to seed marketplace at launch
Launch Preparation
Soft Launch: Invite 50 users from waitlist for 2-week beta
Support Playbook: Document common issues and responses
Monitoring Setup: Ensure all alerts configured before public launch
Rollback Plan: Document how to roll back database migrations if critical issues
Post-Launch
Daily Metrics Review: First 30 days, review key metrics daily
User Interviews: Talk to 5 users per week about their experience
SP Health Monitoring: Watch circulation rate closely, intervene if <40%
Cost Scaling Plan: Have Supabase Pro upgrade ready when approaching limits

Final Notes
Thank you for the answers. Here's the updated status:
Question
Answer
Impact
Q4.1.1 Figma Make
Placeholder - will share before dev starts
✅ No problem. We'll build component architecture that can integrate Figma exports. I'll design with standard patterns (Tailwind, NativeWind) so Figma components slot in easily.
Q4.2.1 Stripe
Option B - New account needed
Add 2-3 days to E0.1 for Stripe account creation and verification
Q4.3.1 Apple Developer
Option B - Need to enroll
Add 2-3 days for Apple Developer enrollment. Can start Android testing immediately while waiting.
Q4.4.1 Domain/Email
Option C - No domain yet
Add task to E0.1: Register domain, configure Cloudflare DNS, set up Resend for transactional email
Q4.5.1 ZIP codes
Norwalk 06850-06856, Little Falls 07424 + surrounding
Will seed these in E0.9
Q4.6.1 Seed users
Both: founder accounts + real family/friends
Will create admin script for founder accounts in E0.1


Updated E0.1 Tasks (Infrastructure)
Adding these tasks based on your answers:
Task ID
Task
Description
Est. Time
E0.1.13
Register domain
Purchase domain, configure Cloudflare DNS + SSL
1 hour
E0.1.14
Resend email setup
Create Resend account, configure domain verification, set up transactional templates
2 hours
E0.1.15
Stripe account creation
Create Stripe account, complete business verification, configure webhook endpoints
2-3 days (verification wait)
E0.1.16
Apple Developer enrollment
Enroll in Apple Developer Program ($99), wait for approval
1-2 days (approval wait)
E0.1.17
Founder account seeding script
Create admin script to generate test accounts with free KC+
2 hours

Net timeline impact: +3-4 days to E0.1 (due to Stripe/Apple verification wait times, but these run in parallel)

Pre-Development Checklist
Before starting E0.1, please complete:
 Domain: Choose and register domain name
 Stripe: Start account creation at stripe.com (business verification takes 2-3 days)
 Apple Developer: Enroll at developer.apple.com ($99/year)
 Figma Make: Share access when ready (placeholder for now is fine)
 Google Play Console: Create account ($25 one-time) for Android
 Supabase: Create account at supabase.com (free, instant)
 Vercel: Create account at vercel.com (free, instant)
 Firebase: Create project at firebase.google.com (free, instant)
 Twilio: Create account at twilio.com (get phone number for SMS)
 GitHub: Create repository for the project
 Cloudflare: Create account at cloudflare.com (free, instant)
 Resend: Create account at resend.com (free tier: 3,000 emails/month)
Ready to Proceed
Would you like me to:
Create a markdown document with this complete plan saved to your workspace?
Generate the initial database migration SQL for Supabase (all MVP tables with RLS policies)?
Scaffold the React Native project with Expo, NativeWind, navigation structure?
Scaffold the Admin Web project with React, Vite, Tailwind, Shadcn/UI?
Create a GitHub project board template with all epics and tasks?


