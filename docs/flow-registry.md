# Flow Registry

> **Canonical source of truth for flows, UX, and functions/features** in the Kids P2P Marketplace (mobile app `p2p-kids-marketplace/`, admin portal `p2p-kids-admin/`, Supabase backend `supabase/`, and marketing/web app `p2p-kids-web/`).

This file documents **every product flow**: what the flow is about, its end-to-end steps, the mobile screens (and admin pages, where a flow has an admin leg) that implement it — one line each — plus the key functions/features (services, RPCs, Edge Functions, webhooks, crons) behind it and pointers to the detailed specs/QA guides.

- **Owner/authority:** engineering + QA. When a screen, step, or behavior changes, update the matching flow section **in place**.
- **Not a changelog:** dated DEV-TASK/change history is intentionally NOT stored here (frozen archives in `docs/archive/flow-registry-legacy-2026-09-06.md` and `docs/archive/flow-registry-dev-task-log-2026-09-06.md`; live history = git + `e2e-test-results/` + `/memories/repo/dev-task-*.md`). The dev-agent rule (`.github/agents/Kids P2P App Builder.agent.md` §14A) forbids appending dated entries.
- **Accuracy gate:** every referenced screen file, route, admin page, service, Edge Function, RPC, cron, and doc must resolve to something that exists. The structural check is `scripts/verify-flow-registry.mjs` (repo root) — run it after any registry edit.
- **Last verified:** 2026-09-06 (full re-audit against the codebase).

---

## How to read a flow section

Each section follows the same shape:

1. **Description** — what the flow is about (business purpose, who it serves, entry/exit points, headline rules).
2. **Steps** — the numbered end-to-end journey (happy path, plus the key branches that change the outcome). System-side transitions are noted where they gate UX.
3. **Mobile screens** — bullet list, one line per screen: `RouteName` — `screens/<…>/<File>.tsx` — what the screen does. Screens that are registered but have no live caller are marked `[deprecated]`; screens that exist but are not routed are marked `[unrouted]`.
4. **Admin pages** — only present when the flow has an admin leg. One line per page (`/path` — purpose).
5. **Functions/features** — the key implementation surface: client services, Supabase RPCs, Edge Functions, webhooks, crons. One line each.
6. **References** — the canonical spec (in `docx/`) and QA guide (in `cross-checked-and-consolidated/`) that carry the detailed behavior/test cases.

Status vocabulary used in this file:
- **live** — actively navigated by real users today.
- **deep-link/push-only** — no in-app nav entry; reached only via a URL/push payload.
- **deprecated** — registered for backward compatibility (old notifications/deep links) but not part of any current journey.
- **unrouted** — file exists in `src/screens/` but is not registered in any navigator (dead/duplicate/legacy).
- **post-MVP (planned)** — specified but not yet implemented in this codebase.

---

## Canonical flow list & legacy-label resolution

The registry below supersedes the historically inconsistent FLOW-XX labeling (which reused numbers: FLOW-15 ×3, FLOW-16 ×3, FLOW-17 ×3, FLOW-18 ×4, FLOW-21 ×7, FLOW-22 ×4, etc.). Numbers still in active use by the QA guides were kept for their **modern canonical meaning**; conflicting historical meanings were consolidated and are translated in the table below.

| # | Title (this registry) | Legacy labels that folded into it |
|---|---|---|
| FLOW-00 | Infrastructure & Environment Health | FLOW-00; "Error Recovery & Crash Reporting" (old FLOW-21/PROD-P003-004); FLOW-26 misc/edge shells (part) |
| FLOW-01 | Auth | FLOW-01 (unchanged) |
| FLOW-02 | Profiles & Onboarding | FLOW-02 (unchanged) |
| FLOW-03 | Node/ZIP Gating + Waitlist | FLOW-03 (unchanged) |
| FLOW-04 | Listings (seller listing lifecycle) | FLOW-04 (unchanged; publish/moderation states) |
| FLOW-05 | Media Upload & AI Image Analysis | FLOW-05 + old "Google Vision" upload hook + the image-analysis part of FLOW-04C |
| FLOW-06 | Discovery | FLOW-06 (unchanged) |
| FLOW-07 | Cart & Bundling | FLOW-07 (unchanged) |
| FLOW-08 | Trade Flow (checkout + transaction state machine) | FLOW-08 (unchanged); review *entry* post-completion |
| FLOW-09 | Fees & Pricing Engine + Sales Tax | FLOW-09 + old "FLOW-22 Sales Tax" (moved here); fee/tax admin legs |
| FLOW-10 | Swap Points Wallet (read/ledger/history) | FLOW-10 (unchanged) |
| FLOW-11 | Swap Points Earn/Spend/Cap/Pending→Release | FLOW-11 + FLOW-04C category SP calculations & bonus badges (SP part) |
| FLOW-12 | Subscriptions (Kids Club+ lifecycle/tiers) | FLOW-12 (unchanged); trial/grace/expired/cancel |
| FLOW-12A | Subscription Payment Collection (Stripe) | FLOW-12A (unchanged); Stripe money path |
| FLOW-13 | Referrals | FLOW-13 (unchanged) |
| FLOW-14 | Messaging (Realtime) | FLOW-14 (unchanged) |
| FLOW-15 | Safety, Moderation & Content Review | old "FLOW-15 Safety & Moderation", "FLOW-16 CPSC recall", "FLOW-17 Google Vision image moderation", "FLOW-18 CPSC recall imports" (moved here); review moderation moved to FLOW-21 |
| FLOW-16 | Home Dashboard | old "FLOW-16 Home Dashboard" (kept); CPSC moved to FLOW-15 |
| FLOW-17 | Notifications (in-app/push/email/preferences) | FLOW-17 (unchanged) incl. subscription-event notifications |
| FLOW-18 | Admin Controls & Configuration | FLOW-18 (unchanged) + old "FLOW-21 Category Management V3/CRUD" + "Education CMS" moved to FLOW-19 admin |
| FLOW-19 | Trading Education, Help & Support, SP Calculator | old "FLOW-19 Trading Education" (kept); "Analytics Events" stub → FLOW-20/00; Education CMS + EDU-001 admin |
| FLOW-20 | Audit & Logging | FLOW-20 (unchanged); old "FLOW-19 Analytics Events" observability |
| FLOW-21 | ID Verification, Badges & Reputation (incl. public seller profile + reviews) | old "FLOW-21 ID Verification", "FLOW-29 ID Badge submission/decision notifications" (kept thin), old "FLOW-15 Seller Profile/Reviews", old "FLOW-08 review submit/display" |
| FLOW-22 | Seller Payouts & Withdrawals | FLOW-22 (unchanged; "payout dashboard" redesign) |
| FLOW-23 | Payout Method Verification | FLOW-23 (unchanged) |
| FLOW-24 | MFA / Multi-Factor Enrollment | FLOW-24 — **post-MVP (planned)** |
| FLOW-25 | Manual/Admin Payout Processing | FLOW-25 (unchanged) |
| FLOW-26 | Webhook Processing & Verification | FLOW-26 (unchanged) |
| FLOW-27 | Refunds & Cancellations | FLOW-27 (unchanged); buyer cancel-request + escalation |
| FLOW-28 | Cron & Background Jobs | FLOW-28 (unchanged) |
| FLOW-30 | SP Wallet Admin Operations | FLOW-30 (unchanged) |
| FLOW-31 | Terms of Service | FLOW-31 (unchanged) |
| FLOW-32 | Privacy Policy | FLOW-32 (unchanged) |
| FLOW-33 | Liability Disclaimer | FLOW-33 (unchanged) |
| — | (FLOW-29 retired as separate product flow; ID-badge notifications live under FLOW-21) | |
| — | Engineering & Compliance appendix (PROD-001…013 + old FLOW-34…39) — see Part B | COPPA/Android data-safety, iOS privacy, RLS lockdowns, TS strictness, ESLint, test-suite, store metadata, admin-auth middleware, EF rate-limiting, Stripe-connect ownership |

> **Why the split FLOW-21/FLOW-15:** this registry consolidates every "who can I trust / is this content safe" concern. **FLOW-21** = identity & reputation (the seller's verified identity, badges, public profile, reviews). **FLOW-15** = content safety & moderation (the listing content itself: AI image moderation, CPSC recall checks, admin flag/needs-edits/reject + seller appeal, recall alerts). Review *moderation* (admin removing abusive reviews) sits with reviews under FLOW-21.

---

## Contents (Part A — product flows)

FLOW-00 · FLOW-01 · FLOW-02 · FLOW-03 · FLOW-04 · FLOW-05 · FLOW-06 · FLOW-07 · FLOW-08 · FLOW-09 · FLOW-10 · FLOW-11 · FLOW-12 · FLOW-12A · FLOW-13 · FLOW-14 · FLOW-15 · FLOW-16 · FLOW-17 · FLOW-18 · FLOW-19 · FLOW-20 · FLOW-21 · FLOW-22 · FLOW-23 · FLOW-24 · FLOW-25 · FLOW-26 · FLOW-27 · FLOW-28 · FLOW-30 · FLOW-31 · FLOW-32 · FLOW-33

## Part B — Engineering & Compliance (non-user flows)

PROD-001…013 (security hardening, app-store compliance, tooling/quality gates) — see bottom of file.

---

### FLOW-00: Infrastructure & Environment Health

**Description.** Everything that wraps the product rather than a single feature: app boot and session restore, the global shell (floating pill tab bar, root providers), connectivity/offline handling, loading/error/success shells, crash reporting, the deep-link registry, and the QA/dev tooling harness. Every other flow depends on these surfaces being healthy (this is why FLOW-00 is the "always regression-test" flow).

**Steps.**
1. App cold/warm launch → `App.tsx` initializes error reporting (Sentry) and mounts `AppNavigator`.
2. `AuthProvider` restores the Supabase session; the navigator renders the **authenticated stack** (Home) or the **auth stack** (Landing) accordingly.
3. Root gates run while the app is live: `ConnectivityGate` (real network drop during active use → navigates to Offline), `PolicyReacceptanceGate` (legal re-prompt — see FLOW-31/32), `PersistentTabBar` (global pill nav, hidden only on full-screen routes such as ItemCreate / NotificationSetup / ManageKidsClub), `GlobalAlertProvider`, `KeyboardDoneAccessory`.
4. A render crash is contained by the root `ErrorBoundary` → Error shell (recover/retry); session-scoped QA crash-probe can force this (dev only).
5. Deep links (`p2pkidsmarketplace://…`, Expo linking) resolve via the `linking` config; QA-only handlers (login-as persona, force-trade-success, dev toggles, qa-refresh, qa-scroll-to, set-SP, clear-overlays, logout) act only in `__DEV__`/staging builds.

**Mobile screens.**
- `Loading` — `screens/LoadingScreen.tsx` — boot/splash gate while the session & app state resolve.
- `Offline` — `screens/error/OfflineScreen.tsx` — shown by `ConnectivityGate` when the network drops mid-session (real connectivity boundary, ACC-TC-F03).
- `Error` — `screens/feedback/ErrorScreen.tsx` — root error-boundary fallback with recover/retry and error reporting.
- `Success` — `screens/feedback/SuccessScreen.tsx` — generic success shell used by simple confirmation flows.

**Functions/features.** App shell: `App.tsx`, `navigation/AppNavigator.tsx` (route + linking registry), `PersistentTabBar`, `ConnectivityGate`, `PolicyReacceptanceGate`, `GlobalAlertProvider`, root `ErrorBoundary`; services: `errorReporter.ts` (Sentry), `deepLink.ts`; QA harness: `qaPersonas.ts`, `devTestingService.ts`, `QaLoginAsDeepLinkHandler`/`QaForceTradeSuccessDeepLinkHandler`/`QaDevToggleDeepLinkHandler`/`QaLogoutDeepLinkHandler`/`QaCrashProbe`/`QaRefreshDeepLinkHandler`/`QaScrollToDeepLinkHandler`/`QaSetSpDeepLinkHandler`.

**References.** QA guide `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (F03 connectivity, L01–L04 error/crash); `docx/app-overview.md`.

### FLOW-01: Auth

**Description.** Every way a user enters and manages their account identity: sign up, log in, session restore, password reset, phone verification, social login, account linking, and the suspended/restricted state. It feeds every authenticated flow — no other flow is reachable until a session exists.

**Steps.**
1. Cold launch with no session → **Landing** (marketing/entry) → Login or Signup.
2. Sign up with email+password (optionally with phone verification), or continue with Google / Facebook / Apple (social-only accounts can set a password later). The `handle_new_user` DB trigger provisions the profile row, subscription row (`status='free'`), SP wallet, notification prefs, and referral code.
3. Log in by email+password or social OAuth; a suspended account is blocked with an explanatory screen; session persists across relaunches (auto-restore → Home).
4. Forgotten password → `ForgotPassword` email link → `ResetPassword` (secure token) updates the credential.
5. Phone number verification (OTP) is required at certain gates and can be re-run from Edit Profile (rate-limited resend, see FLOW-02).
6. Account security: link/unlink social providers (`LinkedAccounts`), change/verify email (`auth-email-change` EF with re-verification), set a password on a social-only account, and the last-method guard prevents removing the final login method.
7. Log out from Profile; the QA harness supports persona logins (`qa-login-as`) in dev/staging.

**Mobile screens.**
- `Landing` — `screens/auth/LandingScreen.tsx` — entry screen for logged-out users.
- `Login` — `screens/auth/LoginScreen.tsx` — email/password + social sign-in (live; the root `screens/LoginScreen.tsx` is a dead duplicate).
- `Signup` — `screens/auth/SignupScreen.tsx` — create account with email/password or social (live; root `screens/SignupScreen.tsx` is a dead duplicate).
- `ForgotPassword` — `screens/auth/ForgotPasswordScreen.tsx` — request a reset email.
- `ResetPassword` — `screens/auth/ResetPasswordScreen.tsx` — deep-link `reset-password` target that applies the new password.
- `PhoneVerification` — `screens/auth/PhoneVerificationScreen.tsx` — standalone OTP phone-verification step (also used as a gate modal inside flows).
- `SuspendedAccount` — `screens/auth/SuspendedAccountScreen.tsx` — explains an admin suspension and blocks the app.
- `LinkedAccounts` — `screens/profile/LinkedAccountsScreen.tsx` — view/manage linked social providers, set password for social-only accounts, unlink with last-method guard.

**Functions/features.** Client: `services/auth.ts`, `oauthService.ts`, `oauthProviderConfig.ts`, `phone.ts`/`phoneService.ts`, `passwordService.ts`, `verification.ts`, `emailChange.ts`; Edge Functions: `send-phone-otp`, `auth-email-change`, `auth-update-phone`, `admin-trigger-password-reset`; DB: `handle_new_user` signup trigger/migrations; QA: `qaPersonas.ts` + `QaLoginAsDeepLinkHandler`, provider-outage + phone/email-mismatch dev toggles.

**References.** `cross-checked-and-consolidated/` auth guide (AUTH groups; A01–A08, B02 re-verify, C03–C07, P03); `docx/SOCIAL-LOGIN-REQUIREMENTS.md`.

### FLOW-02: Profiles & Onboarding

**Description.** First-run onboarding and the persistent user profile: the onboarding carousel, profile setup, editing profile details (name, photo, bio, DOB, phone/email with verification), and account lifecycle (delete account). Profile data feeds identity badges, the seller page, and most transactional flows.

**Steps.**
1. First-run: authenticated users see the **Onboarding** carousel (Skip/Continue → Home); on subsequent launches they land directly on Home.
2. New signups complete **ProfileSetup** (display name + photo + any required fields) before entering the app.
3. The **Profile** hub shows the user's avatar/name, membership SP strip, badge showcase, utility rows (Billing/Transaction history, Settings, Admin dashboard if admin, Help & Support, Logout).
4. **EditProfile** changes name/photo/bio/DOB and drives phone + email verification flows (OTP entry, resend countdown aligned to the real rate limit, verify/apply on the backend).
5. Settings → Delete Account lets a user remove their account (identity/profile cleanup; see COPPA note in Part B).
6. Profile updates propagate (phone/email kept in sync between `auth.users` and `profiles` by the auth-change EFs + triggers).

**Mobile screens.**
- `Onboarding` — `screens/onboarding/OnboardingScreen.tsx` — first-run feature carousel with its own bottom buttons (pill nav hidden during it). (`screens/auth/OnboardingScreen.tsx` is an unrouted stub.)
- `ProfileSetup` — `screens/profile/ProfileSetupScreen.tsx` — post-signup profile completion.
- `Profile` — `screens/profile/ProfileScreen.tsx` — the user's own profile hub + utility rows + badge showcase + logout.
- `EditProfile` — `screens/profile/EditProfileScreen.tsx` — edit name/photo/bio/DOB and verify phone/email.
- `Settings` — `screens/profile/SettingsScreen.tsx` — settings/utilities hub (entries to payment methods, notifications, admin, help, delete account).
- `DeleteAccount` — `screens/settings/DeleteAccountScreen.tsx` — account deletion flow (screens/settings).

**Functions/features.** Client: `services/profile.ts`, `profileService.ts`, `photoService.ts` (avatar upload), `verification.ts`, `phoneService.ts`, `emailChange.ts`; Edge Functions: `send-phone-otp`, `auth-email-change`, `auth-update-phone`; DB: `profiles` triggers (`handle_user_update`, phone/email sync), `check_account_exists_by_email`.

**References.** `cross-checked-and-consolidated/` auth+onboarding guides (ACC/B02 phone+email verify, D-groups); `docx/SYSTEM_REQUIREMENTS_V2.md`.

### FLOW-03: Node/ZIP Gating + Waitlist

**Description.** Regional node membership and launch-gating. A user's ZIP/postal code resolves to a node (region) via nearest-match; browsing is normally scoped to the user's node. If no active node covers the area, the user is offered a waitlist; waitlisted users get a global fallback browse scope so they can explore while the node activates. Node state and waitlist management are admin-controlled.

**Steps.**
1. On signup/profile setup the user's location/ZIP is matched to a node (`location.ts` nearest-match against the `nodes` table).
2. If a matching active node exists, the user is assigned to it; discovery/tax/meetup defaults derive from `profiles.node_id`.
3. If no active node matches, the user is offered the waitlist (NODE-003): they opt in and are shown waitlist status.
4. Effective scope is computed (`computeEffectiveNodeScope`): active-node member → node scope; waitlisted → global fallback (intentional browse path); otherwise global.
5. Admins manage nodes (create/activate regions, `nodes` and `settings/nodes` pages) and can clear/observe the waitlist (`waitlist` page).

**Mobile screens.** No dedicated user-facing screen (gating is applied through Profile setup/location + discovery scoping via services).
- `MyListings`/`Profile` surfaces surface waitlist-aware messaging where applicable.

**Admin pages.**
- `/nodes` — node/region management (create, activate, settings).
- `/settings/nodes` — node-related platform settings.
- `/waitlist` — waitlist roster and activation handling.

**Functions/features.** Client: `services/location.ts`, `services/waitlist.ts`, `utils/nodeScope.ts`, `services/profile.ts` (ZIP-active signal); DB: `nodes` + node-membership columns on `profiles`, waitlist rows; admin node CRUD APIs.

**References.** Legacy module `docx/` node-management spec (`NODE-003`); admin `/nodes` comment points to FLOW-03 + migration `20260823000002`.

---

### FLOW-04: Listings (seller listing lifecycle)

**Description.** The seller side of the marketplace: creating, bulk-creating, editing, and managing item listings and their full lifecycle — draft → pending/available → (moderation: flagged / needs-edits / rejected) → sold → expired/soft-deleted/paused. Includes per-listing payment preference (Cash / Accept SP / Donate), category selection (with SP-cap and bonus multipliers), price (subject to the admin min-price floor), and the post-moderation appeal surface. Admin moderation lives in FLOW-15/18.

**Steps.**
1. **Create**: `ItemCreate` collects title, description, category, condition, price, photos (FLOW-05), payment preference, and meetup defaults; a draft auto-saves locally (`draftService`) and can be resumed.
2. **Bulk create**: `BulkListingCreate` drives a per-item form (each row must pass validation) and publishes all items together.
3. **Publish** enforces the admin `min_listing_price`; uploaded photos are analyzed for safety (AI image moderation, FLOW-15) and each item may run a recall check before going live.
4. New listings enter **pending approval** where admin moderation is enabled; approval or edits requests change status (`approved/available`, `needs_edits`, `rejected`, `flagged`). Sellers see explanation + appeal/remove on **ListingSafetyReview**.
5. **Manage**: `MyListings` lists the seller's items (available/pending/flagged/sold) with edit/delete/more actions; expired or declined flows restore items to `available`.
6. A completed trade marks the item `sold`; sellers can soft-delete/pause listings (no new offers) or permanently delete while draft/pending.
7. Seller keeps eligibility toggles (accept SP, donate) that gate how buyers can offer (see FLOW-08/11).

**Mobile screens.**
- `ItemCreate` — `screens/ItemCreateScreen.tsx` — single-item creation form with draft auto-save (root screens dir).
- `BulkListingCreate` — `screens/BulkListingCreateScreen.tsx` — multi-item form (dev-fill fixture in dev builds).
- `EditListing` — `screens/listing/EditListingScreen.tsx` — edit an existing listing.
- `MyListings` — `screens/listing/MyListingsScreen.tsx` — seller's listing hub with per-status cards + edit/delete/more.
- `ListingSafetyReview` — `screens/listing/ListingSafetyReviewScreen.tsx` — seller surface for a flagged/needs-edits/rejected listing: see reason, submit appeal, request re-review, or remove.

**Admin pages.**
- `/listings` — browse/manage listings with page-window counts.
- `/items/[id]` — single-item detail/moderation.
- `/items/flagged` — moderation queue of flagged items (approve/remove) — see FLOW-15.

**Functions/features.** Client: `services/listing.ts` (`getListingById`, `deleteListing`, `submitListingAppeal`, `submitListingNeedsEditsReReview`), `items.ts`, `draftService.ts`, `categoryService.ts`, `photoService.ts`; DB/RPCs: `items` status flow, `admin_approve_listing`, `admin_approve_flagged_listing`, `admin_pause_listing`, `admin_force_delete_listing`, `fn_item_effective_sp_cap`, category SP-cap/multiplier config; admin_config `min_listing_price`.

**References.** `cross-checked-and-consolidated/` listing guides (N-groups: create/edit/bulk/moderation); `docx/` LISTING/ITEM-LISTING specs (V3).

### FLOW-05: Media Upload & AI Image Analysis

**Description.** Cross-cutting media flow: selecting/uploading/removing listing photos and the profile avatar, with storage permission rules, file type/size validation, and AI analysis of item photos. The AI leg (Google Vision categories/labels/safety) powers moderation signals used by FLOW-15 and can enrich listing data (FLOW-04C-style bonus detection).

**Steps.**
1. User picks images (camera roll / capture) for a listing photo or avatar.
2. Client validates type/size; uploads to the Supabase storage bucket; a thumbnail/main image is set on the item/profile.
3. For item photos, the client invokes the image-analysis functions (`analyze-item-image` single or `batch-analyze-items` for many; `moderate-image` for safety) to derive labels/categories/safety verdict.
4. Analysis results are stored with the listing; unsafe/uncertain results can trigger moderation states (FLOW-15); the seller can retake/replace photos.
5. Removing a listing or replacing a photo deletes/overwrites the stored object(s) under the storage policy.

**Mobile screens.** No standalone screen — embedded surfaces:
- `ItemCreate` / `EditListing` / `BulkListingCreate` — listing photo picker + upload (FLOW-04).
- `EditProfile` / `ProfileSetup` — avatar picker + upload (FLOW-02).

**Functions/features.** Client: `services/photoService.ts` (upload/delete), `services/aiService.ts` (analyze/batch), `services/imageModeration.ts` (`moderate-image` wrapper), storage client (`supabase/storage`); Edge Functions: `analyze-item-image`, `batch-analyze-items`, `moderate-image`; DB: photo columns on `items`/`profiles`, moderation result columns (`types/listing.ts`).

**References.** `cross-checked-and-consolidated/` listing guides (N-group photo cases) + safety guide (SAFETY-004 image moderation); `docx/design-system-passitup.md` media rules.

### FLOW-06: Discovery

**Description.** The buyer-side browse experience: the main feed (Discover) with category browsing, search, filters (condition, price, SP eligibility, sort), favorites, and the listing detail page. Discovery is scoped by node where gating applies (FLOW-03) and surfaces trust/safety signals on cards (verified/badge, recall-safe) that link to FLOW-21/15.

**Steps.**
1. Discover renders the marketplace feed of available items with category chips, search bar, and filter affordances; pull-to-refresh + infinite pagination keep the list fresh.
2. Search runs against item title/description/category with history persistence; filters combine category/condition/price/SP and sort options.
3. Favorites: heart an item → saved to the Favorites list (also a tab) for later.
4. Tapping an item opens **ListingDetail** (`ListingDetail` route renders the home item-detail screen): photos, price (with SP/cash framing), condition, seller summary + verified/trust badges, meetup info, "Add to Basket" / "Make Offer" entry points (FLOW-07/08), and recall/safety callouts if applicable.
5. "More from this seller" opens the seller's other items; the seller card links to the public **SellerProfile** (FLOW-21).

**Mobile screens.**
- `Discover` — `screens/home/DiscoverScreen.tsx` — main feed/search/filter (Discover tab).
- `CategoryBrowse` — `screens/home/CategoryBrowseScreen.tsx` — category-scoped grid.
- `ListingDetail` — `screens/home/ItemDetailScreen.tsx` — full item detail (registered as `ListingDetail`; deep link `listing/:listing_id`).
- `Favorites` — `screens/favorites/FavoritesScreen.tsx` — saved items list.
- `MoreFromThisSeller` — `screens/home/MoreFromThisSellerScreen.tsx` — other listings by the same seller.

**Functions/features.** Client: `services/discovery.ts`, `services/items.ts`, `favoritesService.ts`, `searchHistory.ts`, `utils/nodeScope.ts`, `brandAutocomplete.ts`; DB: `items` available-only read paths, favorites, category joins; Realtime not required (pull/refresh based).

**References.** `cross-checked-and-consolidated/` discovery guides (feed/search/filter/favorites groups); `docx/SEARCH-FILTER-REQUIREMENTS.md`.

### FLOW-07: Cart & Bundling

**Description.** The buyer's "Trade Basket" and multi-item bundling: collecting items (single or from one seller) and forming an offer bundle. Bundles aggregate item prices, SP, fees, and tax into one trade with one payment, and are the core of the "make a bundle offer" UX. Also hosts the "more from this seller" merchandising and the hand-off to checkout (FLOW-08).

**Steps.**
1. From ListingDetail/Discover the buyer adds items to the basket (per seller); the basket is capped by platform rules.
2. **Cart** (Trade Basket) lists grouped items, shows per-item SP ceilings/hints, the "Includes points redemption" tag when any item uses SP, a "more from this seller" card, and a fixed bottom-sheet bundle CTA (clear of the pill nav).
3. The buyer taps the CTA → **BundleBuilder** (if building from scratch) or goes straight to **CartCheckout** with the selected bundle.
4. Checkout (FLOW-08) resolves each item's price, SP, fee, and tax, takes a single payment, and creates one bundle trade.
5. Admin cart configuration (offer-count caps, bundle rules) is editable on the admin cart-settings page.

**Mobile screens.**
- `Cart` — `screens/cart/CartScreen.tsx` — Trade Basket list + bundle CTA + more-from-seller banner (Cart tab).
- `BundleBuilder` — `screens/cart/BundleBuilderScreen.tsx` — assemble/select the items for a bundle offer.
- `CartCheckout` — `screens/cart/CartCheckoutScreen.tsx` — review + checkout entry for basket/bundle (shared with FLOW-08).

**Admin pages.**
- `/settings/cart` — cart/bundle platform configuration (admin group N/P).

**Functions/features.** Client: `services/cartService.ts` (`checkoutCart`, SP math via `utils/cartSpMath.ts`), `services/items.ts`; DB: `cart_items`, bundle-offer creation path in `create-trade-offer`; admin config keys for cart/bundle rules.

**References.** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (S-group basket/bundle) + `docx/TRADING-FLOW-V2.md`.

---

### FLOW-08: Trade Flow (checkout + transaction state machine)

**Description.** The heart of the marketplace: turning offers into completed trades. Covers single-item and **bundle** offers (cash + optional Swap Points), the full `trades` state machine (`pending → payment_processing → payment_failed → in_progress → completed | cancelled`), buyer/seller review & decision surfaces, extensions, disputes/issues, cancellations, completion (manual pickup-confirm and auto-complete), and the post-trade success/review step. Money moves (authorization hold, capture, fees, SP release, payout queue) are driven by the Edge Functions below; refund/cancel money paths are detailed in FLOW-27.

**Steps.**
1. **Offer creation** (buyer): from ListingDetail or the Trade Basket (single or bundle) the buyer sets optional SP and confirms the payment method → `create-trade-offer` validates server-side (price, SP cap, fees, tax, cash portion derived from price, seller payment preference, offer-count limits, dupes), reserves SP, and creates a Stripe authorization hold. Trade rows are created in `pending`; both parties get notifications.
2. **Seller decision** (Review Offer): the seller sees the offer (cash/SP breakdown, fee/tax context, buyer trust signals) and **accepts**, **declines** (item stays listed), or lets it **expire** (`process-expired-offers`). Accepting a bundle runs `transactions-accept-bundle`; decline → `transactions-decline-bundle`. Acceptance moves the trade to `in_progress` and starts the completion timer.
3. **In-progress** (Trade Timeline): both parties coordinate via chat/meetup; the timeline shows countdown (auto-complete window, e.g. pickup-confirm in 48h), the seller can request/cancel; a buyer can submit a **Request to Cancel** (FLOW-27) and either party can **Report an issue** (`open-dispute`, pauses auto-complete → FLOW-27).
4. **Extensions** (`trade-extension`): either party can grant/request extra time; the timeline stays in `in_progress` with an updated window.
5. **Completion**: the buyer confirms pickup (manual `complete-trade`) or `process-auto-complete` fires after the window. `complete_trade_v2`/`rpc_process_auto_complete` mark the item sold, capture payment, release SP (`fn_release_all_sp_on_complete`), write fees + queue the seller payout, and emit the completion event/notification.
6. **Success + review**: `TradeSuccess` summarizes what happened (fees paid, SP saved, pending wallet); the buyer is prompted to leave a review (→ FLOW-21); the seller sees the same summary plus payout status (FLOW-22).
7. **Trade list**: the Trades tab organizes Your Offers / Needs Action / Active / History with per-card actions and unread/active badges.

**Mobile screens.**
- `TradeList` — `screens/trade/TradeListScreen.tsx` — the Trades tab (Your Offers, Needs Action, Active, History) with bundle cards + action entry points.
- `TradeOffer` — `screens/trade/TradeOfferScreen.tsx` — make a single/bundle offer (registered also as `TradeInitiation`; deep link `offer`).
- `ReviewOffer` — `screens/trade/ReviewOfferScreen.tsx` — seller reviews/accepts/declines an offer (single or bundle) with full money breakdown.
- `TradeTimeline` — `screens/trade/TradeTimelineScreen.tsx` — the live trade state machine UI (registered also as `TradeDetail`; deep links `trade/:tradeId`, `trade/timeline/:tradeId`).
- `TradeSuccess` — `screens/trade/TradeSuccessScreen.tsx` — post-completion summary + follow-up CTAs (also QA deep-link `qa-force-trade-success`).
- `TradeReview` — `screens/trade/TradeReviewScreen.tsx` — deprecated backward-compat shell (redirects toward Review Offer).
- `SubmitReview` — `screens/review/SubmitReviewScreen.tsx` — post-trade review form (see FLOW-21).
- `CartCheckout` — `screens/cart/CartCheckoutScreen.tsx` — basket/bundle checkout entry (shared with FLOW-07).

**Functions/features.** Edge Functions: `create-trade-offer`, `complete-trade`, `transactions-update`, `transactions-accept-bundle`, `transactions-decline-bundle`, `trade-payment`, `trade-extension`, `cancel-trade`, `open-dispute`, `resolve-dispute`, `process-auto-complete`, `process-expired-offers`, `process-extension-timeouts`, `release-payment`, `release-pending-sp`, `check-authorization-expiry`, `check-trade-notifications`, `send-trade-notifications`, `monitor-mid-trade-subscription-changes`; RPCs: `complete_trade_v2`, `cancel_trade_v2`, `rpc_process_auto_complete`, `fn_reserve_sp_on_offer`, `fn_release_all_sp_on_complete`, `fn_item_effective_sp_cap`, cancel-request RPCs (see FLOW-27); DB: `trades`, `trade_events`, `items.status`, Realtime on `trades` (enabled); notifications via FLOW-17.

**References.** `docx/TRADING-FLOW-V2.md` (canonical state machine) + `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (groups A–E, G–O, Z; TRD-TC-*).

### FLOW-09: Fees & Pricing Engine + Sales Tax

**Description.** The platform's money math on top of item prices: buyer/seller fees, the Kids Club+ membership flat-fee benefit, the admin min-price floor, and **sales tax** (global toggle, per-node rates, per-category rules with node-rate fallback) computed and applied at offer time and refunded proportionally. Admin configures all of it; clients only display server-authoritative numbers.

**Steps.**
1. At offer creation the server computes each item's fee and tax from its current DB price (`price_cents` is the tax/fee base; SP is a payment method, never a discount — BP-37).
2. Fee model: platform fees are derived from the buyer fee / seller fee rules in `admin_config`; a Kids Club+ member pays the flat member fee (savings surfaced on Trade Success); free users pay the percentage fee (first-trade free-tier handled separately).
3. Tax model: `sales_tax_enabled` global switch (off ⇒ tax $0); otherwise resolve the node rate and any **category rule** (category rule overrides node rate — `COALESCE(rule.tax_rate, node_rate)`); `calculate_tax` returns the amount; the offer writes `tax_amount_cents` + a `tax_records` row; the payment hold includes tax.
4. On cancel/refund, tax is voided/refunded proportionally (`refund_tax`, `rpc_void_tax_for_trade`).
5. Admins edit fee/tax settings on the config and tax pages; a change is forward-only (never retroactively re-prices open trades).

**Mobile screens.** No dedicated screens — fee/tax figures render inside:
- `CartCheckout` / `TradeOffer` / `ReviewOffer` — fee + tax preview lines and totals (FLOW-08).
- `TradeSuccess` — fee savings messaging (FLOW-08).

**Admin pages.**
- `/config` — platform fee/config settings (admin group P).
- `/tax/settings` — global sales-tax toggle + defaults.
- `/tax/rules` — tax rule definitions.
- `/tax/nodes` — per-node tax rates.
- `/tax/category-mapping` — category↔tax-rule mapping.
- `/tax/reports` — tax collection reports.

**Functions/features.** Client: `services/pricingService.ts`, `services/tax.ts`; Edge Functions: `create-trade-offer` (server-authoritative fee/tax), `trade-refund`, `cancel-trade` (tax void); RPCs: `calculate_tax`, `apply_tax_to_trade`, `refund_tax`, `rpc_void_tax_for_trade`, `secure_upsert_admin_config`, `upsert_admin_config_setting`; DB: `admin_config` (fee keys, `sales_tax_enabled`, `min_listing_price`), `tax_records`, category/node rate tables.

**References.** `docx/TRADING-FLOW-V2.md` (fees/tax sections) + `Prompts/MODULE-15.3-PART3-TAX-TASKS-RESTRUCTURED.md`; trade guide Groups O/P tax + fee cases.

---

### FLOW-10: Swap Points Wallet (read/ledger/history)

**Description.** The user's Swap Points (SP) wallet view: available balance, pending (reserved/releasing) balance, and full ledger-backed transaction history. SP is a secondary currency earned through trading and spendable on trades (see FLOW-11); this flow is the read/display side and guards the semantics (available vs reserved vs pending) shown to parents.

**Steps.**
1. The wallet loads the user's SP state (available, reserved, pending) via the wallet service; a Realtime refresh keeps it current after offers/completions.
2. **SpWallet** shows balance summary and pending-releasing SP; **SpTransactionHistory** lists ledger entries with type + amount + date.
3. Reserve/spend actions (from an offer or cart) reflect immediately as a pending/reserved change on return.
4. Pending SP becomes available when its release time arrives (FLOW-11).

**Mobile screens.**
- `SpWallet` — `screens/sp/SpWalletScreen.tsx` — SP balance + pending wallet (live; `screens/profile/SpWalletScreen.tsx` is an unrouted duplicate).
- `SpTransactionHistory` — `screens/sp/SpTransactionHistoryScreen.tsx` — ledger transaction history (deep link `sp-history`).

**Functions/features.** Client: `services/spWalletService.ts`, `services/sp.ts`; RPCs: wallet state + ledger reads (`sp_ledger` append-only), `initialize_sp_wallet`, `ensure_sp_wallet_exists`, `adjust_sp_wallet`, SP-balance label semantics; Realtime wallet refresh.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SP read groups); `docx/TRADING-FLOW-V2.md` SP sections.

### FLOW-11: Swap Points — Earn/Spend/Cap + Pending→Release

**Description.** The SP economy rules: who can spend/earn, the per-category cap, offer-time reservation, earning on trade completion, the pending→release window, and expiry/inactivity. Server-enforced invariants (a wallet can't go negative; over-cap offers are rejected) protect the economy; category bonus multipliers (e.g., Sports 1.10) reward trading in featured categories.

**Steps.**
1. **Spend**: at offer/cart time the buyer chooses SP up to the binding cap = `min(category cap FLOOR(price×cap%), wallet available, absolute cap)`. Submitting reserves SP immediately (`fn_reserve_sp_on_offer`); declines/cancels release it back; over-cap requests are rejected server-side.
2. **Earn**: on trade completion the buyer saves the cash-fee difference and the seller earns SP (platform bonus, category-multiplier-adjusted) — computed by `fn_release_all_sp_on_complete`/payout logic.
3. **Pending→release**: earned SP lands in the pending wallet with `pending_sp_release_at`; the `release-pending-sp` path moves it to available when due (countdown/date shown on the timeline/wallet).
4. **Expiry/inactivity**: unused SP can expire per configured rules (SP expiration processing).
5. **Membership tie**: SP earning/spending perks are tied to Kids Club+ benefits; free-tier SP display is adjusted (see FLOW-12).

**Mobile screens.** No dedicated screen — SP surfaces render inside:
- `TradeOffer` / `CartCheckout` — per-item SP input + cap hints (`sp-max-hint-*`) (FLOW-08/07).
- `TradeSuccess` — "You saved $X using SP" + remaining SP (FLOW-08).
- `TradeTimeline` — seller pending-SP release countdown/date (FLOW-08).
- `SpWallet` / `SpTransactionHistory` — pending balance + ledger (FLOW-10).
- SP Calculator (education) — see FLOW-19.

**Admin pages.**
- `/sp-economy` — SP formula/cap configuration (see FLOW-30).
- `/sp-analytics` — SP economy analytics (see FLOW-30).

**Functions/features.** Edge Functions: `release-pending-sp`; RPCs: `fn_reserve_sp_on_offer`, `fn_release_all_sp_on_complete`, `fn_item_effective_sp_cap`, `initialize_sp_wallet`/`adjust_sp_wallet`, `process_sp_expiration`, `admin_toggle_sp_wallet_status`; DB: `sp_ledger`, wallet state, category `sp_spending_cap_percent` (50–80) + `sp_category_multiplier`; admin_config SP keys.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SP earn/spend/cap/release groups); trade guide C08/T-group SP cases; `docx/TRADING-FLOW-V2.md` (FR-SP-003, D-17).

### FLOW-12: Subscriptions (Kids Club+ lifecycle & tiers)

**Description.** The Kids Club+ membership: tier/plan selection, purchase entry, and the full subscription lifecycle — trial, active, grace, expired/cancelled states — with member benefits (flat trade fee, SP perks, badges) and the screens to join, compare, continue, manage, and cancel. Payment itself is FLOW-12A; subscription notifications are FLOW-17.

**Steps.**
1. A non-member lands on **JoinKidsClub** (also rendered via SubscriptionChoice/KidsClubOverview/SubscriptionPlans aliases) or **PlanComparison** and chooses Kids Club+.
2. Purchase runs through the Stripe money path (FLOW-12A); after success the user is a member (trial or active) with benefits enabled.
3. **ContinueKidsClub** is the shared upsell surface shown to free/trial/grace/expired users ("Start/Continue Kids Club+") with the canonical 4 benefits, live member fee, and urgency badges (trial days-left vs free-days pill).
4. Members manage via **MySubscription** / **ManageKidsClub**: status, renew date, manage payment method (FLOW-12A), auto-renew, and cancel.
5. **Cancel** (`cancel-subscription` path) → **CancelSubscription** confirmation; at period end the user enters **grace** (configurable days; grace-aware resubscribe surfaces; SP handling per policy) then **expired** → **SubscriptionExpired** shows the plan-ended date and rejoin CTA.
6. Trial/grace reminders and conversion are driven by the reminder/conversion crons/EFs (FLOW-17/28); subscription status screens are reachable from push deep links.

**Mobile screens.**
- `JoinKidsClub` — `screens/subscription/JoinKidsClubScreen.tsx` — Kids Club+ join/landing (also registered as `SubscriptionChoice`, `KidsClubOverview`, `SubscriptionPlans`).
- `PlanComparison` — `screens/subscription/PlanComparisonScreen.tsx` — free vs Kids Club+ comparison.
- `ContinueKidsClub` — `screens/subscription/ContinueKidsClubScreen.tsx` — upsell/continue for free/trial/grace/expired (deep link `continue-kids-club`).
- `MySubscription` — `screens/subscription/MySubscriptionScreen.tsx` — current member status + renew details.
- `ManageKidsClub` — `screens/subscription/ManageKidsClubScreen.tsx` — full-screen subscription manager (deep link `manage-kids-club`; tab bar hidden here).
- `CancelSubscription` — `screens/subscription/CancelSubscriptionScreen.tsx` — cancel confirmation + consequences.
- `SubscriptionExpired` — `screens/subscription/SubscriptionExpiredScreen.tsx` — expired state with the real "plan ended on" date + rejoin CTA.
- `SubscriptionStatus` — `screens/subscription/SubscriptionStatusScreen.tsx` — status surface reachable via the `/subscription/status` push payload (deep-link/push-only).
- `UpgradePlan` — `screens/subscription/UpgradePlanScreen.tsx` — tier upgrade entry.
- `SubscriptionPayment` — `screens/subscription/SubscriptionPaymentScreen.tsx` — registered but no live caller [deprecated].
- `SubscriptionSuccess` — `screens/subscription/SubscriptionSuccessScreen.tsx` — registered but no live caller [deprecated].
- `TransactionHistory` — `screens/profile/TransactionHistoryScreen.tsx` — billing/subscription transaction history (deep link `billing-history`; the `subscription/BillingHistoryScreen.tsx` is an unrouted duplicate).
- `PaymentMethods` — `screens/profile/PaymentMethodsScreen.tsx` — saved payment methods (shared with FLOW-12A).

**Admin pages.**
- `/subscriptions` — subscription roster/status.
- `/subscriptions/manage` — subscription management (incl. actor identity fallback to `auth.users` when no profile row).

**Functions/features.** Edge Functions: `cancel-subscription`, `update-auto-renew`, `trial-conversion`, `trial-reminders`, `grace-period-cron` (reminder legs); RPCs: subscription lifecycle (`create_trial_subscription`, `upgrade_free_subscription_to_trial`, `create_free_subscription`, `increment_trial_uses`, `downgrade_trial_to_grace`, `convert_trial_to_active`), `renew-subscription` (service-role leg, FLOW-12A); DB: `subscriptions` (status trial/active/grace/cancelled/expired/free, `trial_ends_at`, `current_period_*`, `grace_period_ends_at`), `subscription_tiers`, `billing_history`, admin_config grace/member-fee keys; client fee helper `getActiveMemberFeeCents`.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SUB groups A–F: join/trial/grace/expired/manage/cancel); `docx/` subscription specs.

### FLOW-12A: Subscription Payment Collection (Stripe)

**Description.** The Stripe money path for Kids Club+: hosted checkout / PaymentSheet / setup-intent collection, payment-method attach/manage/detach, monthly renewal (webhook-driven, incl. initial billing row + period advance), failed-payment retry, and auto-renew control. The `stripe-webhook-subscriptions` webhook is the source of truth for billing history and renewal state (DT-88 fix: it subscribes to `invoice.payment_succeeded` and advances the DB period from the invoice line).

**Steps.**
1. **Purchase**: `create-checkout-session` (hosted Stripe Checkout, used by the web target `/join`) or the in-app PaymentSheet/`create-subscription-payment` path validates the price against the allowlisted tier `stripe_price_id`, derives trial server-side, and creates the subscription.
2. **Payment method**: `create-payment-setup-intent` / `attach-payment-method` persist the card on the Stripe customer and to `subscriptions`/`user_subscriptions`; `get-payment-method` reads it; `detach-payment-method` removes it. The client always force-refreshes after add so a stale card is never shown (DT-81).
3. **Webhook**: `stripe-webhook-subscriptions` handles `invoice.payment_succeeded` (writes `billing_history`, resets retry, restores status, advances the DB period window) and `customer.subscription.updated/deleted`; events are signature-verified and idempotent.
4. **Renewal**: on each cycle Stripe renews; the webhook records the row + advances dates; `renew-subscription` is the EF the DB uses to drive/repair renewal (service-role).
5. **Failure/retry**: `invoice.payment_failed` marks the payment failed and notifies; `retry-failed-payment` retries a saved method and records success (billing row + `last_payment_*`).
6. **Manage**: auto-renew toggle (`update-auto-renew`) and cancel-at-period-end flow (FLOW-12).

**Mobile screens.** Payment surfaces shared with FLOW-12:
- `PaymentMethods` — `screens/profile/PaymentMethodsScreen.tsx` — add/remove saved card.
- `ManageKidsClub` — embedded `PaymentMethodSection` (manage payment method + renew gate).
- `TransactionHistory` — `screens/profile/TransactionHistoryScreen.tsx` — billing history readout.
- Checkout/offer screens — embedded payment-method + "Add New Card" flows.

**Web target.** `p2p-kids-web` `/join` page + `/api/checkout` → hosted Checkout (`create-checkout-session`).

**Functions/features.** Edge Functions: `create-checkout-session`, `create-subscription-payment`, `setup-subscription-payment`, `create-payment-setup-intent`, `attach-payment-method`, `detach-payment-method`, `get-payment-method`, `renew-subscription`, `retry-failed-payment`, `cancel-subscription`, `update-auto-renew`, `stripe-webhook-subscriptions`; DB: `subscriptions`, `billing_history`, `subscription_events`, `stripe_customer_id`/`stripe_payment_method_id`, initial-billing gate on status transition.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SUB-015 payment collection, renewal/failure groups); `docx/` subscription specs; web subscription smoke (QA Task 21).

---

### FLOW-13: Referrals

**Description.** The referral program: a member gets a referral code, shares it, and when a new user signs up with it both parties earn SP rewards (with listing/trade-based incentives and abuse checks). The referral dashboard shows code, status, and earned rewards.

**Steps.**
1. A qualified user views **ReferralDashboard** and gets/copies their unique referral code.
2. They share the code/link with a new signup.
3. The new user applies the code at signup (or via a deep link); `apply_referral_code` validates it (no self-referral, single use, abuse rules).
4. On qualifying actions (signup, first listing, first trade) the referral rewards are awarded to both parties (`award_referral_sp`, `award_listing_referral_sp`) with notifications.
5. The dashboard reflects updated reward state; admins see program config/usage.

**Mobile screens.**
- `ReferralDashboard` — `screens/referrals/ReferralsScreen.tsx` — referral code, share, and reward status (deep link `referrals`).

**Admin pages.**
- `/referrals` — referral program config/roster (driven by `sp_config`, not stale `admin_config` keys).

**Functions/features.** Client: `services/referral.ts`, `referralCodeV2.ts`, `referralRewards.ts`, `referralNotifications.ts`; RPCs: `apply_referral_code`, `award_referral_sp`, `award_listing_referral_sp`; DB: `referrals`, `sp_config` referral keys.

**References.** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (referral groups); `docx/` referral requirements.

### FLOW-14: Messaging (Realtime)

**Description.** Real-time buyer↔seller messaging for active/interest contexts: the conversations inbox and the per-trade chat. Messages are stored server-side, delivered over Realtime, and drive unread badges on the header and inbox. Chat is trade-scoped and supports delivery status/typing affordances via the chat service.

**Steps.**
1. The buyer/seller opens a conversation from the inbox (`InboxTab`/`Conversations`) or the trade timeline chat entry.
2. `Chat` loads the message thread; new messages are sent through the chat service and appear via the Realtime channel (in-place update, no full reload).
3. Opening a conversation marks its messages read (`mark_trade_messages_read`), clearing the unread badge (header bell + inbox).
4. A seller can start a conversation about a listing; buyers reach chat from an accepted trade or an offer context.
5. Idle/cleanup maintenance and message email fallbacks run in the background (see FLOW-28).

**Mobile screens.**
- `InboxTab` / `Conversations` — `screens/messaging/ConversationsListScreen.tsx` — conversation list with unread indicators (live; `screens/messaging/ConversationsScreen.tsx` is an unrouted stub).
- `Chat` — `screens/messaging/ChatScreen.tsx` — realtime message thread (deep link `chat/:tradeId`).

**Functions/features.** Client: `services/chat.ts`, `services/notifications.ts` (badges); RPC: `mark_trade_messages_read`; DB: `messages` in the Realtime publication, per-user read state; Edge Functions: `send-message-email`, `cleanup-messages`; QA: `qa:ef-repro --notify` + unread fixture (P03).

**References.** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (MSG groups); `docx/` messaging requirements.

### FLOW-15: Safety, Moderation & Content Review

**Description.** Content safety and moderation of listings and media: AI image moderation (Google Vision via `analyze-item-image`/`batch-analyze-items`/`moderate-image`), **CPSC product-recall** matching + the daily recall import, listing flagging/moderation states (flagged / needs-edits / rejected), the seller appeal/re-review loop, and critical safety alerts. It is the "is this listing safe to publish/stay live" backbone; seller listing lifecycle is FLOW-04, trust/identity of users is FLOW-21.

**Steps.**
1. **Image moderation**: when a seller uploads item photos, the client runs image analysis; results (labels/categories/safety verdict) are stored with the listing. A failing/uncertain verdict blocks auto-publish or routes the item to the moderation queue.
2. **Recall check**: published/new items are matched against the CPSC recall database (`check-item-safety`); a recall match triggers moderation/removal and a **critical safety alert** (recall alerts are delivered regardless of notification preferences).
3. **Recall import**: `import-cpsc-recalls` (daily batch) pulls the CPSC feed into the recall database so matching stays current.
4. **Moderation**: admins review the flagged queue (`/items/flagged`) and approve or remove; they can also request edits or reject a listing, setting `needs_edits`/`rejected`.
5. **Seller response**: the affected seller opens **ListingSafetyReview** (FLOW-04) to see the reason, remove the listing, submit an appeal, or request re-review after edits.
6. Outcomes emit notifications to the seller and (for recall) to affected parties.

**Mobile screens.**
- `ListingSafetyReview` — `screens/listing/ListingSafetyReviewScreen.tsx` — the seller-side surface for flagged/rejected/needs-edits listings (appeal/remove/re-review). (Full listing lifecycle: FLOW-04.)
- Moderation status and recall copy also surface on listing/notification surfaces (FLOW-04/06/17).

**Admin pages.**
- `/items/flagged` — moderation queue for flagged/unsafe items.
- `/listings`, `/items/[id]` — full listing moderation/detail (FLOW-04/18).

**Functions/features.** Edge Functions: `analyze-item-image`, `batch-analyze-items`, `moderate-image`, `check-item-safety`, `import-cpsc-recalls`; DB: `cpsc_recalls`, item moderation columns/statuses, `recall_alert` notification type; client: `services/imageModeration.ts`, `aiService.ts`, `safety.ts`; admin_config safety/moderation toggles.

**References.** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (safety/moderation groups); `docx/` SAFETY specs (SAFETY-002 recall, SAFETY-004 image moderation).

### FLOW-16: Home Dashboard

**Description.** The post-login home (Home tab): a personalized dashboard greeting the user (G01), surfacing their membership/SP status, badge showcase, identity-verification CTA, promotions (membership/grace-aware), and quick links. It is the default landing after session restore and onboarding.

**Steps.**
1. After auth, the user lands on the Home tab (route `Home` renders `UserDashboardScreen` via the tab navigator).
2. The dashboard loads the profile greeting, subscription/SP strip (free vs Kids Club+; grace treated as member), badge showcase, and any CTA banners (e.g., ID verification when unverified).
3. Promo cards are state-aware: non-members see a join CTA; grace-period members see a "Renew to keep benefits" → Manage Kids Club path.
4. Content that exceeds the fold is reachable via show-more affordances; each tile links to its feature (Profile, Trades, Discover, Sell, etc.).

**Mobile screens.**
- `Home` — `screens/dashboard/UserDashboardScreen.tsx` — the personalized dashboard (Home tab; `navigation/HomeTabNavigator.tsx` renders it; the floating pill nav is the real app nav).

**Functions/features.** Client: `screens/dashboard/UserDashboardScreen.tsx` + its data hooks (profile, subscription/SP strip, badges, promos); state-aware promo logic shared with FLOW-12.

**References.** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (FLOW-16 dashboard groups, G01 greeting, G07 reachability); `docx/app-overview.md`.

---

### FLOW-17: Notifications

**Description.** All user notifications: in-app Notification Center, push (Expo/APNs), email (with unsubscribe), and per-category preferences. Notification categories cover trades, messaging, subscriptions (renewal/cancel/payment-failure/trial/grace reminders), SP, badges, referrals, ID-verification decisions, and critical safety (recall) alerts — which are always delivered. Every notification carries a deep link that routes to the relevant screen.

**Steps.**
1. Events fire server-side (trade state changes, subscription webhooks, reminders, badge/referral/ID events) and produce rows in `user_notifications` with `channels` (`push`/`in_app`/`email`), a category/type, and a deep link.
2. Push delivery: `send-push-notification` fans out to registered Expo tokens (respecting quiet hours/rate limits and per-category preferences, except mandatory safety alerts).
3. The header bell shows unread counts; **Notification Center** lists notifications grouped by type with read/unread handling; tapping one routes via its deep link.
4. Users manage categories and channels in **Notification Preferences** (email/push/in-app per type); the app prompts to **enable push** on first run.
5. Email notifications include an unsubscribe path (`Unsubscribe`); preference state is stored server-side and honored by the senders.
6. QA can simulate push/rate-limit/quiet-hours and preference-save failures via dev toggles.

**Mobile screens.**
- `Notifications` — `screens/notifications/NotificationCenterScreen.tsx` — in-app notification center (deep link `notifications`).
- `NotificationPreferences` — `screens/profile/NotificationPreferencesScreen.tsx` — per-category channel toggles (live; `screens/notifications/NotificationSettingsScreen.tsx` is an unrouted duplicate).
- `NotificationSetup` — `components/NotificationSetup` — enable-push onboarding prompt (full-screen route).
- `Unsubscribe` — `screens/UnsubscribeScreen.tsx` — email unsubscribe (deep link `unsubscribe`).

**Functions/features.** Edge Functions: `send-push-notification`, `send-trade-notifications`, `send-email`, `email-unsubscribe`, `grace-period-cron`, `trial-reminders`, `send-offer-reminders`, `send-auto-complete-reminders`, `send-pickup-reminders`, `id-badge-notifications`, `award-tenure-badges`; DB: `user_notifications`, `notification_preferences`, triggers that create notification rows; client: `services/notifications.ts`, `notificationPreferences.ts`, `pushDelivery.ts`, `badgeNotifications.ts`, `referralNotifications.ts`, `subscriptionNotifications.ts`, `tradeNotifications.ts`, `emailNotifications.ts`, `notificationAnalytics.ts`; QA toggles (`qa_push_simulation`, `qa_force_pref_save_failure`).

**References.** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (notification groups) + subscription guide (subscription-event notifications).

### FLOW-18: Admin Controls & Configuration

**Description.** The admin portal's core management and configuration surface (mobile admins also get a lightweight dashboard). It includes the **Action Center** (disputes, buyer cancel-requests, payout overrides), platform **config & settings** (fee/tax/cart/trade-timing/policies), **category management** (CRUD, SP config, suggestions), and deep links to the per-domain admin pages owned by other flows (listings, users, trades, reviews, payouts, subscriptions, education, id-badges, monitoring). Admin writes go through audited RPCs (`upsert_admin_config_setting`) and are protected by the admin-auth middleware + RBAC.

**Steps.**
1. An admin signs in on `/auth/login`; the admin-auth middleware + `x-admin-secret`/JWT protect every `/api/admin/*` call (client sends the header, BP-49).
2. Admins use the **Action Center** to resolve disputes/cancel requests (refund/keep) and approve payout overrides (FLOW-27/25), with every action audited (FLOW-20).
3. Configuration pages read `admin_config`/`sp_config`; saves route through `upsert_admin_config_setting`, recording the editor + `updated_at` (forward-only where required, e.g. min-price).
4. Category management lets admins CRUD categories, set per-category SP spending caps (50–80) and bonus multipliers, and approve suggested categories.
5. Domain queues (listings/users/trades/reviews/payments/subscriptions/id-badges/education/monitoring/audit) are cross-referenced from their owning flows.

**Mobile screens.**
- `AdminDashboard` — `screens/admin/AdminDashboardScreen.tsx` — mobile admin dashboard for admin users (Profile → Admin dashboard).
- `ReviewModeration` — `screens/admin/ReviewModerationScreen.tsx` — mobile review-moderation surface (registered route; review moderation is primarily the admin `/reviews` page — FLOW-21).
- `TrialConversionTest` — `screens/admin/TrialConversionTestScreen.tsx` — dev/test surface for trial conversion.
- (`screens/admin/ModerationQueueScreen.tsx`, `screens/admin/NodeManagementScreen.tsx`, `screens/admin/TrialExtensionTestScreen.tsx` are unrouted stubs.)

**Admin pages (portal).**
- `/auth/login` — admin sign-in.
- `/` + `/action-center` — admin home + Action Center (disputes, cancel-requests, payout overrides).
- `/config` — platform configuration.
- `/settings/trade-timing`, `/settings/cart`, `/settings/policies` (+ `/settings/policies/[id]`, `new`, `edit`) — settings areas (trade timing incl. cancel-request config; cart config; policy content).
- `/categories` — category CRUD + SP configuration + suggestion approval.
- Domain pages (owned elsewhere): `/listings`, `/items*`, `/users`, `/trades*`, `/disputes*`, `/reviews`, `/payments`, `/payouts*`, `/subscriptions*`, `/education*`, `/id-badges*`, `/nodes*`, `/waitlist`, `/monitoring*`, `/audit*`, `/referrals`, `/analytics*`, `/support*`.

**Functions/features.** Admin auth middleware + `role_based_access_control`, `user_has_role()`/`admin_has_role()`/`is_admin(uuid)`; RPCs: `upsert_admin_config_setting`, `secure_upsert_admin_config`, `fn_get_admin_config_values`, `admin_approve_listing`, `admin_force_delete_listing`, `admin_pause_listing`, user-lifecycle RPCs (`admin_suspend_user`, `admin_unsuspend_user`, `admin_delete_user`, `admin_reset_trial_uses`), `fn_admin_list_cancel_requests`, `admin_trade-action` EF; client `services/adminConfig.ts` (+ `services/admin/**`).

**References.** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM groups N/P/category/trade/config); `docx/ADMIN-CATEGORY-MANAGEMENT.md`.

### FLOW-19: Trading Education, Help & Support, SP Calculator

**Description.** In-app education and support: onboarding/help content (including "How to earn SP"), the FAQ/help center, a contact-support flow (reachable logged-in and logged-out), and the SP Calculator used to show earning scenarios. Admins manage education content and answer support tickets from the portal.

**Steps.**
1. Users reach Help & Support from Profile → `HelpSupport` menu: FAQ, education content, contact support.
2. FAQ: browse/expand published FAQs (`Support` route renders the FAQ screen; `FAQDetail` shows an article).
3. Education: `Help` renders education content (e.g., how SP earning works); the **SP Calculator** demonstrates category/spend scenarios (`spCalculatorService`).
4. Contact support: `ContactSupport` submits a ticket (in-app); support agents respond from the admin portal (`/support`), with reply notifications/email.
5. Admins manage education content + FAQs via the education CMS (`/education`, `/education/faq`) and view education analytics (EDU-001).

**Mobile screens.**
- `HelpSupport` — `screens/support/HelpSupportMenuScreen.tsx` — Help & Support menu (from Profile).
- `Support` — `screens/support/HelpScreen.tsx` — published-FAQ list screen (route `Support`; note the two different `HelpScreen` files).
- `FAQDetail` — `screens/support/FAQDetailScreen.tsx` — FAQ article detail.
- `ContactSupport` — `screens/support/ContactSupportScreen.tsx` — contact-support form (also reachable logged-out).
- `Help` — `screens/help/HelpScreen.tsx` — education help content (e.g., earning SP).
- SP Calculator — rendered within education content/help (no standalone route; `services/spCalculatorService.ts` backs it).

**Admin pages.**
- `/education` + `/education/faq` — education content & FAQ CMS.
- `/support` + `/support/[id]` — support-ticket queue and thread.
- Education analytics — EDU-001 analytics (education usage).

**Functions/features.** Client: `services/educationContentService.ts`, `educationExampleService.ts`, `educationAnalyticsService.ts`, `faqService.ts`, `spCalculatorService.ts`; admin content APIs; ticket APIs (`/api/support/[id]/reply`).

**References.** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (FLOW-19 help/FAQ/support/SP calculator groups); `docx/TRADING-EDUCATION-REQUIREMENTS.md`.

### FLOW-20: Audit & Logging

**Description.** The audit trail for security- and money-critical actions: admin config writes (editor recorded), admin user-lifecycle actions, trade/refund/payout admin actions, and platform audit events are written to the admin audit tables and are reviewable in the portal. This is the compliance backbone referenced by every admin money/control action.

**Steps.**
1. A privileged action (config save, listing approve/remove, user suspend/delete, trade force-cancel/refund, payout override) executes through an audited path that inserts an `admin_audit_log(s)` row with actor.
2. Admin config writes always go through `upsert_admin_config_setting`, which records the editor id + timestamp (BP-48).
3. Admins review the trail on the audit pages; RLS keeps audit rows admin/service-role only (mobile self-insert only for the user's own `admin_audit_logs` action).
4. Background/cron runs that touch money/state also write run records (auto-complete, extension timeouts) — see FLOW-28.

**Mobile screens.** None (audit is server + admin-portal).

**Admin pages.**
- `/audit` — audit events browser.
- `/audit-logs` — detailed admin audit log.

**Functions/features.** DB: `admin_audit_log`/`admin_audit_logs` (RLS admin/service-role), `user_has_role()` helper, RBAC (`role_based_access_control`); client `writeAuditLog` (mobile admin self-insert); run-record tables (`auto_complete_runs`, etc.).

**References.** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (audit groups); `docx/` security/audit specs.

---

### FLOW-21: ID Verification, Badges & Reputation (public seller profile + reviews)

**Description.** Everything that answers "who is this person and can I trust them": government-ID verification (submit → admin review → decision), the verified/trust indicators, badges & achievements (with tenure awards and showcase on Profile/SellerProfile/Dashboard), the **public seller profile**, and the **reviews** system (submit after a trade, display on the seller profile, and admin moderation). This is the identity/reputation layer the trade and discovery flows surface (verified pills, badge rows, review counts).

**Steps.**
1. **ID verification**: a user submits their ID from `IDVerificationUpload` (`id-badge-verification-requests`); admins review in the portal queue (`/id-badges`, `review`, `details`); approval marks the identity verified (verified pill/trust level) and notifies the user (decision/message notifications).
2. **Badges**: badges are earned/auto-awarded (e.g., tenure via `award-tenure-badges`) and shown on Profile, the public Seller Profile, and the Home dashboard; a badge-detail modal explains each badge; a badge showcase links to the full Badges grid.
3. **Public seller profile**: `SellerProfile` (deep link `seller-profile/:userId`) shows the seller's name/photo, verified/trust pill (from ID verification), badge showcase, **reviews**, and their items; discovery surfaces link here.
4. **Reviews**: after a trade completes (FLOW-08) the buyer/seller is prompted to submit a review (`SubmitReview`, deep link `submit-review`); reviews render on the seller profile; admins moderate abusive reviews on `/reviews`.
5. **Trust in trade UI**: Review Offer / Item Detail render verified/trust signals so counterparties can judge before transacting.

**Mobile screens.**
- `IDVerificationUpload` — `screens/profile/IDVerificationUploadScreen.tsx` — submit ID for verification (deep link `id-verification-upload`).
- `SellerProfile` — `screens/profile/SellerProfileScreen.tsx` — public seller profile: verified/trust pill, badges, reviews, items (deep link `seller-profile/:userId`).
- `Badges` — `screens/profile/BadgesScreen.tsx` — all badges grid (earned/locked) + detail modal (deep link `badges`).
- `SubmitReview` — `screens/review/SubmitReviewScreen.tsx` — post-trade review form (deep link `submit-review`).
- Review/badge surfaces are embedded in `ProfileScreen` (showcase), `UserDashboardScreen` (showcase + ID CTA), `ItemDetailScreen` (verified seller), and `ReviewOfferScreen` (buyer trust).

**Admin pages.**
- `/id-badges` + `/id-badges/[requestId]/review` + `/id-badges/[requestId]/details` + `/id-badges/messages` — ID verification queue, review, details, and applicant messaging (decision/notification leg).
- `/reviews` — review moderation (approve/remove abusive reviews).

**Functions/features.** Client: `services/idBadge.ts`, `services/badges.ts`, `badgeUtils.ts`, `badgeNotifications.ts`, `review.ts`; Edge Functions: `id-badge-notifications`, `id-badge-submission-notification`, `award-tenure-badges`, `badges-update-icon`; DB: `id_badge_verification_requests`, `user_badges`/`badges`, `reviews`, `review_reports`; verification display RPCs; moderation copy helpers.

**References.** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (badges + ID-verification groups, B01–B03, I03) + account guide (ID CTA); `docx/` MODULE-08 reviews + badge specs.

### FLOW-22: Seller Payouts & Withdrawals

**Description.** Turning seller earnings into money out: the payout settings surface (balance hero, payout methods, withdraw, history) plus the Stripe Connect onboarding that makes payouts possible. Balances are gross with provider fees disclosed; withdrawals are requests processed by the payout engine; `requires_action` rows prompt method setup. This is the seller money-out counterpart to FLOW-09/27 inflows.

**Steps.**
1. A seller sets up a payout method (Stripe Connect / bank / PayPal / Venmo) from **PayoutSettings** (deep link `payout-settings`, also the cold-return target after hosted Stripe onboarding).
2. **Stripe Connect** sellers complete hosted onboarding via `create-stripe-account-link` (Continue Onboarding card shows while `stripe_account_id && !onboarding_complete`); status syncs via `sync-stripe-connect-status`.
3. The hero shows Available/Pending/Lifetime (gross) with a fee-disclosure note; on each completed trade a `seller_payouts` row is queued (pending) by the completion path (FLOW-08) with release timing.
4. **Withdraw**: the seller requests a withdrawal for available funds (`request_seller_payout` path); the Withdraw modal shows the payout provider fee; an unverified method is blocked with friendly copy (see FLOW-23).
5. **Processing**: due payouts are released by the cron/EF (`release-due-payouts` → `initiate-payout`/`process-paypal-payout`), transfers are recorded (`payout_status=paid`, `stripe_transfer_id`), and history rows update with provider fee/net.
6. History supports load-more pagination; `requires_action` rows offer "Set Up Payout Method" to resume.

**Mobile screens.**
- `PayoutSettings` — `screens/seller/PayoutSettingsScreen.tsx` — balance hero, payout-method cards, Add Payout Method + Withdraw modals, payout history (live; deep link `payout-settings`).
- `RequestPayout` — `screens/payouts/RequestPayoutScreen.tsx` — registered but no live caller [deprecated DT-86].
- `SellerEarnings` — `screens/seller/SellerEarningsScreen.tsx` — registered but no live caller [deprecated DT-86].
- `PayoutDashboard` — `screens/payouts/PayoutDashboardScreen.tsx` — unrouted (superseded by PayoutSettings).

**Functions/features.** Edge Functions: `create-stripe-connect-account`, `create-stripe-account-link`, `sync-stripe-connect-status`, `payout-settings-redirect`, `initiate-payout`, `process-paypal-payout`, `release-due-payouts` (cron), `dispatch-manual-payouts`; RPCs: `create_seller_payout_on_trade_completion`, `recompute_seller_balance` (service_role), `request_seller_payout`, `set_primary_payout_method`; DB: `seller_payout_methods`, `seller_payouts`, `seller_balance`, `trades.payout_*`; client: `services/payoutMethods.ts`, `payoutService.ts`, `payoutRouter.ts`, `sellerBalance.ts`; QA: `qa:payout-fixture` persona + runbook.

**Admin pages.**
- `/payouts` — payout records/operations (see FLOW-25).
- `/payouts/earnings` — seller earnings detail (see FLOW-25).

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (payout groups G06, K, withdraw/lifecycle); seller-payout specs under `docx/`.

### FLOW-23: Payout Method Verification

**Description.** Verifying a seller's payout destination before money can leave: bank, PayPal, Venmo, and Stripe Connect onboarding. A method must be verified to be withdrawable; the UI surfaces verification state and clear next steps instead of raw errors.

**Steps.**
1. The seller adds a payout method and completes its verification (Stripe Connect hosted onboarding, PayPal email/handle confirmation, bank details).
2. Methods carry `is_verified`/onboarding state; the primary method is selectable.
3. Attempting to withdraw on an unverified method is blocked with friendly copy ("Your payout method isn't verified yet…"), surfacing the verify action.
4. Admin/support can diagnose method state (payout provider, onboarding status) from payout records.

**Mobile screens.**
- `PayoutSettings` — `screens/seller/PayoutSettingsScreen.tsx` — method cards + verification state + Add Payout Method modal (Stripe Connect/bank/PayPal/Venmo).

**Functions/features.** RPCs/EFs: `set_primary_payout_method`, `sync-stripe-connect-status`, `create-stripe-connect-account`; DB: `seller_payout_methods` (`is_verified`, `stripe_account_id`, `stripe_onboarding_complete`); provider-name helper `getPayoutProviderName`.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (payout method groups); seller-payout specs under `docx/`.

### FLOW-24: MFA / Multi-Factor Enrollment — post-MVP (planned)

**Description.** **Post-MVP (planned)** — specified (assurance-level gating) but not implemented in this codebase. No screens, RPCs, or Edge Functions exist yet. Tracked here so the planned scope is explicit; do not add "MFA live" claims to any flow until this section is rewritten with real surfaces.

**References.** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (FLOW-24 MFA — planned).

---

### FLOW-25: Manual/Admin Payout Processing

**Description.** The admin side of seller payouts: reviewing payout records/earnings, correcting payout state, and dispatching payouts manually when automated processing needs an override (provider failures, disputes, manual review). Every override is audited.

**Steps.**
1. An admin opens `/payouts` (records, statuses, provider fees) or `/payouts/earnings` (per-seller earnings detail).
2. When a payout is stuck/needs manual dispatch (or an override is approved), the admin triggers processing (`dispatch-manual-payouts` / payout-request paths); the action is recorded.
3. Payout config (provider fee rate etc.) is editable on the payout fee-config surface (ADM-TC-K01) and honored by the payout engine.
4. Admin payout actions surface in the Action Center alongside disputes/cancel-requests (FLOW-27) and are audited (FLOW-20).

**Admin pages.**
- `/payouts` — payout records + manual processing.
- `/payouts/earnings` — earnings detail.
- `/action-center` — payout overrides/requests queue.

**Functions/features.** Edge Functions: `dispatch-manual-payouts`, `initiate-payout`, `process-paypal-payout`; RPCs/DB: `seller_payouts` state transitions, `payout_*` columns on trades, audit rows; fee config via admin config.

**References.** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM payout groups, K01) + subscription/payout guide (FLOW-25).

### FLOW-26: Webhook Processing & Verification

**Description.** Inbound provider webhooks (Stripe subscriptions, Stripe payments, PayPal, email) — signature verification, idempotent processing, and the state/billing writes they drive. This is the reliable-delivery backbone for subscriptions (renewals), payment capture, refunds, and payout notifications; any gap here shows up as stale DB state (e.g., the DT-88 renewal fix).

**Steps.**
1. A provider posts an event to the configured endpoint (public, `verify_jwt=false`; authenticity via provider signature/HMAC).
2. The handler verifies the signature, then processes the event idempotently (replays/out-of-order safe).
3. `stripe-webhook-subscriptions` handles `invoice.payment_succeeded` (billing row + period advance), `customer.subscription.updated/deleted`, and payment-failure events (FLOW-12A).
4. Payment/refund webhooks update trade payment state; PayPal webhooks drive payout state; email webhooks handle bounce/unsubscribe.
5. Failures are logged and surfaced in monitoring so a missed event can be repaired (FLOW-28).

**Mobile screens.** None.

**Admin pages.** `/monitoring` — webhook/function health (see FLOW-28).

**Functions/features.** Edge Functions: `stripe-webhook-subscriptions`, `stripe-webhook`, `paypal-webhook`, `email-webhook`; event-subscription config (which Stripe events are enabled), signature verification helpers, idempotency keys/guards.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (FLOW-26 webhook cases) + `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (monitoring).

### FLOW-27: Refunds & Cancellations

**Description.** The money/state machine for ending a trade with money movement: buyer-initiated **Request to Cancel** on in-progress trades (seller approve → refund, seller decline/no-response → admin escalation), seller instant cancel (with TFV2-023 consequences), offer decline/expiry, payment-hold failures, authorization expiry, and **dispute resolution** refunds. Rules: uncaptured authorizations are voided (never refunded); captured payments are refunded proportionally with sales tax and SP reversals; seller payout is withheld/restored appropriately.

**Steps.**
1. **Buyer cancel request**: on an in-progress trade the buyer submits a Request to Cancel (`fn_request_cancel_trade`). The seller sees an Approve/Decline card on the timeline.
2. **Approve** → `cancel-trade` (with the `cancel_request_id`) cancels and refunds the buyer without seller penalty; **Decline** escalates to admin.
3. **Auto-escalation**: if the seller doesn't respond within the configurable window (default 48h), `fn_escalate_expired_cancel_requests` (cron, every 10 min) escalates the request.
4. **Admin resolution**: Action Center or the trade detail shows Cancel Requests; the admin chooses **Approve Cancel & Refund** (money path) or **Keep Trade**.
5. **Seller instant cancel** applies TFV2-023 consequences (fee/SP impact); declined/expired offers restore the item; payment failures release the hold.
6. **Disputes**: an issue report (`open-dispute`) pauses auto-complete and notifies admin; `resolve-dispute` closes it — buyer-favor resolutions refund if captured, or record "no payment taken" if the auth was never captured.
7. **Money correctness**: refunds void uncaptured auths (synthetic `stripe_refund_id` idempotency guard), refund captured payments + proportional tax, reverse SP, and update the seller payout state; refunds are recorded (`trade_refunds`, payments state, tax void).

**Mobile screens.**
- `TradeTimeline` — `screens/trade/TradeTimelineScreen.tsx` — buyer Request to Cancel button + pending/escalated/resolved cards; seller Approve/Decline card; cancel/refund reason copy; dispute banners (FLOW-08).
- `CancellationReasonModal` — shared cancel-reason selection.
- Trade list rows — declined/expired states (FLOW-08).

**Admin pages.**
- `/action-center` — Cancel Requests + disputes queue.
- `/trades/[id]` — Approve Cancel & Refund / Keep Trade panel on the trade detail.
- `/disputes` + `/trades/disputes/[tradeId]` — dispute resolution records.

**Functions/features.** Edge Functions: `cancel-trade` (cancel-request-aware), `trade-refund`, `resolve-dispute`, `open-dispute`, `admin-trade-action` (force-cancel); RPCs: `fn_request_cancel_trade`, `fn_withdraw_cancel_request`, `fn_respond_cancel_request`, `fn_escalate_expired_cancel_requests`, `fn_resolve_cancel_request`, `fn_admin_list_cancel_requests`, `cancel_trade_v2`, `complete_trade_v2`, `rpc_record_payment_refund`; DB: `cancel_request_*` columns on `trades`, `cancel_request_escalation_runs`, trade/payment/tax refund rows; admin_config keys (`cancel_request_escalation_enabled`, `cancel_request_response_timeout_hours`); notifications (cancel-request types).

**References.** `docx/BUYER-CANCEL-REQUEST-SPEC.md` + `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (Group Z, refund/cancel Group R) + `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM dispute/cancel groups).

### FLOW-28: Cron & Background Jobs

**Description.** All scheduled maintenance and time-driven behavior via pg_cron → Edge Functions: trade timing (offer expiry, auto-complete, auto-complete/pickup reminders, extension timeouts), escalation of cancel requests, due payout release, subscription trial/grace reminders, CPSC recall import, message cleanup/email, and notification reminder jobs. The admin portal exposes job runs and alerts for observability.

**Steps.**
1. pg_cron schedules fire each job on its cadence and invoke the corresponding Edge Function/RPC.
2. Trade jobs advance state: expire unanswered offers (`process-expired-offers`), auto-complete eligible trades (`process-auto-complete`), fire auto-complete/pickup reminders, and time out extensions (`process-extension-timeouts`).
3. Escalation/release jobs: `escalate-cancel-requests` (every 10 min), `release-due-payouts` (due seller payouts), `release-pending-sp`.
4. Subscription jobs: trial reminders, grace-period-daily reminders, trial conversion handling.
5. Safety/ops jobs: CPSC recall import (`import-cpsc-recalls`), message cleanup + message-email delivery, ID/badge award jobs as scheduled.
6. Admins inspect run history and alerts on the monitoring pages; a failed job is repaired without user-visible impact.

**Admin pages.**
- `/monitoring` — background job runs/alerts (money/state function health).
- `/monitoring/cron` — cron schedule status.

**Functions/features.** pg_cron jobs → Edge Functions/RPCs: `process-expired-offers`, `process-auto-complete`, `process-extension-timeouts`, `send-auto-complete-reminders`, `send-pickup-reminders`, `send-offer-reminders`, `escalate-cancel-requests`, `release-due-payouts`, `release-pending-sp`, `trial-reminders`, `grace-period-cron`, `import-cpsc-recalls`, `cleanup-messages`, `send-message-email`, `check-trade-notifications`, `award-tenure-badges`; run-record tables + `debug_logs`.

**References.** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM monitoring groups, V01); `docx/` cron/EF specs.

---

### FLOW-30: SP Wallet Admin Operations

**Description.** Admin tooling for the SP economy: viewing and adjusting a user's SP wallet, freezing/unfreezing SP, overriding state, and configuring economy rules (caps, multipliers, expiry) with economy analytics. Guarded to service_role/admin only.

**Steps.**
1. Admins open `/sp-wallet` to inspect a user's wallet state (available/pending/frozen) and adjust on authorized request (support/refund corrections).
2. Wallet-state controls (`admin_toggle_sp_wallet_status`, wallet state RPCs) are service-role/admin-only and audited.
3. Economy configuration (per-category caps, multipliers, expiration) is edited on `/sp-economy`; analytics on `/sp-analytics`.
4. All adjustments respect the ledger invariants (no negative balances, append-only ledger).

**Mobile screens.** None (admin-only).

**Admin pages.**
- `/sp-wallet` — wallet lookup/adjust (admin).
- `/sp-economy` — SP formula/cap/multiplier configuration.
- `/sp-analytics` — SP economy analytics.

**Functions/features.** RPCs: `adjust_sp_wallet`, `admin_toggle_sp_wallet_status`, `rpc_set_sp_wallet_state`, `initialize_sp_wallet`/`ensure_sp_wallet_exists`; DB: `sp_ledger` append-only, wallet state; category SP config keys.

**References.** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (FLOW-30 SP admin) + `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`.

### FLOW-31: Terms of Service (TOS)

**Description.** The admin-managed, versioned Terms of Service: content is published from the admin portal; the app renders it (mobile + web), tracks acceptance against the current published version, and soft re-prompts users when a new version is published (decline lets them continue; the prompt returns next launch).

**Steps.**
1. Admins author/version TOS content in `/settings/policies` and publish a new effective version.
2. The mobile **TermsOfService** screen renders the current policy with version badge + "Last updated" (UTC-safe formatting).
3. Acceptance is tracked against the current published version only (`has_accepted_current_policy`); drafts are ignored.
4. On launch (authenticated, post-onboarding), `PolicyReacceptanceGate` routes users who haven't accepted the current version into acceptance mode once per session; accept/decline behavior is a soft gate.
5. Signup/onboarding flows embed an accept step; QA can simulate no-policy/fetch-failure states via a dev toggle.

**Mobile screens.**
- `TermsOfService` — `screens/profile/TermsOfServiceScreen.tsx` — current TOS + acceptance (route + unauth access).
- `PolicyReacceptanceGate` — mounted in `AppNavigator` (re-prompt logic).

**Admin pages.**
- `/settings/policies` (+ `new`, `[id]`, `[id]/edit`) — versioned legal-content management (TOS/Privacy/Disclaimer).

**Functions/features.** DB: `platform_policies`; RPC: `has_accepted_current_policy`; client: `services/tos.ts`, `utils/policyDate.ts`; QA toggle `qa_local_policy_failure`.

**References.** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (J-group TOS cases); `docx/` SAFETY-010 spec.

### FLOW-32: Privacy Policy

**Description.** The admin-managed, versioned Privacy Policy (same system as TOS): published from the portal, rendered in-app, acceptance tracked, soft re-prompt on new versions. Mirrors FLOW-31 mechanics with its own policy content and screen.

**Steps.**
1. Admins publish/version the Privacy Policy in `/settings/policies`.
2. The mobile **PrivacyPolicy** screen renders the current version with badge + safe "Last updated" date.
3. Acceptance is tracked per published version; the soft-gate re-prompt applies when a new version ships.
4. The profile/settings surface links to Privacy Policy; signup includes acceptance.

**Mobile screens.**
- `PrivacyPolicy` — `screens/profile/PrivacyPolicyScreen.tsx` — current policy + acceptance (route + unauth access).

**Admin pages.** `/settings/policies` — same legal CMS as FLOW-31/33.

**Functions/features.** DB: `platform_policies`; client: `services/privacyPolicy.ts`, `utils/policyDate.ts`; acceptance RPC as FLOW-31.

**References.** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (J-group privacy) ; `docx/` SAFETY-011 spec.

### FLOW-33: Liability Disclaimer

**Description.** The liability disclaimer content (admin-managed, same system) plus the in-flow **disclaimer accept gate** buyers pass before making a cash/offer trade. The screen renders the current disclaimer; the gate requires checking "I have read and understand" before Accept.

**Steps.**
1. Admins publish/version the Liability Disclaimer in `/settings/policies`.
2. The **LiabilityDisclaimer** screen renders current content.
3. Before a trade offer/purchase the **DisclaimerModal** gate requires explicit acknowledgment; the Accept button stays disabled until the checkbox is checked; errors surface inline with retry.
4. Acceptance is tracked and re-required if the published disclaimer changes.

**Mobile screens.**
- `LiabilityDisclaimer` — `screens/settings/LiabilityDisclaimerScreen.tsx` — current disclaimer content.
- Disclaimer gate — shared `DisclaimerModal` (used by offer/checkout paths — see FLOW-08).

**Admin pages.** `/settings/policies` — same legal CMS.

**Functions/features.** DB: `platform_policies`; client: `utils/policyDate.ts`; DisclaimerModal gate state (AX-exposed); QA toggle `qa_local_policy_failure`.

**References.** `cross-checked-and-consolidated/` account/legal guide (J-group disclaimer) + trade guide (disclaimer-accept cases); `docx/` SAFETY-012 spec.

---

## Part B — Engineering & Compliance (non-user flows)

Release-readiness, security, and compliance items. These are **not user flows**; they are tracked here for completeness and point to their own living docs under `docs/` (PROD-* / EDU-* manual-testing docs, e.g. `docs/PROD-006-MANUAL-TC.md`) and `archive/docs/`. (Historically these were mislabeled FLOW-21…39 in the old registry — see the resolution table at the top.)

- **Admin auth middleware (old FLOW-34/PROD-010)** — centralized admin authentication for portal APIs; `docs/PROD-010-ADMIN-AUTH-MIGRATION.md`.
- **Android data safety & Google Play Families (old FLOW-35/PROD-011)** — data-safety declarations & Families policy readiness; `docs/PROD-011-MANUAL-TC.md`.
- **Production env config & secret audit (old FLOW-36/PROD-012)** — env parity and secret hygiene; `docs/PROD-012-MANUAL-TC.md`.
- **Full-stack production readiness & security scan (old FLOW-37/PROD-013)** — aggregate readiness scan; `docs/PROD-SCAN-FINDINGS.md`.
- **P1 security hardening rollup (old FLOW-38/PROD-001/002)** — SP wallet & ledger RLS lockdown, `admin_config` authenticated-only read; `docs/PROD-001-002-MANUAL-TC.md`.
- **Node-isolation RLS + anon-write lockdown (PROD-004/004b)** — RLS isolation on multi-tenant data; `archive/docs/PROD-004-MANUAL-TC.md`.
- **EF rate limiting (PROD-003)** and **Stripe Connect ownership verification (PROD-005)** — `docs/PROD-003-005-MANUAL-TC.md`.
- **iOS privacy & permissions (old FLOW-22/PROD-P001) / COPPA server-side enforcement (old FLOW-23/PROD-P005) / error recovery & crash reporting (old FLOW-21/PROD-P003-P004)** — app-store + child-safety compliance; `docs/PROD-P001-P005-MANUAL-TC.md`, `docs/PROD-P003-P004-MANUAL-TC.md`.
- **TypeScript strictness (PROD-006)** — `noImplicitAny` etc.; `docs/PROD-006-MANUAL-TC.md`.
- **ESLint cleanliness (PROD-007)** — repo lint gates; `docs/PROD-007-MANUAL-TC.md`.
- **Test suite green (PROD-008)** — full-suite green gate; `docs/PROD-008-MANUAL-TC.md`.
- **Store submission metadata & privacy policy (old FLOW-33/PROD-009)** — store listing metadata; `docs/PROD-009-MANUAL-TC.md`.
- **Tax-status lifecycle (old FLOW-39)** — capture-deferred-to-completion tax accounting; owned by FLOW-09 (Sales Tax) in this registry.

---

## Notes

- **Retired FLOW-29 (ID Badge Submission & Decision Notifications)** — folded into FLOW-21 (its notification/admin-messaging legs). References to `FLOW-29` in older guides (`/id-badges/messages`) map to FLOW-21.
- **Retired FLOW-04C** — category SP-calculation & bonus-badge detail folded into FLOW-11 (SP part) and FLOW-05 (image-analysis part).
- **Retired FLOW-12A scope note** — the hosted-checkout *web* leg (p2p-kids-web `/join`, `/api/checkout`) is part of FLOW-12A.
- Screen files listed as `[deprecated]`/`[unrouted]` are real but not part of any current journey; keep them badged rather than deleted until their notification/deep-link consumers are fully retired.
- Every flow section lists only the primary screens/pages — shared shells (Loading/Offline/Error, tab bar, Notification Center entry) live in FLOW-00/FLOW-17.

---

*Generated 2026-09-06 by consolidating the 7,069-line legacy registry (archived at `docs/archive/flow-registry-legacy-2026-09-06.md`). Validate any edit with `scripts/verify-flow-registry.mjs`.*









