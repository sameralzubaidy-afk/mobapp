# Reverse Coverage Report — Screens & Flows → Test Cases

**Date:** 2026-08-12
**Method:** Enumerated every registered screen in `p2p-kids-marketplace` (React Navigation) and `p2p-kids-admin` (Next.js App Router), read each screen's JSX/TSX to extract interactive elements and distinct states, then grepped all 6 canonical manual-test files for coverage of each element/state.
**Canonical files checked (final, post-consolidation state):** `cross-checked-and-consolidated/` (693 test cases across 6 files).
**Scope rule applied:** only *registered* screens were fully enumerated. Unregistered screen files are listed under §4 (Deferred), not fully enumerated.

> **Caveat (none blocking):** the Phase-2 consolidation task was already applied to the 6 canonical files (see `cross-checked-and-consolidated/CONSOLIDATION-MANIFEST.md`), so coverage is checked against the final, de-duplicated state. The older `gap-analysis/canonical-index-*.md` files point at `misc./` and are dated 2026-05-30; they were NOT used as the coverage source (only as a cross-reference aid).

---

## 1. Summary

| Canonical module | Screens | NO-COVERAGE | PARTIAL | FULL |
|---|---|---|---|---|
| Auth / Onboarding / Listing / Discovery | 22 | 3 | 12 | 7 |
| TradeFlowV2 (trade / cart / favorites) | 12 | 4 | 4 | 4 |
| Messaging / Badges / ID / Referrals / Safety / Notifications | 11 | 0 | 4 | 7 |
| Subscriptions / Payouts / SP Wallet | 18 | 2 | 6 | 10 |
| Account / Dashboard / Help / Legal | 17 | 3 | 5 | 9 |
| Admin Portal | 58 | 1 | 20 | 37 |
| **TOTAL** | **138** | **13** | **51** | **74** |

**Read:** 13 screens have zero manual coverage; 51 have partial coverage (some elements/states tested, some not); 74 are fully covered at the element/state level.

---

## 2. NO-COVERAGE screens

Each screen below has **zero** test cases referencing it in any of the 6 canonical files. The element/state list doubles as the starting checklist for authoring missing cases. **HIGH** = involves auth, payments/points/fees, or account security.

### Auth / Onboarding / Listing / Discovery

**ForgotPassword** — `p2p-kids-marketplace/src/screens/auth/ForgotPasswordScreen.tsx` — **HIGH**
- Elements: Email input · Send Reset Link · Back to Login · Send Another Email (success state)
- States: invalid/empty email · loading · success "Check Your Inbox" · error alerts (invalid email / rate limit / SMTP-config 500 / 400)
- Note: `TC-B03` only verifies the Login screen's "Forgot Password?" link opens this flow; the form and its success/error states are never touched.

**ResetPassword** — `p2p-kids-marketplace/src/screens/auth/ResetPasswordScreen.tsx` — **HIGH**
- Elements: New Password · Confirm Password · Reset Password · Back to Login · Request New Reset Email (link-error card)
- States: validation (length/complexity/mismatch) · loading · link-error (expired/no-session) · no-active-reset-session alert · success → Login
- Note: no test references the `p2pkidsmarketplace://reset-password` deep link or this form. Largest single auth-screen gap.

**CreateListing** (legacy V2 form) — `p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx` — LOW
- Elements: Title · Description · Price · Category buttons · Condition buttons · ImagePickerGrid (max 5) · Accept-SP Switch / Upgrade CTA · Create Listing · PriceAdjustmentModal · success modal
- States: "Checking subscription…" loading · subscriber SP toggle vs free upgrade prompt · price-below-min modal · uploading · success
- Note: registered in `AppNavigator` but **unreachable** in the current flow (Sell FAB → `ItemCreate`; no `navigate('CreateListing')` call sites found). The manual tests' "Create Listing" entries actually target `ItemCreateScreen`.

### TradeFlowV2

**TradeReview** — `p2p-kids-marketplace/src/screens/trade/TradeReviewScreen.tsx` — LOW
- Elements: Accept Trade · Decline (unreachable)
- States: loading (immediately `navigation.replace('ReviewOffer')` on mount)
- Note: `@deprecated`; kept only for backward-compat with stale notification payloads. Its Accept/Decline UI is dead code. Zero coverage is expected/correct.

**TradeDispute** — `p2p-kids-marketplace/src/screens/trade/TradeDisputeScreen.tsx` — **HIGH**
- Elements: 5 reason chips · description textarea (shown for "Other") · Submit Dispute · Cancel
- States: no-reason (disabled submit) · reason selected · "Other" + min-20-char description · submitting · submit-confirm alert
- Note: dispute filing in tests goes through the `TradeTimeline` `IssueReportModal` (TC-E01); this dedicated screen is never exercised.

**TradeV2ComponentsPreview** — `p2p-kids-marketplace/src/screens/trade/TradeV2ComponentsPreviewScreen.tsx` — LOW
- Elements: none (static preview of `OfferCountdownPill` ×2 + `AutoCompleteBanner`)
- States: critical countdown · normal countdown · auto-complete banner
- Note: developer-only preview; the components themselves are covered in-context (TC-D03, TC-D01).

**BundleBuilder** — `p2p-kids-marketplace/src/screens/cart/BundleBuilderScreen.tsx` — LOW
- Elements: item grid cards (toggle) · summary bar (count / savings / total / Add to Cart) — all unreachable
- States: loading · empty "No More Items Available" · selection + summary (dead code)
- Note: `loadSellerItems` hardcodes `setAvailableItems([])` with a TODO; only title/empty state is reachable. `TC-V12` covers the title only.

### Subscriptions / Payouts / SP Wallet

**JoinKidsClub** — `p2p-kids-marketplace/src/screens/subscription/JoinKidsClubScreen.tsx` — **HIGH**
- Elements: JoinKidsClubButton (web-redirect CTA)
- States: static value-prop (3 benefit rows) · web-managed card · footnote
- Note: routed under 4 route names (`JoinKidsClub`, `SubscriptionChoice`, `KidsClubOverview`, `SubscriptionPlans`). Tests reference *different* screens (`SubscriptionPlansScreen`, `KidsClubOverviewScreen`, `SubscriptionChoiceScreen`) that do not map to this file. Only the shared `JoinKidsClubButton` web redirect is indirectly exercised via `TC-B03/B09/B10/B12/B13`.

**PaymentMethods** — `p2p-kids-marketplace/src/screens/profile/PaymentMethodsScreen.tsx` — **HIGH**
- Elements: Add Payment Method (Stripe Payment Sheet) · Update Payment Method · Remove This Card · Go Back
- States: loading · empty (no card) · saved-card (brand/last4/expiry) · security banner
- Note: no test references this specific screen. The only "update payment method" mention (`TC-C07`) targets `ManageKidsClub`'s `PaymentMethodSection` — a different screen; `TC-C02`'s "Payment Method" row also routes to `ManageKidsClub`. It drives `attach-payment-method` / `detach-payment-method` / `retryFailedPayment` — all untested. Highest-risk mobile gap (directly in the money + account-security path).

### Account / Dashboard / Help / Legal

**Loading** — `p2p-kids-marketplace/src/screens/LoadingScreen.tsx` — LOW
- Elements: none (ActivityIndicator + message)
- States: default message vs custom `message` prop
- Note: has a Jest unit test (`LoadingScreen.test.tsx`) but no manual TC.

**Success** — `p2p-kids-marketplace/src/screens/feedback/SuccessScreen.tsx` — LOW
- Elements: CTA button (goBack or navigate)
- States: title · optional subtitle · custom ctaLabel · ctaAction goBack vs navigate
- Note: generic feedback screen; manual TCs target `SubscriptionSuccessScreen` / `TradeSuccessScreen` (separate screens). Jest unit test only.

**Error** — `p2p-kids-marketplace/src/screens/feedback/ErrorScreen.tsx` — LOW
- Elements: "Try Again" (retry) · "Go Back" link (when `showGoBack`)
- States: title/message params · onRetry · showGoBack true/false
- Note: ErrorBoundary TCs (TC-L01/L02/L03) mention a "Try Again" fallback but may reference a different component; no TC names `ErrorScreen.tsx`. Jest unit test only.

### Admin Portal

**Cancellation Insights** — `p2p-kids-admin/src/app/cancellation-insights/page.tsx` — LOW
- Elements: preset buttons (24h/7d/30d/Custom) · custom From/To date inputs · Retry · per-user View Details drill-down · modal Close
- States: loading · error · 4 KPI cards · offer/trade reason breakdown · top-cancelling-users table · flagged badge · drill-down modal · empty
- Note: referenced only as a sidebar label + Action-Center card target (`TC-X03` severity pill); no canonical test opens or exercises the page.

---

## 3. PARTIAL-COVERAGE screens

For each: ✅ = has a test case (with owning TC-ID); ❌ = no test case found. (TC-IDs may span multiple canonical files.)

### Auth / Onboarding / Listing / Discovery

**Landing** — `src/screens/auth/LandingScreen.tsx` — LOW
- ✅ Get Started (→Signup) `TC-A01, TC-ACC-01` · ✅ Log In `TC-B01` · ✅ button presence post-logout `TC-D03`
- ❌ Terms link · ❌ Privacy Policy link (footer legal links)

**Login** — `src/screens/auth/LoginScreen.tsx` — **HIGH**
- ✅ email/password + submit `TC-B01` · ✅ invalid-credentials modal `TC-B02` · ✅ Forgot Password link `TC-B03` · ✅ social buttons `TC-C01–C06` · ✅ Account Exists `TC-C04`
- ❌ empty-field validation ("Email/Password required") · ❌ ACCOUNT_DELETED branch · ❌ PROFILE_NOT_FOUND branch · ❌ back button · ❌ Sign Up link

**SuspendedAccount** — `src/screens/auth/SuspendedAccountScreen.tsx` — **HIGH**
- ✅ render + support email + Log Out presence `TC-F01`
- ❌ Log Out tap behavior (→ sign-out/Landing) — presence asserted, tap never executed

**FeatureHighlights** — `src/screens/onboarding/FeatureHighlightsScreen.tsx` — LOW
- ✅ swipe 4 slides + titles + dots + Get Started `TC-H05`
- ❌ Next button (per-slide) — only swipe implied

**BulkListingCreate** — `src/screens/BulkListingCreateScreen.tsx` — LOW
- ✅ upload→auto-group→AI→review→publish `TC-K01–K06, TC-N12–N14, TC-N05, TC-O1-C07`
- ❌ set-cover-photo · ❌ split group · ❌ delete photo / delete group · ❌ "+ Add item" (empty group) · ❌ duplicate-flag UI · ❌ photo-source modal Cancel

**EditListing** — `src/screens/listing/EditListingScreen.tsx` — LOW
- ✅ Save Changes + min-price modal `TC-N11, TC-L04`
- ❌ Delete Listing flow (confirm + "Listing Deleted") · ❌ Cancel · ❌ V3 fields on edit (Brand/Color/Age/Gender) · ❌ ImagePickerGrid on edit · ❌ SP toggle re-validation · ❌ "Other" custom-category name · ❌ ownership guard

**MyListings** — `src/screens/listing/MyListingsScreen.tsx` — LOW
- ✅ pending visible `TC-L01` · ✅ paused/min-price listing via My Listings (TradeFlowV2 L2932/L2948/L2965) · ✅ tap→Edit `L5767` · ✅ draft resume `TC-J11` · ✅ FAB→ItemCreate/Bulk `L5669`
- ❌ summary stats (Active/Sold/Earnings) · ❌ status filter chips · ❌ delete-from-list · ❌ discard draft · ❌ "My Trade" nav · ❌ SP Eligible badge · ❌ FAB sheet Cancel · ❌ empty states

**ListingDetail** — `src/screens/home/ItemDetailScreen.tsx` — **HIGH**
- ✅ price breakdown (fee+tax+total) · add-to-basket · request-to-buy · favorites · seller masking · SP context `TC-K01/K02, TC-A01/A02/C07, TC-M02/M14/M16–M18, TC-V04/V07, TC-S02–S04/S13–S16/S22`
- ❌ Share button (stub) · ❌ image thumbnail gallery/swiping · ❌ "Use SP 🔒" locked chip · ❌ Contact Seller "Start a Trade First" alert · ❌ View Profile "Start a Trade First" alert · ❌ duplicate-offer "Active Offer" modal · ❌ fallback seller section

**ListingSafetyReview** — `src/screens/listing/ListingSafetyReviewScreen.tsx` — LOW
- ✅ moderation/appeal states `TC-G01–G04, G06, G07, TC-R05`
- ❌ meta rows (Appeals submitted / Last flagged / Last rejected) · ❌ "Edit Listing"/"Make Edits Now" navigation · ❌ remove-success modal copy · ❌ not-owner/error state

**CategoryBrowse** — `src/screens/home/CategoryBrowseScreen.tsx` — LOW
- ✅ category → filtered results `TC-N01`
- ❌ pull-to-refresh · ❌ empty state · ❌ heart/share on card (console.log stubs)

**MoreFromThisSeller** — `src/screens/home/MoreFromThisSellerScreen.tsx` — LOW
- ✅ add-to-basket · in-basket status · matches-cart banner · different-seller modal `TC-S04–S06, S18–S21, S24, TC-V05/V06/V09`
- ❌ favorite heart toggle · ❌ empty state

**SellerProfile** — `src/screens/profile/SellerProfileScreen.tsx` — LOW
- ✅ reviews/rating display `TC-Q07–Q09, TC-C05`
- ❌ badges collapsible toggle · ❌ Identity Verified/Not Verified trust-card states · ❌ completed-trades count · ❌ verified ShieldCheck · ❌ profile-not-found + Retry

### TradeFlowV2

**TradeInitiation (offer)** — `src/screens/trade/TradeOfferScreen.tsx` — **HIGH**
- ✅ SP slider/input, card select, Send Offer, fee/tax, duplicate/limit/hold errors, disclaimer `TC-B01, B05a–B05c, B05j, B06, C02, O01/O02/O06/O08, T01, H03/H04, D03`
- ❌ Replace Card path · ❌ subscribe-upsell → JoinKidsClub · ❌ SP info tooltip · ❌ duplicate-offer modal navigation

**TradeList** — `src/screens/trade/TradeListScreen.tsx` — **HIGH**
- ✅ sections + bundle cards + pause listing `TC-P07, B01, B03, D03, L03–L05, L09, B02`
- ❌ summary filter chips (tap-to-filter) · ❌ Load More history pagination · ❌ Message button on rows · ❌ "See all →" link

**TradeDetail / TradeTimeline** — `src/screens/trade/TradeTimelineScreen.tsx` — **HIGH**
- ✅ complete/cancel/dispute/tax/payout/SP-release paths `TC-L01/L02, E01/E03/E04, D01/D02/D06, F01/F02, Q01/Q06, I01/I02, O08, K06, R05/R06, B02, B05c`
- ❌ R15 trade-extension UI (Request More Time / Accept / Decline / granted) · ❌ "What to do next" card + "Got it" toggle

**TradeSuccess** — `src/screens/trade/TradeSuccessScreen.tsx` — LOW
- ✅ CTA matrix (most permutations) `TC-H01–H04, TC-Q01`
- ❌ failure state ("Trade Failed" + Try Again) · ❌ secondary buttons (View My Trades / View Trade Details / Back to Home) · ❌ permutation 3 (subscriber buyer, no SP) & 7 (subscriber seller, no SP)

### Messaging / Badges / ID / Referrals / Safety / Notifications

**Conversations (Inbox)** — `src/screens/messaging/ConversationsListScreen.tsx` — LOW
- ✅ search/unread badge/empty/verified chip/trade chip/timestamp `TC-A01` · ✅ mark-read `TC-P03`
- ❌ Load More pagination (7/page) · ❌ pull-to-refresh · ❌ realtime conversation-list update

**Notifications** — `src/screens/notifications/NotificationCenterScreen.tsx` — LOW
- ✅ tap→deep-link + mark-read · Mark all read · pagination `TC-I03–I07`
- ❌ error state + Retry · ❌ empty state ("You're all caught up!")

**NotificationSetup** — `src/components/NotificationSetup.tsx` — LOW
- ✅ Enable + success `TC-I01, TC-I02`
- ❌ "Maybe Later" skip · ❌ "Continue" after success

**Leaderboard** — `src/screens/profile/LeaderboardScreen.tsx` — LOW
- ✅ list + medals + pull-to-refresh + empty `TC-B05`
- ❌ error state + Retry

### Subscriptions / Payouts / SP Wallet

**ContinueKidsClub** — `src/screens/subscription/ContinueKidsClubScreen.tsx` — **HIGH**
- ✅ subscribe CTA + trial `TC-B04–B06`
- ❌ active-subscription variant ("Already Subscribed" alert + Go Back) · ❌ loading state · ❌ trial-ending urgency badge copy

**ManageKidsClub** — `src/screens/subscription/ManageKidsClubScreen.tsx` — **HIGH**
- ✅ cancel modal + re-subscribe + AutoRenew + billing history `TC-C03, C05–C07, D01/D02, D05`
- ❌ free/no-subscription state ("Subscribe to Kids Club+") · ❌ custom-reason free-text input · ❌ expired state on this screen (only on SubscriptionExpired)
- Note: `TC-C05`'s "select a reason" steps actually belong to this screen's modal, but the test targets `CancelSubscriptionScreen` — a spec/code mismatch.

**MySubscription** — `src/screens/subscription/MySubscriptionScreen.tsx` — **HIGH**
- ✅ billing history + payment method + cancel link `TC-C01, TC-C02`
- ❌ free-user state ("Upgrade to Kids Club+") · ❌ "Learn More" link · ❌ hardcoded "Member Since May 2024" value (latent bug — never validated)

**PayoutSettings** — `src/screens/seller/PayoutSettingsScreen.tsx` — **HIGH**
- ✅ withdraw/method/set-primary/add-bank `TC-G01–G04, G06, H05`
- ❌ bottom-sheet "Edit Details" · ❌ "Cannot Delete Primary/Only Method" guard · ❌ "Cannot Set as Primary" (unverified) guard · ❌ Load More · ❌ NoMethodModal flow

**SellerEarnings** — `src/screens/seller/SellerEarningsScreen.tsx` — **HIGH**
- ✅ payout cards + requires_action `TC-F04–F06, G06`
- ❌ error state (Retry) · ❌ Load More pagination

**SpWallet** — `src/screens/sp/SpWalletScreen.tsx` — **HIGH**
- ✅ active/grace/expired banner + earn rows + history `TC-I01–I06`
- ❌ "Reserved in trades" card · ❌ "Wallet Not Found" error · ❌ pending-release summary note

### Account / Dashboard / Help / Legal

**Home (dashboard)** — `src/screens/dashboard/UserDashboardScreen.tsx` — **HIGH**
- ✅ greeting/subscription badge/SP strip/banners/quick-tiles/recommendations `TC-G01–G06, M19, P10–P16, P18, R05`
- ❌ "Show more actions" toggle · ❌ free-user "Unlock Swap Points" strip · ❌ "No session found" state · ❌ empty-trade state · ❌ "View Timeline" nav · ❌ "See All"→Discover nav · ❌ subscription-card Upgrade button
- Note: `TC-G03` tile names are stale (expects Sell/Discover/Messages; actual tiles are Favorites/My Trades/My Listings/Payouts).

**Profile** — `src/screens/profile/ProfileScreen.tsx` — LOW
- ✅ stats/logout/ID-verification/reviews `TC-B05, B01, D01, B03, C05, D07, Q07–Q09, K01, X08`
- ❌ Admin Dashboard row (dev-only) · ❌ "Profile not found" + Retry · ❌ "Share & Earn" nav (indirect only) · ❌ node_name/bio rendering

**EditProfile** — `src/screens/profile/EditProfileScreen.tsx` — **HIGH**
- ✅ fields load/save/avatar/phone-OTP `TC-B01–B04`
- ❌ form validation (phone 10-digit, email format) · ❌ "No Changes" alert · ❌ waitlist prompt · ❌ "already verified" phone path · ❌ locked-field "cannot be changed" alerts
- Note: `TC-B01` is stale (says "change Display Name, Zip Code" but code marks both `editable={false}`); `TC-B02` (email re-verification) is self-flagged "not implemented".

**Settings** — `src/screens/profile/SettingsScreen.tsx` — **HIGH**
- ✅ push/test-push/notif-prefs/legal/sign-out/delete `TC-A01–A04, C01, E01, J01, J03, J04, H01, K01–K04, R01`
- ❌ "Manage Payment Methods" row navigation (present in code, absent from TC-A01 expected list)
- Note: "Privacy & Security" is a no-op stub; MFA TCs (K01–K04) assume a real screen.

**Help (education)** — `src/screens/help/HelpScreen.tsx` — LOW
- ✅ accordion + SP calculator + bonus categories + deep-link `TC-I01–I05, H01`
- ❌ pull-to-refresh (RefreshControl)
- Note: route `Help` maps here (education). The FAQ-list screen (`support/HelpScreen.tsx`, route `Support`) is a separate file — see §4.

### Admin Portal (PARTIAL, 20 pages)

**/** (Admin home) — LOW — ✅ render order `TC-A03, A06` · ❌ health-link click-through · ❌ health retry/error · ❌ embedded action-center card actions

**/users** — **HIGH** — ✅ search/status filters/suspend/detail modal `TC-B01–B03, B05` · ❌ Reset Password · ❌ Unsuspend · ❌ Sort By / Sort Order
- Note: `TC-B03` says "ban" but the page has no ban action (suspend/unsuspend/delete only).

**/listings** — **HIGH** — ✅ shallow search/filter/results `TC-C01` · ❌ Force Delete · ❌ Pause · ❌ Approve · ❌ Request Edits · ❌ Reject · ❌ bulk/select-all · ❌ individual filter controls (only generically described)

**/categories** — **HIGH** — ✅ name/desc/is_active/SP multiplier `TC-D01–D04` · ❌ icon/badge upload · ❌ SP spending cap % · ❌ SP redemption cap · ❌ drag-and-drop reorder · ❌ bulk actions · ❌ delete category · ❌ suggestion Approve/Merge/Reject

**/referrals** — **HIGH** — ✅ partial config `TC-N01, N02, R06` · ❌ actual 5 SP fields + 3 toggles only partially enumerated · ❌ "missing keys" warning
- Note: `TC-N01` references fields not on the page (trial extension days / max referrals / expiry days) — spec mismatch.

**/reviews** — **HIGH** — ✅ Keep/Hide + report details `TC-Q01–Q03, Q18–Q20` · ❌ status filter dropdown · ❌ sort-by dropdown · ❌ search input

**/disputes** (list) — **HIGH** — ✅ columns/SLA `TC-I01` · ❌ filter-tab click behavior (All/Reported/Under Review)

**/payouts/earnings** — **HIGH** — ✅ list/stats/filter/retry `TC-K02, K03` · ❌ Export CSV · ❌ detail modal (row click → breakdown) · ❌ "Releases <date>" pending state

**/tax/settings** — LOW — ✅ global toggle + warning `TC-P04` · ✅ fee-in-base `TC-O1-C11` · ✅ cross-link + last-updated `TC-J01` · ❌ default rate input · ❌ subscription-fee-taxable toggle · ❌ remittance jurisdiction input

**/tax/nodes** — LOW — ✅ rate edit/validation/save + last-updated `TC-P01, P08, J01` · ❌ filter input · ❌ per-row jurisdiction · ❌ per-row enabled checkbox

**/tax/category-mapping** — LOW — ✅ Change/Save/Cancel/empty-dropdown `TC-O1-C14–C16` · ❌ "Reset to default" + confirm modal

**/subscriptions/manage** — **HIGH** — ✅ Extend/Cancel/filters/config `TC-M01–M03` · ❌ Reactivate button · ❌ metrics cards (MRR/churn/trial) · ❌ "free" status filter
- Note: `TC-M03` says "send a reminder" but the UI has no such button.

**/trades** (list) — LOW — ✅ status + search + single/bundle tabs `TC-H01, W01–W05, W08, W11, W12` · ❌ date-range filters · ❌ sort dropdown · ❌ per-page selector · ❌ pagination

**/trades/[id]** — **HIGH** — ✅ force-cancel/refund paths `TC-H02/H03, K07/K08, O1-C13, R06–R09, R12/R13` · ❌ Subscription Context section · ❌ External References (Stripe PI/refund + SP ledger IDs) · ❌ Sales Tax line in monetary breakdown

**/trades/disputes** (list) — **HIGH** — ✅ cost-ledger + list `TC-I01–I04, E05/E06, H05/H06, R09/R10` (target the detail page) · ❌ Dispute Cost Ledger (R4) · ❌ reason filter · ❌ search · ❌ pagination · ❌ inline per-row resolution actions

**/settings/trade-timing** — **HIGH** — ✅ offer/auto-complete/pickup/fees/seller-fee/buyer-fee fixed+% `TC-F03, F05, F06, B05f, D06` · ❌ R1 tiered buyer-fee fields · ❌ Buyer Fee-Tier Distribution table · ❌ legacy fee keys · ❌ Reset

**/action-center** — **HIGH** — ✅ severity cards + drill + inline actions `TC-X01–X12` · ❌ inline ID-Badge Approve (only on queue `TC-O02`) · ❌ Cancel Insights card drill

**/badges/sandbox** — LOW — ✅ SP-event simulation `TC-P04` · ❌ "Complete Trade" simulation (+ no-listing error)

**/monitoring** — LOW — ✅ run/ack/note/trade-modal `TC-V01` · ❌ "Run Diagnostics" button

**/monitoring/cron** — LOW — ✅ tabs + refresh + filter + status `TC-V02` · ❌ "Run Now" button · ❌ Edit Schedule modal (preset + minute/hour/day) · ❌ Info tab
- Note: `TC-V02` expects an "active toggle" that doesn't exist (Active is read-only Yes/No).

---

## 4. Uncertain / Deferred items

### Unregistered screen files (deferred — exist in code but not registered as navigation routes)
- `p2p-kids-marketplace/src/screens/messaging/ConversationsScreen.tsx` (unused; `ConversationsListScreen` is registered)
- `p2p-kids-marketplace/src/screens/trade/ActiveTradesScreen.tsx`
- `p2p-kids-marketplace/src/screens/subscription/BillingHistoryScreen.tsx` (route `TransactionHistory` → `profile/TransactionHistoryScreen`)
- `p2p-kids-marketplace/src/screens/subscription/SubscriptionPlansScreen.tsx` (route `SubscriptionPlans` → `JoinKidsClubScreen`)
- `p2p-kids-marketplace/src/screens/admin/ModerationQueueScreen.tsx`
- `p2p-kids-marketplace/src/screens/admin/NodeManagementScreen.tsx`
- `p2p-kids-marketplace/src/screens/admin/TrialExtensionTestScreen.tsx`
- `p2p-kids-marketplace/src/screens/notifications/NotificationSettingsScreen.tsx`
- `p2p-kids-marketplace/src/screens/payouts/PayoutDashboardScreen.tsx`
- `p2p-kids-marketplace/src/screens/profile/SpWalletScreen.tsx` (route `SpWallet` → `sp/SpWalletScreen`)
- `p2p-kids-marketplace/src/screens/auth/OnboardingScreen.tsx` (vs `onboarding/OnboardingScreen.tsx`)
- `p2p-kids-marketplace/src/screens/auth/LoginScreen.old.tsx`, `SignupScreen.old.tsx`

### Typed-but-unregistered routes
- `NotificationDetail` (in `navigation/types.ts`, no `Stack.Screen` in `AppNavigator.tsx`)
- `Subscription`, `SpWalletScreen` (typed; no matching registration)

### Ambiguous / flagged items
- **FAQ list screen**: route `Support` maps to `help/HelpScreen.tsx` (education), but a separate FAQ-list implementation exists at `support/HelpScreen.tsx` that is not imported by `AppNavigator`. Which screen serves the "FAQ list search + category filter" (`TC-H02/H03`) needs confirmation.
- **CreateListing** is registered but orphaned/unreachable (see §2) — should it be deleted, or re-linked?
- **Spec/code drift found during the audit** (test-side, for the follow-up authoring task to reconcile):
  - `TC-G03` dashboard quick-tile names stale
  - `TC-B01` EditProfile claims editable name/ZIP but code locks them
  - `TC-A01` Settings omits the "Manage Payment Methods" row
  - `TC-B02` email re-verification "not implemented" (already flagged in canonical)
  - `TC-C05` cancel-reason modal location mismatch (ManageKidsClub vs CancelSubscription)
  - `TC-N01` referrals config fields don't exist on the page
  - `TC-T02` notification-analytics date-range options (7/30/90 in UI vs 7/14/30/60/90 in test)
  - `TC-M03` "send a reminder" button nonexistent
  - `TC-B03` "ban" vs suspend/unsuspend
  - `TC-P02` badge create/delete affordance not present on `/badges`
  - `TC-V02` cron "active toggle" nonexistent

---

## 5. Priority flag for follow-up authoring

**Highest risk (HIGH + NO/PARTIAL, money/auth/security/moderation):**

| Screen | Why |
|---|---|
| `PaymentMethods` (mobile) | Entirely untested; Stripe attach/detach + failed-payment retry |
| `ForgotPassword`, `ResetPassword` (mobile) | Entire account-recovery flow untested |
| `TradeDispute` (mobile) | Dispute filing UI untested (only the timeline modal is covered) |
| `JoinKidsClub` (mobile) | The actual membership prompt screen is never opened |
| `TradeTimeline` extension UI (R15) | Untested pickup-window extension path |
| `/users` (admin) | Reset Password / Unsuspend / sort untested |
| `/listings` (admin) | All moderation write-paths (force-delete/pause/approve/edits/reject) untested |
| `/categories` (admin) | Icon upload, SP caps, reorder, bulk, suggestion actions untested |
| `/reviews`, `/referrals`, `/disputes`, `/subscriptions/manage`, `/trades/[id]`, `/settings/trade-timing` (admin) | Money/moderation/config gaps noted in §3 |

**Lower risk (cosmetic / dev-only / unreachable):** `Loading`/`Success`/`Error`, `TradeV2ComponentsPreview`, `TradeReview`, `BundleBuilder`, `CreateListing` (orphaned), `cancellation-insights`.

---

*This report identifies gaps only — it does not author new test cases. Follow-up authoring should start with the §5 highest-risk table, then fill NO-COVERAGE screens, then PARTIAL-COVERAGE ❌ items.*
