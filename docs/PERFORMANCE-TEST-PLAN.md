# Performance Test Plan — Kids P2P Marketplace

**Status:** PLANNING ONLY — no execution code in this document.
**Scope:** `p2p-kids-marketplace/` (React Native / Expo, iOS + Android) and `p2p-kids-admin/` (Next.js App Router on `:3001`). Shared Supabase backend (PostgREST queries, RPCs, Edge Functions, Realtime, Storage).
**Author role:** Senior performance engineer.
**Date:** 2026-07-28

---

## 1. Measurement model

The two apps require different metric vocabularies:

### 1.1 Mobile (React Native) — web vitals do not apply directly

There is no browser, so TTFB/FCP/LCP as defined by web-vitals are **not measurable**. We map them to native equivalents:

| Web metric | RN equivalent used in this plan |
|---|---|
| TTFB | **Supabase first-response latency** — time from request dispatch to first byte of the PostgREST/EF/RPC response (measured with `performance.now()` wrappers around the Supabase client) |
| FCP | **First render commit** — navigation dispatch → first React commit of the target screen (skeleton/spinner counts) |
| LCP | **Content-ready render** — navigation dispatch → commit in which the primary content (list rows, item image, chart) is mounted with real data |
| TTI | **Interaction-ready** — content-ready + JS thread idle (no pending long tasks; taps respond < 100 ms) |
| Total load | **Nav-start → interaction-ready** (the headline number in the report) |

Additional mobile-only metrics: cold-start time (process launch → Landing/Home interactive), JS bundle parse time, Hermes heap after load, re-render counts on scroll.

**Tooling (mobile):**
- **Custom `performance.now()` timers** around every Supabase call — a thin instrumented wrapper (`supabase-perf.ts`, to be built in the execution step) that records `{route, table/fn, ms, payloadBytes}` — isolates query latency from render time. *Justification: only way to attribute time to backend vs. UI on device.*
- **React `<Profiler>` + metro-mcp render tracking** (`start_profiling` / `get_react_renders`) for commit durations and wasted renders. *Justification: already available in this workspace's toolchain; no app-store build needed.*
- **metro-mcp network buffer** (`get_network_requests` / `get_network_stats`) for request count + payload size per screen. *Justification: passive capture; zero app-code changes.*
- **Maestro flows with timestamps** (existing test-automation infra) for end-to-end nav-start → visible assertions on real screens. *Justification: reuses the 119-case harness; timings can piggy-back on existing flows.*
- **`npx react-native-bundle-visualizer` / `expo export --dump-sourcemap`** for per-screen JS bundle attribution (one-off, not per-run).

### 1.2 Admin portal (Next.js) — full web vitals apply

**Tooling (admin):**
- **Lighthouse CI** against `http://localhost:3001/<route>` for TTFB/FCP/LCP/TTI/TBT on public + auth-bypassed pages. *Justification: standard, CI-friendly, produces trend budgets.*
- **Playwright + `page.evaluate(() => performance.getEntriesByType(...))` + CDP** for authenticated pages (login via `PLAYWRIGHT_ADMIN_E2E=true` flow already used by the suite), capturing navigation timing, resource timing (isolates Supabase REST/RPC calls to `*.supabase.co`), and request count/bytes. *Justification: Lighthouse can't easily hold the Supabase session; Playwright already has working admin auth in this repo.*
- **Server-side API route timing:** Playwright request interception timing on `/api/admin/*` routes, since most admin pages fetch through their own Next API routes which in turn call Supabase with the service key (double hop — must be measured at both hops).

### 1.3 Standard test conditions

- Mobile: iPhone simulator (same UDID as E2E suite), release-mode JS (Hermes), warm Metro cache excluded — measure both **cold start** (app killed) and **warm nav** (in-session navigation). Network: unthrottled Wi-Fi baseline + one throttled pass ("Slow 4G", 400 ms RTT / 400 kbps) for Tier-3 screens.
- Admin: `npm run dev` is NOT valid for perf measurement — execution step must run `next build && next start` on `:3001`. Chrome headless, CPU 4× throttle for Lighthouse mobile preset, desktop preset unthrottled.
- Each measurement = median of **5 runs**; report p50 and p95.
- Seeded staging data via `npm run seed:staging` so list screens have realistic row counts.

### 1.4 Threshold tiers

| Tier | Definition | Total-load target (p50) | Hard fail (p95) |
|---|---|---|---|
| **T1 — Static/local** | No network on mount (forms, legal text, confirmations) | ≤ 1.0 s | > 2.0 s |
| **T2 — Single query** | 1–2 Supabase queries, small payloads | ≤ 2.0 s | > 3.5 s |
| **T3 — Data-heavy** | Multiple queries / joins / images / pagination | ≤ 3.5 s | > 5.0 s |
| **T4 — Payment/3rd-party** | Stripe SDK, EF orchestration, external APIs | ≤ 4.0 s (excl. user 3-DS) | > 6.0 s |
| **T5 — Realtime** | Subscriptions (chat, notifications) | initial ≤ 2.5 s; message delivery ≤ 1.0 s | > 4.0 s / > 2.5 s |

Per-metric budgets that apply within a tier: Supabase single query ≤ 400 ms p50 (≤ 800 ms p95); EF invocation ≤ 1200 ms p50; screen first-commit ≤ 300 ms after data arrival; admin LCP ≤ 2.5 s; admin TTFB (local `next start`) ≤ 200 ms; per-screen network requests ≤ 15; per-screen transfer ≤ 1.5 MB (T3 image screens ≤ 3 MB).

---

## 2. Mobile app screen inventory & per-screen plan

Navigation source of truth: [AppNavigator.tsx](p2p-kids-marketplace/src/navigation/AppNavigator.tsx), [HomeTabNavigator.tsx](p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx), route types in [types.ts](p2p-kids-marketplace/src/navigation/types.ts).

Legend for **Measure**: Q = Supabase query latency (isolated), R = render commits (Profiler), N = request count + payload, B = bundle contribution, C = cold-start, RT = realtime latency, S = Stripe/EF latency.

### 2.1 Auth & onboarding

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `Landing` | `src/screens/auth/LandingScreen.tsx` | Static + auth session restore | T1 | C, R, B | ≤ 1.0 s (cold-start budget ≤ 3.0 s to interactive) |
| `Login` | `src/screens/auth/LoginScreen.tsx` | Static; submit → `supabase.auth.signInWithPassword` | T1 (+auth action ≤ 1.5 s) | R, Q(auth) | ≤ 1.0 s |
| `Signup` | `src/screens/auth/SignupScreen.tsx` | Static; submit → auth + profile insert | T1 (+action ≤ 2.0 s) | R, Q | ≤ 1.0 s |
| `PhoneVerification` | `src/screens/auth/PhoneVerificationScreen.tsx` | OTP send/verify (EF/auth) | T2 | Q, R | ≤ 2.0 s; OTP round-trip ≤ 2.5 s |
| `ForgotPassword` | `src/screens/auth/ForgotPasswordScreen.tsx` | Static; submit → auth email | T1 | R | ≤ 1.0 s |
| `ResetPassword` | `src/screens/auth/ResetPasswordScreen.tsx` | Deep-link token validation | T2 | Q, R | ≤ 2.0 s |
| `SuspendedAccount` | `src/screens/auth/SuspendedAccountScreen.tsx` | Static (session flag) | T1 | R | ≤ 1.0 s |
| `ProfileSetup` | `src/screens/profile/ProfileSetupScreen.tsx` | Image picker + Storage upload | T3 | Q(storage upload), R, N | screen ≤ 1.5 s; photo upload ≤ 4.0 s/img |
| `Welcome` | `src/screens/onboarding/WelcomeScreen.tsx` | Static | T1 | R, B | ≤ 1.0 s |
| `Onboarding` (carousel) | `src/screens/onboarding/OnboardingScreen.tsx` | `shouldShowOnboarding` gate query | T2 | Q, R | ≤ 2.0 s (gate check ≤ 400 ms — it blocks ALL navigation, see §4) |
| `FeatureHighlights` | `src/screens/onboarding/FeatureHighlightsScreen.tsx` | Static | T1 | R | ≤ 1.0 s |
| `SubscriptionChoice` | → `SubscriptionPlansScreen.tsx` | Plans query | T2 | Q, R | ≤ 2.0 s |

### 2.2 Home / discovery

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `Home` | `src/screens/dashboard/UserDashboardScreen.tsx` | Multiple parallel queries (listings, trades, SP balance, notifications badge) | **T3** | Q(each), R, N, B | ≤ 3.5 s cold / ≤ 2.0 s warm |
| `Discover` | `src/screens/home/DiscoverScreen.tsx` | Paginated listings + images + filters | **T3** | Q, R, N (image bytes!), scroll FPS | ≤ 3.5 s; scroll ≥ 55 fps |
| `CategoryBrowse` | `src/screens/home/CategoryBrowseScreen.tsx` | Filtered listings query | T3 | Q, R, N | ≤ 3.0 s |
| `ListingDetail` | `src/screens/home/ItemDetailScreen.tsx` | Item + seller + reviews + tax preview (`useTaxCalculation`) | **T3** | Q(item), Q(tax RPC), R, N | ≤ 3.0 s; tax preview ≤ 600 ms after render |
| `MoreFromThisSeller` | `src/screens/home/MoreFromThisSellerScreen.tsx` | Seller listings query | T2 | Q, R, N | ≤ 2.5 s |
| `Favorites` | `src/screens/favorites/FavoritesScreen.tsx` | Favorites join query | T2 | Q, R | ≤ 2.0 s |

### 2.3 Cart & checkout

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `Cart` | `src/screens/cart/CartScreen.tsx` | Cart items + validity checks | T2 | Q, R | ≤ 2.0 s |
| `CartCheckout` | `src/screens/cart/CartCheckoutScreen.tsx` | Bundle totals + tax calc + Stripe PaymentSheet init | **T4** | Q(tax), S(PI create EF), R, N | ≤ 4.0 s to sheet-ready; tax line ≤ 600 ms |
| `BundleBuilder` | `src/screens/cart/BundleBuilderScreen.tsx` | Seller listings + bundle rules | T3 | Q, R, N | ≤ 3.0 s |

### 2.4 Listings (seller)

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `MyListings` | `src/screens/listing/MyListingsScreen.tsx` | Own listings + status | T2 | Q, R, N | ≤ 2.5 s |
| `CreateListing` | `src/screens/listing/CreateListingScreen.tsx` | Form; submit → insert + Storage | T1 (+publish ≤ 5 s w/ photos) | R, Q(upload) | ≤ 1.5 s |
| `ItemCreate` | `src/screens/ItemCreateScreen.tsx` | Photo-first flow, drafts | T3 | R, Q(upload), N | ≤ 2.0 s; per-photo upload ≤ 4.0 s |
| `BulkListingCreate` | `src/screens/BulkListingCreateScreen.tsx` | Multi-item drafts + uploads | T3 | Q, R, N | ≤ 2.5 s |
| `EditListing` | `src/screens/listing/EditListingScreen.tsx` | Single listing fetch | T2 | Q, R | ≤ 2.0 s |
| `ListingSafetyReview` | `src/screens/listing/ListingSafetyReviewScreen.tsx` | Listing + safety flags | T2 | Q, R | ≤ 2.0 s |

### 2.5 Trading

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `TradeInitiation` | `src/screens/trade/TradeOfferScreen.tsx` | Item + SP wallet + tax preview; submit → `create-trade-offer` EF (Stripe PI auth) | **T4** | Q, S(EF ≤ 2.5 s p50 — it does Stripe auth + tax snapshot), R | screen ≤ 2.5 s; offer submit ≤ 4.0 s |
| `ReviewOffer` | `src/screens/trade/ReviewOfferScreen.tsx` | Trade + items; accept → EF | T4 | Q, S, R | ≤ 2.5 s; accept action ≤ 3.0 s |
| `TradeReview` (deprecated) | `src/screens/trade/TradeReviewScreen.tsx` | Legacy — exclude from suite, note only | — | — | — |
| `TradeList` | `src/screens/trade/TradeListScreen.tsx` | Trades w/ joins, tabs | T3 | Q, R, N | ≤ 3.0 s |
| `TradeDetail` / `TradeTimeline` | `src/screens/trade/TradeTimelineScreen.tsx` | Trade + timeline events + payment details + live tax (`useTaxCalculation`) | **T3** | Q(each), R | ≤ 3.0 s |
| `TradeSuccess` | `src/screens/trade/TradeSuccessScreen.tsx` | Params-driven, mostly static | T1 | R | ≤ 1.0 s |
| `TradeV2ComponentsPreview` | `src/screens/trade/TradeV2ComponentsPreviewScreen.tsx` | Dev-only — exclude | — | — | — |

### 2.6 Messaging (realtime)

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `Conversations` / `InboxTab` | `src/screens/messaging/ConversationsListScreen.tsx` | Conversations + unread counts + realtime sub | **T5** | Q, RT(sub-established), R | ≤ 2.5 s; badge update ≤ 1.0 s |
| `Chat` | `src/screens/messaging/ChatScreen.tsx` | Message history + realtime channel | **T5** | Q(history), RT(send→peer-receive), R | history ≤ 2.0 s; message delivery ≤ 1.0 s |

### 2.7 SP wallet

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `SpWallet` | `src/screens/sp/SpWalletScreen.tsx` | Wallet balance + pending SP + recent ledger | T2 | Q, R | ≤ 2.0 s |
| `SpTransactionHistory` | `src/screens/sp/SpTransactionHistoryScreen.tsx` | Paginated ledger | T3 | Q, R, pagination fetch ≤ 500 ms | ≤ 2.5 s |

### 2.8 Profile & account

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `Profile` | `src/screens/profile/ProfileScreen.tsx` | Profile + stats + badges | T2 | Q, R | ≤ 2.5 s |
| `SellerProfile` | `src/screens/profile/SellerProfileScreen.tsx` | Public profile + listings + reviews | T3 | Q, R, N | ≤ 3.0 s |
| `EditProfile` | `src/screens/profile/EditProfileScreen.tsx` | Profile fetch + avatar upload | T2 | Q, R | ≤ 2.0 s |
| `Badges` | `src/screens/profile/BadgesScreen.tsx` | Badges query | T2 | Q, R | ≤ 2.0 s |
| `Leaderboard` | `src/screens/profile/LeaderboardScreen.tsx` | Ranked aggregate query | T3 | Q (watch for slow aggregates), R | ≤ 3.0 s |
| `TransactionHistory` | `src/screens/profile/TransactionHistoryScreen.tsx` | Billing/tx history + tax details | T3 | Q, R | ≤ 2.5 s |
| `Settings` | `src/screens/profile/SettingsScreen.tsx` | Mostly static + prefs read | T1 | R | ≤ 1.5 s |
| `PaymentMethods` | `src/screens/profile/PaymentMethodsScreen.tsx` | Stripe payment methods (EF) | T4 | S, R | ≤ 3.0 s |
| `LinkedAccounts` | `src/screens/profile/LinkedAccountsScreen.tsx` | Linked identities query | T2 | Q, R | ≤ 2.0 s |
| `NotificationPreferences` | `src/screens/profile/NotificationPreferencesScreen.tsx` | Prefs read/write | T2 | Q, R | ≤ 2.0 s |
| `IDVerificationUpload` | `src/screens/profile/IDVerificationUploadScreen.tsx` | Image picker + Storage upload | T3 | Q(upload), R | screen ≤ 1.5 s; upload ≤ 5.0 s |
| `TermsOfService` | `src/screens/profile/TermsOfServiceScreen.tsx` | Static text | T1 | R | ≤ 1.0 s |
| `PrivacyPolicy` | `src/screens/profile/PrivacyPolicyScreen.tsx` | Static text | T1 | R | ≤ 1.0 s |
| `LiabilityDisclaimer` | `src/screens/settings/LiabilityDisclaimerScreen.tsx` | Static | T1 | R | ≤ 1.0 s |
| `DeleteAccount` | `src/screens/settings/DeleteAccountScreen.tsx` | Static + destructive action EF | T1 | R | ≤ 1.5 s |

### 2.9 Subscription

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `SubscriptionPlans` / `KidsClubOverview` / `SubscriptionChoice` | `src/screens/subscription/SubscriptionPlansScreen.tsx` | Plans/config query | T2 | Q, R | ≤ 2.0 s |
| `PlanComparison` | `src/screens/subscription/PlanComparisonScreen.tsx` | Static/config | T1 | R | ≤ 1.5 s |
| `SubscriptionPayment` | `src/screens/subscription/SubscriptionPaymentScreen.tsx` | Stripe PaymentSheet init (EF) | **T4** | S, R | ≤ 4.0 s to sheet-ready |
| `SubscriptionSuccess` | `src/screens/subscription/SubscriptionSuccessScreen.tsx` | Params + status confirm | T2 | Q, R | ≤ 2.0 s |
| `SubscriptionStatus` | `src/screens/subscription/SubscriptionStatusScreen.tsx` | Subscription record query | T2 | Q, R | ≤ 2.0 s |
| `ManageKidsClub` | `src/screens/subscription/ManageKidsClubScreen.tsx` | Subscription + billing | T2 | Q, R | ≤ 2.0 s |
| `ContinueKidsClub` | `src/screens/subscription/ContinueKidsClubScreen.tsx` | Trial state query | T2 | Q, R | ≤ 2.0 s |
| `UpgradePlan` | `src/screens/subscription/UpgradePlanScreen.tsx` | Plans + proration (EF) | T4 | S, R | ≤ 3.0 s |
| `CancelSubscription` | `src/screens/subscription/CancelSubscriptionScreen.tsx` | Static + cancel EF | T1 | R | ≤ 1.5 s |
| `SubscriptionExpired` | `src/screens/subscription/SubscriptionExpiredScreen.tsx` | Params-driven | T1 | R | ≤ 1.0 s |
| `MySubscription` | `src/screens/subscription/MySubscriptionScreen.tsx` | Subscription query | T2 | Q, R | ≤ 2.0 s |

### 2.10 Seller earnings & payouts

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `PayoutSettings` | `src/screens/seller/PayoutSettingsScreen.tsx` | Payout methods (Stripe Connect state) | T4 | S, Q, R | ≤ 3.0 s |
| `SellerEarnings` | `src/screens/seller/SellerEarningsScreen.tsx` | Earnings aggregates + history | T3 | Q, R | ≤ 3.0 s |
| `RequestPayout` | `src/screens/payouts/RequestPayoutScreen.tsx` | Balance + payout EF | T4 | Q, S, R | ≤ 2.5 s; submit ≤ 3.5 s |

### 2.11 Reviews, referrals, notifications, support, admin-in-app

| Route | File | Data loading | Tier | Measure | Target |
|---|---|---|---|---|---|
| `SubmitReview` | `src/screens/review/SubmitReviewScreen.tsx` | Form; submit insert | T1 | R | ≤ 1.5 s |
| `ReferralDashboard` | `src/screens/referrals/ReferralsScreen.tsx` | Referral stats query | T2 | Q, R | ≤ 2.0 s |
| `Notifications` | `src/screens/notifications/NotificationCenterScreen.tsx` | Paginated notifications + realtime | **T5** | Q, RT, R | ≤ 2.5 s |
| `NotificationSetup` | `src/components/NotificationSetup.tsx` | Permission + token registration | T2 | Q, R | ≤ 2.0 s |
| `Unsubscribe` | `src/screens/UnsubscribeScreen.tsx` | Token-based pref update | T2 | Q, R | ≤ 2.0 s |
| `Help` / `Support` | `src/screens/help/HelpScreen.tsx` | FAQ content query | T2 | Q, R | ≤ 2.0 s |
| `HelpSupport` | `src/screens/support/HelpSupportMenuScreen.tsx` | Static menu | T1 | R | ≤ 1.0 s |
| `ContactSupport` | `src/screens/support/ContactSupportScreen.tsx` | Form; submit → ticket insert | T1 | R | ≤ 1.5 s |
| `FAQDetail` | `src/screens/support/FAQDetailScreen.tsx` | Params-driven (FAQ passed in) | T1 | R | ≤ 1.0 s |
| `AdminDashboard` | `src/screens/admin/AdminDashboardScreen.tsx` | Multiple admin aggregates | T3 | Q, R | ≤ 3.5 s |
| `ReviewModeration` | `src/screens/admin/ReviewModerationScreen.tsx` | Flagged reviews queue | T2 | Q, R | ≤ 2.5 s |
| `TrialConversionTest` | `src/screens/admin/TrialConversionTestScreen.tsx` | Dev/test tool — exclude | — | — | — |

### 2.12 Utility screens (excluded from suite)

`OfflineScreen`, `LoadingScreen`, `SuccessScreen`, `ErrorScreen` (`src/screens/error/`, `src/screens/feedback/`) — transient/no route params; not independently measurable. Noted for completeness.

---

## 3. Admin portal route inventory & per-route plan

All routes under [p2p-kids-admin/src/app](p2p-kids-admin/src/app). Pattern: client components fetch via `/api/admin/*` route handlers, which call Supabase with the service key — so every page has **two hops** to measure: browser → Next API (`apiMs`) and Next API → Supabase (`dbMs`, instrumented server-side or inferred).

**Metrics for every admin page:** TTFB, FCP, LCP, TTI, total load, `apiMs` per `/api/*` call, request count + transfer size. Bundle size per route from `next build` output (First Load JS) — one-off.

| Route | File | Data pattern | Tier | Target (LCP / total) |
|---|---|---|---|---|
| `/` (dashboard) | `src/app/page.tsx` | Multiple stats queries | T3 | 2.5 s / 3.5 s |
| `/auth/login` | `src/app/auth/login/page.tsx` | Static form; auth POST | T1 | 1.5 s / 2.0 s (login action ≤ 2.0 s) |
| `/listings` | `src/app/listings/page.tsx` | Listings table + filters | T3 | 2.5 s / 3.5 s |
| `/items/[id]` | `src/app/items/[id]/page.tsx` | Item detail + tax category | T2 | 2.0 s / 3.0 s |
| `/items/flagged` | `src/app/items/flagged/page.tsx` | Flagged queue | T2 | 2.0 s / 3.0 s |
| `/categories` | `src/app/categories/page.tsx` | Categories CRUD | T2 | 2.0 s / 3.0 s |
| `/config` | `src/app/config/page.tsx` | `admin_config` table read | T2 | 2.0 s / 3.0 s |
| `/badges` | `src/app/badges/page.tsx` | Badge defs + queue | T2 | 2.0 s / 3.0 s |
| `/badges/sandbox` | `src/app/badges/sandbox/page.tsx` | Dev tool — exclude | — | — |
| `/id-badges` | `src/app/id-badges/page.tsx` | Verification queue + search | T2 | 2.0 s / 3.0 s |
| `/id-badges/[requestId]/review` | `.../review/page.tsx` | Request + ID images (Storage signed URLs) | T3 | 2.5 s / 4.0 s (image fetch dominated) |
| `/id-badges/[requestId]/details` | `.../details/page.tsx` | Request detail | T2 | 2.0 s / 3.0 s |
| `/id-badges/messages` | `src/app/id-badges/messages/page.tsx` | Message templates | T2 | 2.0 s / 3.0 s |
| `/payouts` | `src/app/payouts/page.tsx` | Payout queue + Stripe status | T3 | 2.5 s / 3.5 s |
| `/payouts/earnings` | `src/app/payouts/earnings/page.tsx` | Earnings aggregates | T3 | 2.5 s / 3.5 s |
| `/nodes` | `src/app/nodes/page.tsx` | Nodes table | T2 | 2.0 s / 3.0 s |
| `/users` | `src/app/users/page.tsx` | Users table + search | T3 | 2.5 s / 3.5 s |
| `/reviews` | `src/app/reviews/page.tsx` | Review moderation queue | T2 | 2.0 s / 3.0 s |
| `/trades` | `src/app/trades/page.tsx` | Trades table + joins | T3 | 2.5 s / 3.5 s |
| `/trades/[id]` | `src/app/trades/[id]/page.tsx` | Trade detail + timeline + tax record | T3 | 2.5 s / 3.5 s |
| `/trades/disputes` | `src/app/trades/disputes/page.tsx` | Dispute queue | T2 | 2.0 s / 3.0 s |
| `/trades/disputes/[tradeId]` | `.../[tradeId]/page.tsx` | Dispute detail + evidence images | T3 | 2.5 s / 4.0 s |
| `/disputes` | `src/app/disputes/page.tsx` | Dispute queue (alt route) | T2 | 2.0 s / 3.0 s |
| `/disputes/[tradeId]` | `src/app/disputes/[tradeId]/page.tsx` | Dispute detail | T3 | 2.5 s / 3.5 s |
| `/subscriptions` | `src/app/subscriptions/page.tsx` | Subscriptions table | T2 | 2.0 s / 3.0 s |
| `/subscriptions/manage` | `src/app/subscriptions/manage/page.tsx` | Sub management + Stripe | T3 | 2.5 s / 3.5 s |
| `/cancellation-insights` | `src/app/cancellation-insights/page.tsx` | Aggregate analytics | T3 | 2.5 s / 3.5 s |
| `/sp-wallet` | `src/app/sp-wallet/page.tsx` | Wallet lookups | T2 | 2.0 s / 3.0 s |
| `/sp-economy` | `src/app/sp-economy/page.tsx` | Economy aggregates | T3 | 2.5 s / 3.5 s |
| `/sp-analytics` | `src/app/sp-analytics/page.tsx` | SP charts (heavy aggregates) | T3 | 2.5 s / 3.5 s |
| `/analytics` | `src/app/analytics/page.tsx` | Cross-domain charts | T3 | 2.5 s / 3.5 s |
| `/analytics/notifications` | `src/app/analytics/notifications/page.tsx` | Notification metrics | T3 | 2.5 s / 3.5 s |
| `/referrals` | `src/app/referrals/page.tsx` | Referral stats | T2 | 2.0 s / 3.0 s |
| `/waitlist` | `src/app/waitlist/page.tsx` | Waitlist table | T2 | 2.0 s / 3.0 s |
| `/support` | `src/app/support/page.tsx` | Ticket queue | T2 | 2.0 s / 3.0 s |
| `/support/[id]` | `src/app/support/[id]/page.tsx` | Ticket detail + thread | T2 | 2.0 s / 3.0 s |
| `/audit-logs` | `src/app/audit-logs/page.tsx` | `admin_audit_logs` (large table — pagination critical) | T3 | 2.5 s / 3.5 s |
| `/monitoring` | `src/app/monitoring/page.tsx` | System health queries | T3 | 2.5 s / 3.5 s |
| `/monitoring/cron` | `src/app/monitoring/cron/page.tsx` | Cron run history | T2 | 2.0 s / 3.0 s |
| `/education` | `src/app/education/page.tsx` | Education content CMS | T2 | 2.0 s / 3.0 s |
| `/education/faq` | `src/app/education/faq/page.tsx` | FAQ CRUD | T2 | 2.0 s / 3.0 s |
| `/settings/cart` | `src/app/settings/cart/page.tsx` | Cart config form | T2 | 2.0 s / 3.0 s |
| `/settings/trade-timing` | `src/app/settings/trade-timing/page.tsx` | Timing config | T2 | 2.0 s / 3.0 s |
| `/settings/nodes` | `src/app/settings/nodes/page.tsx` | Node settings | T2 | 2.0 s / 3.0 s |
| `/settings/policies` | `src/app/settings/policies/page.tsx` | Policy list | T2 | 2.0 s / 3.0 s |
| `/settings/policies/new` | `.../new/page.tsx` | Static form | T1 | 1.5 s / 2.0 s |
| `/settings/policies/[id]` | `.../[id]/page.tsx` | Policy detail | T2 | 2.0 s / 3.0 s |
| `/settings/policies/[id]/edit` | `.../[id]/edit/page.tsx` | Policy form | T2 | 2.0 s / 3.0 s |
| `/tax/rules` | `src/app/tax/rules/page.tsx` | Versioned tax rules + history | T2 | 2.0 s / 3.0 s |
| `/tax/settings` | `src/app/tax/settings/page.tsx` | Tax config (incl. `include_fee_in_tax_base`) | T2 | 2.0 s / 3.0 s |
| `/tax/nodes` | `src/app/tax/nodes/page.tsx` | Per-node tax config | T2 | 2.0 s / 3.0 s |
| `/tax/category-mapping` | `src/app/tax/category-mapping/page.tsx` | 8-row mapping table | T2 | 2.0 s / 3.0 s |
| `/tax/reports` | `src/app/tax/reports/page.tsx` | Tax record aggregates (heaviest tax page) | T3 | 2.5 s / 3.5 s |

**Cross-cutting admin measurement:** `ProtectedLayout` performs a client-side `supabase.auth.getUser()` on every route before rendering — its latency must be reported as a separate shared metric (`authGateMs`, target ≤ 300 ms) because it is a fixed tax on every page's TTI.

---

## 4. Known risk hotspots to prioritize (from code review)

1. **Root navigator onboarding gate** ([AppNavigator.tsx](p2p-kids-marketplace/src/navigation/AppNavigator.tsx)) — `shouldShowOnboarding()` blocks the entire navigator render for authenticated users; a 12 s fail-open timer exists, meaning worst case is a 12 s blank spinner. Measure `onboardingGateMs` explicitly on every cold start.
2. **`create-trade-offer` EF** — does tax snapshot + Stripe PI authorization in one call; single biggest user-facing action latency. Isolate EF time vs. Stripe time (EF should log internal timings).
3. **Discover/Home image payloads** — measure image bytes separately; likely the dominant cost on T3 screens.
4. **Admin `/api/admin/config` fallback path** — on error it re-fetches via REST; a failure doubles latency silently. Track retry occurrences.
5. **Realtime setup on Conversations/Chat/Notifications** — channel-join time counts toward TTI but is easily missed.
6. **Admin `authGateMs`** — serial auth check before any content render on all 50+ pages.

---

## 5. Execution matrix (what the next step will build)

| Suite | Tool | Covers |
|---|---|---|
| `perf-mobile-cold-start` | Maestro (timed flows) + metro-mcp | Landing, Home cold start, onboarding gate |
| `perf-mobile-screens` | metro-mcp profiling + instrumented Supabase wrapper + Maestro nav flows | All T1–T3 mobile screens (§2), warm nav |
| `perf-mobile-actions` | Instrumented timers + Stripe test mode | T4 flows: offer submit, checkout, subscription payment, payout |
| `perf-mobile-realtime` | Two-device/simulator harness + timestamps | T5: chat delivery, notification badge |
| `perf-admin-lighthouse` | Lighthouse CI (`next start`, auth cookie injected) | All admin routes, web vitals + budgets |
| `perf-admin-playwright` | Playwright + performance API + CDP | Authenticated per-route timing, `apiMs`, `authGateMs`, payload sizes |
| `perf-bundle` | `next build` output + RN bundle visualizer | One-off bundle attribution, tracked per release |

Runs: 5 iterations per screen, p50/p95 reported. Results land in `e2e-test-results/<timestamp>/perf/` alongside the existing suite output (no changes to the existing 119-case harness).

---

## 6. Report template (to be filled by the execution step)

````markdown
# Performance Test Report — <run date> <run id>

**Build:** mobile <commit sha> / admin <commit sha>
**Environment:** <simulator model + iOS version> | Chrome <version> | Supabase <project ref> (staging)
**Network profile:** <unthrottled | slow-4g>
**Iterations per screen:** 5 (p50 reported; p95 in detail sections)

## 1. Summary

| Screen Name | Route | Load Time (actual, p50) | Target Threshold | Pass/Fail | Primary Bottleneck |
|---|---|---|---|---|---|
| <name> | <route/path> | <x.x s> | <x.x s> | ✅ / ❌ | <query / render / images / EF / bundle / auth-gate> |

**Totals:** <n> screens measured · <n> pass · <n> fail · <n> skipped
**Worst regression vs. previous run:** <screen> (+<x> ms)

## 2. Cross-cutting metrics

| Metric | Value (p50 / p95) | Budget | Pass/Fail |
|---|---|---|---|
| Mobile cold start → interactive | | ≤ 3.0 s | |
| Onboarding gate (`shouldShowOnboarding`) | | ≤ 400 ms | |
| Admin auth gate (`authGateMs`) | | ≤ 300 ms | |
| Mobile JS bundle (total) | | baseline ±5 % | |
| Admin First Load JS (largest route) | | ≤ 300 kB | |

## 3. Per-screen detail

### <Screen Name> (`<route>`)

**File:** `<path>` · **Tier:** <T1–T5> · **Verdict:** ✅ PASS / ❌ FAIL

#### Metrics Captured
| Metric | p50 | p95 | Budget | Pass |
|---|---|---|---|---|
| Total load (nav → interactive) | | | | |
| First render commit | | | | |
| Content-ready render | | | | |
| Supabase query time (sum) | | | | |
| Network requests / transfer | | | | |
| <screen-specific metric> | | | | |

#### Raw Timing Breakdown
```
nav dispatch ..................... 0 ms
first commit ..................... <x> ms
<query 1 name> issued ............ <x> ms
<query 1 name> resolved .......... <x> ms   (<dur> ms)
content-ready commit ............. <x> ms
interactive (JS idle) ............ <x> ms
```

#### Supabase Query Analysis
| Call | Type (query/RPC/EF/storage) | Duration p50 | Payload | Rows | Waterfall position | Notes |
|---|---|---|---|---|---|---|
| | | | | | serial/parallel | e.g. missing index, N+1, over-fetch |

#### Suggested Improvements
- **High:** <change with largest expected impact, e.g. parallelize queries X+Y, add index, paginate>
- **Medium:** <e.g. lazy-load below-fold images, memoize list rows>
- **Low:** <e.g. trim selected columns, prefetch on hover/press-in>

## 4. Regressions & trends

| Screen | This run | Previous run | Δ | Status |
|---|---|---|---|---|

## 5. Appendix
- Raw artifacts: `e2e-test-results/<run>/perf/` (Lighthouse JSON, Playwright traces, metro-mcp profiles, timing CSVs)
- Excluded screens and reasons
- Environment anomalies observed during the run
````

---

## 7. Pass/fail policy

- A screen **fails** if p50 total load > tier target OR p95 > hard-fail bound OR any per-metric budget (§1.4) is exceeded by > 25 %.
- The **run fails** if any T4 payment flow fails, or > 10 % of screens fail, or a cross-cutting metric (cold start, auth gate) fails.
- First execution run establishes the baseline; subsequent runs additionally fail on > 20 % regression per screen even within budget.
