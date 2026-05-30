# Maestro Flows Registry

## Active Flows

- `.maestro/auth-signup.yaml` - Signup happy path.
- `.maestro/auth-login.yaml` - Login path.
- `.maestro/module-15.1-flow-01-auth.yaml` - **[MODULE-15.1 FLOW-01]** Reusable auth UI regression flow (Landing/Login/Signup/Forgot Password + validation states) using shared Expo bootstrap helper.
- `.maestro/module-15.1-flow-02-onboarding.yaml` - **[MODULE-15.1 FLOW-02]** Onboarding and profile redesign regression (Welcome, FeatureHighlights, OnboardingCarousel, ProfileSetup) with testID-based simulator automation. Note: ProfileCompletionScreen, LocationPickerScreen, and NodeSelectionScreen have been removed (orphaned screens).
- `.maestro/tc-004-login-password-toggle.yaml` - Focused FLOW-01 TC-004 password visibility toggle test that reuses shared Expo bootstrap helper.
- `.maestro/onboarding-carousel.yaml` - **[MODULE-18 EDU-004]** Trading education onboarding carousel: first-run display, 5-screen swipe navigation, progress dots update, skip button immediate exit, Get Started on screen 5 completion, re-launch does NOT show carousel. Tests 3 flows: complete path, skip path, swipe back/forward navigation (EDU-004).
- `.maestro/help-screen-education.yaml` - **[MODULE-18 EDU-005]** Help Screen Education: navigate from Settings → Help → verify sp_definition expanded by default → tap section headers to expand/collapse → SP calculator interaction (select category, enter price, calculate) → verify bonus categories list → pull-to-refresh → deep link to specific section → back navigation. Tests 6 states: default load, section expansion, calculator interaction, bonus categories display, pull-to-refresh, navigation (EDU-005).
- `.maestro/auth-v3-005-profile-autofill.yaml` - Profile auto-fill and avatar download from OAuth providers (AUTH-V3-005): Google auto-fill, Facebook avatar download, Apple no-avatar graceful fallback, existing profile NOT overwritten state.
- `.maestro/listing-create.yaml` - Listing creation with image upload (SAFETY-P001).
- `.maestro/browse-search.yaml` - Browse and search listings.
- `.maestro/swap-points-wallet.yaml` - SP wallet display and transactions.
- `.maestro/sp-notifications.yaml` - SP event notifications (earned, spent, frozen, low_balance) with subscription gating (NOTIF-V2-003).
- `.maestro/subscription-payment-flow.yaml` - Subscription payment flow (SUB-015).
- `.maestro/payment-failure-handling.yaml` - Payment retry/failure flow (SUB-018).
- `.maestro/re-subscribe-from-grace.yaml` - Grace period re-subscribe flow.
- `.maestro/sub-020-trial-limit.yaml` - Trial limit enforcement states (SUB-020).
- `.maestro/safety-p003-item-flagging.yaml` - Item flagging and rejection status (SAFETY-P003).
- `.maestro/safety-002-cpsc-recall-matching.yaml` - CPSC recall matching on listing creation (SAFETY-002).
- `.maestro/safety-004-image-moderation.yaml` - Google Vision AI image moderation (SAFETY-004).
- `.maestro/tos-system.yaml` - Terms of Service view from Settings and acceptance from Signup (SAFETY-010).
- `.maestro/privacy-policy-system.yaml` - Privacy Policy view from Settings and Signup link navigation (SAFETY-011).
- `.maestro/liability-disclaimer-flow.yaml` - Liability Disclaimer view from Settings and mandatory acknowledgment during trade (SAFETY-012). Updated in FLOW-25 for Whisk restyle (WarningCircle icon, no notice box).
- `.maestro/flow25-settings-legal.yaml` - FLOW-25: Legal & Settings restyle — grouped sections, Sign Out/Delete Account rows, PrivacyPolicy, TermsOfService, DeleteAccountScreen cancel+validation (MODULE-15.1).
- `.maestro/notif-v2-005-push-delivery.yaml` - Push notification delivery with rate limiting, quiet hours, deduplication, and retry (NOTIF-V2-005).
- `.maestro/notif-v2-006-notification-center.yaml` - In-app notification center: list, read/unread indicators, mark single read, mark all read, pull-to-refresh, infinite scroll, empty state, back navigation (NOTIF-V2-006).
- `.maestro/trade-notifications.yaml` - Trade event notifications: trade_request, trade_accepted, trade_rejected, trade_completed, trade_cancelled states in Notification Center + deep-link navigation to TradeDetail + notification preference toggle for trades category (NOTIF-V2-007).
- `.maestro/notif-v2-008-deep-linking.yaml` - Notification deep linking: all notification types (SP, subscription, badges, trades, referrals, system) navigate to correct screens with params from foreground, background, and killed app states. Tests invalid deep link fallback to Home, navigation stack management (navigate vs reset), and multi-notification navigation sequences (NOTIF-V2-008).
- `.maestro/notif-v2-009-email-notifications.yaml` - Email notification preference toggles per category (subscription, sp_events, badges, trades, system): email_enabled on/off, persist after navigation, default off state. Email delivery itself not testable in simulator – covers UI settings layer only (NOTIF-V2-009).
- `.maestro/notif-v2-010-analytics.yaml` - Notification analytics tracking: delivered, opened, clicked, failed events. Verifies mobile app tracks events when notifications are sent, tapped, and deep links followed. Admin dashboard verification is manual (NOTIF-V2-010).
- `.maestro/module-15.1.2-flow-08-trade-v2-components.yaml` - **[MODULE-15.1.2 FLOW-08]** TradeFlowV2 Phase 4 component regression using deep-link preview route (`/trade-v2-preview`) for deterministic countdown and auto-complete banner validation (TFV2-007, TFV2-008).
- `.maestro/trade-tfv2-023-addenda.yaml` - **[MODULE-15.1.2 TFV2-023 + Addenda A-E]** Seller cancel consequences: in_progress cancel triggers tiered alert (level 1/2/3+), seller-specific cancellation reasons. Value stack in TradeOfferScreen: offer amount + SP discount + platform fee ($0.99 subscriber / $2.99 free) + total cash. Bundle trade flows: bundle offer grouping in TradeListScreen Offers tab (Accept All / Review Each / Decline All), in-progress bundle section in Buying tab, bundle context banner + Accept All N Items in ReviewOfferScreen, bundle banner + Confirm All shortcut in TradeTimelineScreen. 5 flow blocks.
- `.maestro/discovery-v3-006-filter-modal.yaml` - Discovery V3 filter modal: all 8 filter sections, price validation, clear all, apply filters (DISCOVERY-V3-006).
- `.maestro/search-filters.yaml` - Discovery V3 multi-filter application: apply multiple filters, filter chips display, remove individual chips, clear all filters, results update after filter changes (DISCOVERY-V3-008).
- `.maestro/search-autocomplete.yaml` - Discovery V3 search autocomplete: recent searches (max 8, LRU), case-insensitive deduplication, autocomplete dropdown, tap suggestion, brand autocomplete (DISCOVERY-V3-008).
- `.maestro/search-empty-state.yaml` - Discovery V3 empty states: no results message, typo suggestions ("Did you mean..."), filter-specific empty states, clear filters from empty state (DISCOVERY-V3-008).
- `.maestro/listing-v3-002-ai-analysis.yaml` - AI image analysis for bulk listing auto-fill: single item analysis with Google Vision API, batch analysis with concurrency limiting, confidence scores, error handling, manual override, low confidence field omission (LISTING-V3-002).
- `.maestro/listing-v3-006-bulk-listing-create.yaml` - Bulk listing screen flow: Sell sheet entry, multi-photo selection, grouping, AI analyze transition, per-item review, publish confirmation, partial/error surfacing (LISTING-V3-006).
- `.maestro/item-create-happy-path.yaml` - Item create happy path: photo upload → AI analysis → apply suggestions → fill required fields → publish → verify success (LISTING-V3-010).
- `.maestro/bulk-listing-publish-all.yaml` - Bulk listing publish all: upload 8 photos → auto-group into 4 items (2 photos each) → AI analyze all → publish all at once → verify 4 items published (LISTING-V3-010).
- `.maestro/draft-resume.yaml` - Draft resume flow: create draft with partial data → exit app → relaunch → resume banner appears → continue editing → publish → verify draft deleted (LISTING-V3-010).
- `.maestro/category-other.yaml` - Category Other custom request: select "Other" category → enter custom name → validation prevents publish when empty → publish with custom name → verify review flag created (LISTING-V3-010).
- `.maestro/admin-v3-005-category-suggestions.yaml` - **[ADMIN]** Category Suggestions Queue: navigate to Suggestions tab → verify pending badge count → approve suggestion (creates new category + reassigns item) → merge suggestion into existing category → reject suggestion with admin note → test modal close behaviors → verify empty state (ADMIN-V3-005).
- `.maestro/admin-sp-analytics-dashboard.yaml` - **[ADMIN]** SP Analytics Dashboard: navigate to SP Analytics page → verify date range picker (7/30/90 days) → metrics table displays velocity/gap/cash per category → anomaly alerts panel shows flagged categories → click flagged category navigates to category edit with SP Config tab → click table row deep-links to category → CSV export button functional → verify metric highlighting and badge rendering (ADMIN-V3-006).
- `.maestro/buyer-category-filter.yaml` - **[MOBILE-BUYER]** Buyer Category Filter Modal: open category filter from Browse → verify empty categories (item_count=0) hidden → verify bonus badges visible for categories with sp_earning_multiplier > 1.10 → verify SP preview shown for Kids Club+ subscribers → select category → verify filter chip displayed → clear filter (ADMIN-V3-009).
- `.maestro/seller-other-flow.yaml` - **[MOBILE-SELLER]** Seller "Other" Category Suggestion: navigate to Create Listing → add photos → select "Other" category → custom name input appears → enter custom category name → fill required fields → publish → verify suggestion created in category_suggestions table (ADMIN-V3-009).
- `.maestro/module-15.1-flow-22-payouts.yaml` - **[MODULE-15.1 FLOW-22]** PayoutSettingsScreen redesign: green hero balance card (`#5DBB8E`) with `Coins` icon + Pending/Lifetime stats row, "Withdraw Now" white pill CTA (`ArrowDown` icon), PAYOUT METHOD section loops all methods (not just primary) with green "Primary" pill badge, `NoMethodModal` styled component replaces native `Alert.alert()` ("Payment Method Required" + `Bank` icon + green CTA), payout history USD-only display (no "AUD"), `en-US` locale dates, design-token status colors (`processing`/`completed` → `#5DBB8E`, `pending` → `#F59E0B`, `failed`/`requires_action` → `#E85D75`), green pull-to-refresh tint, blank-screen guard on pull-to-refresh (`loading && !refreshing`), `ArrowLeft` header icon, title "Payouts" (FLOW-22). Manual tests: `FLOW-22-MANUAL-TESTING.md`.

## Shared Helper Flows

- `.maestro/helpers/auth-bootstrap-expo.yaml` - Reusable startup normalization for Expo Go auth flows (open Metro app, recover from suspended/authenticated state, normalize to Landing).

## MODULE-15.3-PART3 Sales Tax
- `.maestro/tax-checkout.yaml` - Sales tax row + total verification in checkout (Order Summary). TASK: TAX-011, TAX-014. FLOW-22.
