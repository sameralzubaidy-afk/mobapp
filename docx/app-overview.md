# App Overview: Pass It Up
**Kids P2P Marketplace for Used Items**  
**Date**: June 20, 2026  
**Version**: 2.0 (Cleaned & Verified Against Codebase)

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

- **Photo-first listing**: Snap photo → add details → publish quickly
- **Bulk listing tools**: Upload multiple items at once (Post-MVP: coming after initial launch)
- **Instant local visibility**: Items shown to nearby parents immediately
- **Swap Points currency**: Earn platform credits (with active subscription) to use toward future purchases
- **Safe transactions**: In-app messaging, Stripe payments, and safety checks

### For Buyers
**"Find quality kids' items locally—save money, skip shipping."**

- **Local discovery**: Search by ZIP/radius for pickup convenience (standard list/grid feed; swipe-based discovery is Post-MVP)
- **Trusted safety**: CPSC recall checks, Google Vision AI image moderation, ID verification
- **Swap Points savings**: Use platform credits to cover up to 50% of item price (admin-configurable). SP spending continues during the 90-day grace period after subscription ends.
- **Secure payments**: Stripe integration with buyer protection
- **Community trust**: Verified sellers, ratings, and reviews

### Platform Differentiation
Unlike generic marketplaces (Facebook Marketplace, Craigslist), Pass It Up offers:
1. **Kid-specific safety**: CPSC recall matching, age-appropriate categories, Google Vision AI moderation
2. **Seller privacy by default**: Seller identity is masked until a trade is active — preventing off-platform dealing, grooming, and stalking. Buyers see a non-identifying colored badge to recognize same-seller items.
3. **Single-seller cart model**: Each active cart is locked to one seller (one physical meetup per trade). Bundle CTA lets buyers submit a single offer for multiple items from the same seller.
4. **Gamified currency**: Swap Points reward active subscribers (subscription-gated earning; spending continues during grace period)
5. **Hyper-local nodes**: ZIP-based communities for fast local pickup
6. **Parent-friendly UX**: Designed for time-strapped parents (quick listing, messaging, checkout)

---

## 4. Business Model

### Revenue Streams

#### 4.1 Subscription Tiers (Primary Revenue)
Pass It Up operates on a **freemium subscription model** with two active tiers (plus a third post-grace state):

**Free Tier (Trial)**:
- 30-day free trial for new users (admin-configurable duration)
- Full access to buying and selling
- **Can earn AND spend Swap Points** during trial (trial = active subscription)
- 90-day grace period after trial ends (access continues, gentle nudges to upgrade)

**Kids Club Membership** (Paid Tier):
- **Price**: Admin-configurable (monthly and yearly plans)
- **Benefits**:
  - Lower flat transaction fees ($0.99 vs. $2.99 per transaction, admin-configurable)
  - **Swap Points earning enabled** (earn SP on all sales — gated behind active subscription)
  - Priority listing visibility
  - Early access to new features
  - **Post-MVP**: Bulk listing tools, advanced search filters, Donate-to-charity option

**Free (Post-Grace)**:
- Access continues with higher transaction fees
- **Can spend existing SP during the 90-day grace period, but CANNOT earn new SP** (earning requires active subscription)
- After grace period ends, SP balance is frozen until resubscription
- Limited features vs. paid tier

#### 4.2 Transaction Fees (Secondary Revenue)
- **Buyer Transaction Fee**: Flat fee per transaction — $0.99 (subscribers) / $2.99 (free users). Admin-configurable via `admin_config`.
- **Seller Fee**: 5% of sale price (admin-configurable)
- **Applied**: At checkout (buyer fee separate from item price; seller fee deducted from payout)
- **Platform fees always paid in cash** (never SP)

#### 4.3 Swap Points (SP) Currency System
**SP is NOT a revenue driver** — it's a **retention and engagement tool**.

**How It Works**:
- Sellers earn SP when items sell, at a category-specific earn rate (item price × category `sp_earning_multiplier`), **IF they have an active subscription** (trial or paid)
- Buyers can spend SP to cover a portion of a purchase — up to each category's `sp_spending_cap_percent` (overrides global default of 50%)
- SP has no cash value (cannot be withdrawn or converted to fiat)
- Encourages circular marketplace activity (sell → earn SP → buy → sell)

**SP Rules**:
- **Earning**: Users MUST have an active subscription (trial or paid) to earn SP on sales. Each category has its own `sp_earning_multiplier` (default ~1.1x). "Bonus" categories (e.g., high-demand items) have multipliers >1.10x for accelerated earning. The final SP earned = item price × category multiplier.
- **Spending**: Users can spend SP during active subscription AND during the 90-day grace period after subscription ends. After grace period, SP is frozen until resubscription.
- **Spend cap**: Each category has its own `sp_spending_cap_percent` (admin-configurable per category), which overrides the global `sp_max_percentage_per_purchase` (default 50%). Buyer must pay any remaining % in cash, plus all platform fees in cash.
- **Pending period**: Earned SP is pending for 3 days (admin-configurable) — releases when buyer confirms item received
- **Platform fees always paid in cash** (never SP)

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
- SP savings: Up to 50% off next purchase with earned credits (during subscription or grace period)
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
- ✅ **Kid-specific safety**: CPSC recall checks, age categories, Google Vision AI moderation
- ✅ **In-app payment**: No cash meetups, Stripe protection
- ✅ **Verified community**: ID badges, ratings, reviews
- ✅ **Swap Points**: Gamified currency for repeat engagement (subscription-gated earning; spending during subscription + grace period)

### vs. Poshmark Kids / Mercari
- ✅ **Local pickup**: No shipping costs or wait times
- ✅ **Hyper-local**: ZIP-based nodes for neighborhood trust
- ✅ **Quick listing**: Photo-first flow with AI moderation
- ✅ **Community-driven**: Parent-to-parent vs. reseller-heavy

### vs. Once Upon A Child / Kid-to-Kid (Retail Consignment)
- ✅ **Higher seller payouts**: 95% of sale price after 5% seller fee (vs. 30-40% consignment)
- ✅ **No dropoff hassle**: List from home, buyers pick up
- ✅ **Fast payouts**: Stripe Connect payouts on transaction completion
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
- **Payments**: Stripe (checkout + seller payouts via Stripe Connect)
- **Safety**: CPSC recall matching, Google Vision AI image moderation
- **Messaging**: Supabase Realtime (in-app chat)
- **Push Notifications**: FCM (Firebase Cloud Messaging)
- **Email**: SendGrid
- **SMS**: Twilio (phone verification)
- **Testing**: Jest (unit), Maestro (UI flows), E2E (Supabase integration)

### Key Flows (Implemented — from flow-registry.md)
1. **FLOW-01**: Auth (email/password signup, login, social OAuth: Google/Facebook/Apple, phone verification)
2. **FLOW-02**: Onboarding (profile setup, node/ZIP selection, subscription choice)
3. **FLOW-04**: Listings (photo-first create, bulk create, edit, delete, safety review)
4. **FLOW-06**: Discovery (search, filters, favorites, standard list/grid feed)
5. **FLOW-07**: Cart & Bundling (single-seller cart, bundle CTA, "More from this seller" discovery, different-seller modal, seller masking)
6. **FLOW-08**: Trading (checkout, Stripe payment, two-step completion, trade status state machine)
7. **FLOW-10/11**: Swap Points (wallet, earn/spend ledger, pending→release lifecycle)
8. **FLOW-12**: Subscriptions (Stripe integration, purchase, cancel, trial, grace period)
9. **FLOW-14**: Messaging (realtime chat between buyer and seller)
10. **FLOW-13**: Referrals (referral codes, SP rewards)
11. **FLOW-15**: Safety & Moderation (Google Vision AI, CPSC recall checks, reporting)
12. **FLOW-17**: Notifications (push via FCM, in-app, email)

### Post-MVP Flows (Planned — Not Yet Implemented)
- **Delivery Service**: Optional same-day local delivery
- **Swipe-Based Discovery**: Tinder-style card interface for browsing
- **Donate Option**: Donate items to charity for community badges
- **Bulk Listing Tools**: Enhanced bulk upload with AI auto-categorization

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

## 11. Post-MVP Features (Planned — Not Yet Implemented)

The following features are planned for future releases and are **not in the current codebase**:

| Feature | Status | Notes |
|---------|--------|-------|
| **Delivery Service** | Post-MVP | Optional same-day local delivery ($10/delivery est.) |
| **Swipe-Based Discovery** | Post-MVP | Tinder-style card interface for browsing items |
| **Donate Option** | Post-MVP | Donate items to charity, earn community badges |
| **Bulk Listing Tools v2** | Post-MVP | Enhanced bulk upload with AI auto-categorization |
| **Advanced Search Filters** | Post-MVP | Additional filter dimensions beyond current set |

---

## 12. Next Steps (Redesign Workflow)

### Phase 1: Design Foundation (Current)
- ✅ **Phase 0**: Codebase audit (complete)
- 🔄 **Document 1**: App Overview (this document) ← **Updated & Verified**
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
- Testing: Unit + E2E + Maestro regression

---

**Document Status**: Verified Against Codebase (June 2026)  
**Next Action**: User review/approval → proceed to Document 2 (Design System)  
**Key Changes in V2**: Removed non-existent features (swipe discovery, item swapping). Corrected SP rules (spending = grace period only). Corrected fee model (flat fees, not percentage-based). Added Post-MVP section for planned features.
