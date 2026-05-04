# App Overview: Pass It Up
**Kids P2P Marketplace for Used Items**  
**Date**: May 4, 2026  
**Version**: 1.0 (UX Redesign Foundation)

---

## 1. What is Pass It Up?

**Pass It Up** is a peer-to-peer marketplace mobile app designed exclusively for parents to buy and sell **gently used kids' items**. Built with React Native and Expo, the app creates a trusted, local community where parents can quickly declutter outgrown clothes, toys, gear, and books while helping other families save money on quality children's items.

### Core Concept
Kids outgrow everything fast. Pass It Up makes it easy to **pass items up** to the next family who needs them—turning clutter into cash for sellers and savings for buyers.

### Platform
- **Mobile-First**: iOS and Android via React Native Expo
- **Backend**: Supabase (production only)
- **Geographic Model**: Node-based local marketplaces (ZIP code communities)

---

## 2. Target Users

### Primary Audience
**Busy Parents** (ages 25-45) with children ages 0-12 who:
- Have limited time between work, childcare, and household management
- Are budget-conscious and sustainability-minded
- Want a faster, safer alternative to garage sales and generic marketplaces
- Prefer local pickup to avoid shipping hassle
- Value community trust and safety (kid-specific marketplace)

### User Motivations

**Sellers:**
- Declutter quickly without the hassle of garage sales
- Recoup some value from expensive kids' items
- Help other parents in their community
- Free up space as kids outgrow items

**Buyers:**
- Save money on quality kids' items (clothes, toys, gear)
- Find specific items locally without shipping wait times
- Support sustainability (reuse vs. buy new)
- Trust kid-focused marketplace over generic platforms

---

## 3. Core Value Proposition

### For Sellers
**"Turn outgrown items into cash in minutes—not weekends."**

- **Photo-first listing**: Snap photo → auto-fill details → publish (under 60 seconds)
- **Bulk listing tools**: Upload multiple items at once
- **Instant local visibility**: Items shown to nearby parents immediately
- **Swap Points currency**: Earn platform credits to buy without spending cash
- **Safe transactions**: In-app messaging, payment, and safety checks

### For Buyers
**"Find quality kids' items locally—save money, skip shipping."**

- **Local discovery**: Search by ZIP/radius for pickup convenience
- **Trusted safety**: CPSC recall checks, AI image moderation, ID verification
- **Swap Points savings**: Use platform credits to cover 30-70% of item price (can spend even without subscription)
- **Secure payments**: Stripe integration with buyer protection
- **Community trust**: Verified sellers, ratings, and reviews

### Platform Differentiation
Unlike generic marketplaces (Facebook Marketplace, Craigslist), Pass It Up offers:
1. **Kid-specific safety**: CPSC recall matching, age-appropriate categories
2. **Gamified currency**: Swap Points reward active community members
3. **Hyper-local nodes**: ZIP-based communities for fast pickup
4. **Parent-friendly UX**: Designed for time-strapped parents (quick listing, messaging, checkout)

---

## 4. Business Model

### Revenue Streams

#### 4.1 Subscription Tiers (Primary Revenue)
Pass It Up operates on a **freemium subscription model** with three tiers:

**Free Tier (Trial)**:
- 30-day free trial for new users
- Full access to buying and selling
- **Can earn AND spend Swap Points** during trial
- 90-day grace period after trial (access continues, gentle nudges to upgrade)

**Kids Club Membership** (Paid Tier):
- **Price**: $9.99/month or $99/year (admin-configurable)
- **Benefits**:
  - Lower transaction fees (e.g., 5% vs. 8% for non-members)
  - **Swap Points earning enabled** (earn SP on all sales)
  - Priority listing visibility
  - Bulk listing tools
  - Advanced search filters
  - Early access to new features

**Free (Post-Grace)**:
- Access continues with higher transaction fees
- **Can spend existing SP but CANNOT earn new SP** (earning disabled until subscription active)
- Limited features (no bulk tools, higher fees)

#### 4.2 Transaction Fees (Secondary Revenue)
- **Buyer Fee**: 5-8% of item price (tier-dependent, admin-configurable via `admin_config`)
- **Applied**: At checkout (separate from item price)
- **Rationale**: Covers payment processing, platform maintenance, safety features

#### 4.3 Swap Points (SP) Currency System
**SP is NOT a revenue driver**—it's a **retention and engagement tool**.

**How It Works**:
- Sellers earn SP when items sell (e.g., 10% of sale price in SP) **IF they have an active subscription**
- Buyers can spend SP to cover a portion of next purchase (30-70% configurable by admin)
- SP has no cash value (cannot be withdrawn)
- Encourages circular marketplace activity (sell → earn SP → buy → sell)

**SP Rules**:
- **Earning requirement**: Users MUST maintain active subscription (trial or paid) to earn SP on sales
- **Spending rules**: Users can spend existing SP even after subscription ends (no earning, but can spend balance)
- **Spend cap**: 30-70% of item price (admin-configurable via `admin_config`), buyer must pay remaining % in cash + fees
- Pending SP releases when buyer confirms item received
- Platform fees always paid in cash (never SP)

---

## 5. User Personas

### Persona 1: "Busy Mom Sarah" (Power Seller)
**Demographics**:
- Age: 32, married, 2 kids (ages 3 and 6)
- Works part-time remotely
- Lives in suburban ZIP node

**Goals**:
- Declutter kids' rooms every season
- Recoup value from expensive baby gear
- Fund next-size-up clothing without guilt

**Pain Points**:
- No time for garage sales or meetups
- Frustrated with generic marketplaces (scams, no-shows)
- Shipping kids' items is expensive and time-consuming

**Pass It Up Fit**:
- Photo-first listing: Creates listings during kids' nap time
- Bulk tools: Uploads entire outgrown wardrobe at once
- Local pickup: Buyers pick up from porch (no meetup needed)
- SP earnings: Uses credits to buy next-size clothes

**Quote**: *"I listed 15 items during nap time and sold half by bedtime. The SP credits mean I can buy without asking my husband first!"*

---

### Persona 2: "Budget-Conscious Dad Mike" (Active Buyer)
**Demographics**:
- Age: 38, married, 3 kids (ages 1, 4, 7)
- Single-income household
- Lives in urban ZIP node

**Goals**:
- Save money on quality kids' items
- Find specific items locally (no shipping wait)
- Avoid overpaying for items kids will outgrow

**Pain Points**:
- Kids need constant new sizes/toys/gear
- New items too expensive
- Generic marketplaces feel unsafe for kids' stuff

**Pass It Up Fit**:
- Local search: Finds items within 10-mile radius
- Safety features: Trusts CPSC recall checks and verified sellers
- SP savings: 30-70% off next purchase with earned credits (even after subscription ends)
- Fast checkout: In-app payment, no cash meetups

**Quote**: *"I found a barely-used bike for my son at half the price. Picked it up same day. Way better than driving to stores or waiting for shipping."*

---

### Persona 3: "First-Time Mom Emma" (New User)
**Demographics**:
- Age: 28, first-time mom, baby (6 months)
- On maternity leave
- Lives in suburban ZIP node

**Goals**:
- Afford quality baby gear on tight budget
- Sell outgrown newborn items to fund next sizes
- Connect with local parent community

**Pain Points**:
- Overwhelmed by baby expenses
- Unsure where to safely sell/buy used baby items
- Hesitant about generic marketplace safety

**Pass It Up Fit**:
- Onboarding education: Trading tutorial explains SP, safety, fees
- Safety trust: ID verification, CPSC recall checks reassure new parent
- Community feel: Node-based marketplace feels local and trusted
- Free trial: 30 days to test before committing to membership

**Quote**: *"As a new mom, I love that I can sell outgrown onesies and use the credits for the next size. The safety checks make me feel confident buying used."*

---

## 6. "Pass It Up" Branding

### Name Origin
**"Pass It Up"** embodies the circular marketplace concept:
- Kids **pass up** to the next size/stage
- Parents **pass items up** to the next family who needs them
- Community members **pass value up** through the ecosystem

### Brand Personality
- **Friendly**: Warm, approachable, parent-to-parent tone
- **Efficient**: Respects parents' limited time (quick flows, minimal friction)
- **Trustworthy**: Safety-first, transparent fees, verified community
- **Sustainable**: Reuse > waste, good for planet and wallet
- **Empowering**: Helps parents feel smart about money and decluttering

### Tagline Options (for Figma team consideration)
1. *"Pass it up. Save money. Help parents."*
2. *"Turn outgrown into opportunity."*
3. *"Kids outgrow it. Parents pass it up."*
4. *"Your local kids' marketplace."*

### Visual Direction (Samsung Food-inspired)
- **Clean, modern interface**: Minimal clutter, clear hierarchy
- **Photography**: User-generated content (authentic used items)
- **Colors**: Warm, approachable palette (see design-system.md)
- **Typography**: Friendly sans-serif, highly legible
- **Iconography**: Custom, parent-friendly icons

---

## 7. Key Differentiators (Competitive Advantage)

### vs. Facebook Marketplace / Craigslist
- ✅ **Kid-specific safety**: CPSC recall checks, age categories
- ✅ **In-app payment**: No cash meetups, Stripe protection
- ✅ **Verified community**: ID badges, ratings, reviews
- ✅ **Swap Points**: Gamified currency for repeat engagement

### vs. Poshmark Kids / Mercari
- ✅ **Local pickup**: No shipping costs or wait times
- ✅ **Hyper-local**: ZIP-based nodes for neighborhood trust
- ✅ **Photo-first listing**: Under 60 seconds (vs. manual forms)
- ✅ **Community-driven**: Parent-to-parent vs. reseller-heavy

### vs. Once Upon A Child / Kid-to-Kid (Retail Consignment)
- ✅ **Higher seller payouts**: 50-90% of sale price (vs. 30-40% consignment)
- ✅ **No dropoff hassle**: List from home, buyers pick up
- ✅ **Instant cash**: Payouts on transaction (vs. waiting for consignment sale)
- ✅ **Digital-first**: App convenience vs. physical store visits

---

## 8. Success Metrics (Post-Launch)

### User Acquisition
- New signups per node (ZIP code)
- Trial-to-paid conversion rate
- Referral code usage

### Engagement
- Listings per user per month
- Buyer search frequency
- SP earn/spend ratio
- Repeat transaction rate

### Revenue
- Monthly recurring revenue (MRR) from subscriptions
- Transaction fee revenue
- Average order value (AOV)
- Churn rate (grace period effectiveness)

### Community Health
- Average rating (buyers + sellers)
- Response time in messaging
- Completed trades per user
- CPSC recall match rate (safety effectiveness)

---

## 9. Technical Foundation (For UX Context)

### Architecture
- **Frontend**: React Native Expo (iOS + Android)
- **Backend**: Supabase (auth, database, storage, edge functions)
- **Payments**: Stripe (checkout + seller payouts)
- **Safety**: CPSC recall API, Google Vision AI moderation
- **Messaging**: Supabase Realtime
- **Testing**: Jest (unit), Maestro (UI flows), E2E (Supabase integration)

### Key Flows (from flow-registry.md)
1. **FLOW-01**: Auth (signup, login, social OAuth, phone verification)
2. **FLOW-02**: Onboarding (profile setup, node selection, subscription choice)
3. **FLOW-04**: Listings (photo-first create, bulk tools, edit, safety review)
4. **FLOW-06**: Discovery (search, filters, favorites, recommendations)
5. **FLOW-07**: Cart & Bundling (multi-item checkout) ← **NEW for MVP**
6. **FLOW-08**: Trading (checkout, payment, two-step completion)
7. **FLOW-10/11**: Swap Points (wallet, earn/spend, ledger)
8. **FLOW-12**: Subscriptions (purchase, cancel, grace period)
9. **FLOW-14**: Messaging (realtime chat between buyer/seller)

### Platform Constraints
- **No NativeBase**: Disabled due to iOS runtime error (custom design system required)
- **Icons**: Ionicons (current), moving to custom icon set
- **Typography**: System fonts (current), to be specified in design system
- **Testing**: iOS + Android simulators only (no physical devices)

---

## 10. Design Goals for Redesign

### Primary Objectives
1. **Professional polish**: Elevate from MVP to market-ready
2. **Samsung Food aesthetic**: Clean, modern, approachable (warm colors, clear hierarchy)
3. **Parent-friendly UX**: Reduce friction in listing, searching, checkout
4. **Brand identity**: Establish "Pass It Up" visual language
5. **Consistency**: Unified design system across all 70+ screens

### Success Criteria
- Listing creation time: <60 seconds (photo → publish)
- Search-to-checkout: <3 taps for experienced users
- Visual polish: Market-competitive with Poshmark, Mercari
- Accessibility: WCAG AA compliance for parent inclusivity
- Performance: Smooth 60fps animations, instant feedback

---

## 11. Next Steps (Redesign Workflow)

### Phase 1: Design Foundation (Current)
- ✅ **Phase 0**: Codebase audit (complete)
- 🔄 **Document 1**: App Overview (this document) ← **Review & Approve**
- ⏳ **Document 2**: Design System (colors, typography, components)
- ⏳ **Document 3**: Screen-to-Flow Mapping (technical guide)
- ⏳ **Document 4**: Figma Agent Prompts (copy-paste ready)
- ⏳ **Document 5**: Implementation Guide (Figma MCP setup)

### Phase 2: Figma Design Execution
- Flow-by-flow screen designs using Figma Make
- Iteration based on user feedback
- Design system component library
- Prototype for user testing

### Phase 3: Implementation
- Update screens per Figma designs
- Update Maestro UI tests
- Backend: Implement Cart flow (FLOW-07)
- Testing: Unit + E2E + Maestro regression

---

**Document Status**: Draft for User Review  
**Next Action**: User review/approval → proceed to Document 2 (Design System)  
**Contact**: Awaiting feedback on app positioning, personas, value prop accuracy
