# Maestro Flows Registry

## Active Flows

- `.maestro/auth-signup.yaml` - Signup happy path.
- `.maestro/auth-login.yaml` - Login path.
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
- `.maestro/liability-disclaimer-flow.yaml` - Liability Disclaimer view from Settings and mandatory acknowledgment during trade (SAFETY-012).
- `.maestro/notif-v2-005-push-delivery.yaml` - Push notification delivery with rate limiting, quiet hours, deduplication, and retry (NOTIF-V2-005).
- `.maestro/notif-v2-006-notification-center.yaml` - In-app notification center: list, read/unread indicators, mark single read, mark all read, pull-to-refresh, infinite scroll, empty state, back navigation (NOTIF-V2-006).
- `.maestro/trade-notifications.yaml` - Trade event notifications: trade_request, trade_accepted, trade_rejected, trade_completed, trade_cancelled states in Notification Center + deep-link navigation to TradeDetail + notification preference toggle for trades category (NOTIF-V2-007).
- `.maestro/notif-v2-008-deep-linking.yaml` - Notification deep linking: all notification types (SP, subscription, badges, trades, referrals, system) navigate to correct screens with params from foreground, background, and killed app states. Tests invalid deep link fallback to Home, navigation stack management (navigate vs reset), and multi-notification navigation sequences (NOTIF-V2-008).
- `.maestro/notif-v2-009-email-notifications.yaml` - Email notification preference toggles per category (subscription, sp_events, badges, trades, system): email_enabled on/off, persist after navigation, default off state. Email delivery itself not testable in simulator – covers UI settings layer only (NOTIF-V2-009).
- `.maestro/notif-v2-010-analytics.yaml` - Notification analytics tracking: delivered, opened, clicked, failed events. Verifies mobile app tracks events when notifications are sent, tapped, and deep links followed. Admin dashboard verification is manual (NOTIF-V2-010).
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
