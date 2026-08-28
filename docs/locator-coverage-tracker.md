# Locator Coverage Tracker — Phase 9 (v2)

**Created:** 2026-08-15 · **Scope:** Sprint 0 (cleanup) + Sprints 1–4 (locator instrumentation) of Phase 9.
**Purpose:** Per-surface before/after locator coverage + running aggregate, feeding the Phase 10 retrofit decision.

---

## Metric

- **Covered** = interactive elements carrying a locator (`testID` mobile / `data-testid` admin) ÷ total interactive elements on the surface.
- Native/non-instrumentable elements (Stripe PaymentSheet, `Alert.alert`, browser `confirm()`/`alert()`) are excluded from the denominator and flagged in notes.
- Mobile convention: any control with `testID` also sets `accessible` + `accessibilityRole` + `accessibilityLabel` (BP-53) unless noted.

## Running Aggregate

| After Sprint | Library-wide new locators (this sprint) | Cumulative new locators | Surfaces covered this sprint |
|---|---|---|---|
| Sprint 0 | 0 (cleanup only — no locators) | 0 | — |
| Sprint 1 | **71** (42 mobile + 29 admin) | **71** | 5 |
| Sprint 2 | **48** (24 mobile + 24 admin) | **119** | 8 |
| Sprint 3 | **63** (admin) | **182** | 11 files |
| Sprint 4 | **56** (admin) | **238** | 11 files |

> Sprint 1 locator counts: ForgotPassword 5 · ResetPassword 5 · PaymentMethods 8 · admin `/listings` 29 · TradeList 24 (new, +5 pre-existing) = **71 new** locator attributes.
> Sprint 2 locator counts: SuspendedAccount 1 · IssueReportModal 8 · ReviewCard 4 · ReviewOfferScreen 5 · UserDashboard 6 · admin `/trades/[id]` 9 · `/payouts` 6 · `/payouts/earnings` 9 = **48 new**.
> Sprint 3 locator counts: `/reviews` 11 · `/disputes` 1 · DisputeFilters 1 · DisputeViewer 6 · DisputeActions 3 · `/trades/disputes/[id]` 7 · `/nodes` 4 · NodeFormModal 12 · `/settings/nodes` 7 · `/id-badges` 4 · IDBadgeTabs 1 · id-badge review 6 = **63 new**.
> Sprint 4 locator counts: `/support` 7 · `/support/[id]` 2 · `/monitoring` 14 · `/config` 5 · `/payments` 1 · `/cancellation-insights` 2 · `/items/flagged` 2 · `/education/faq` page 2 · FAQTable 5 · FAQForm 7 · CategoryManager 9 = **56 new**.

---

## Sprint 1 — Surfaces (gates: AUTH-TC-S01–S11, ADM-TC-B06/C06–C12, SUB-TC-M01–M07, TRD-TC-Y01–Y04, TRD-TC-L03–L05/L09)

| Surface | Path | Before | After | Interactive elems | Notes |
|---|---|---|---|---|---|
| ForgotPasswordScreen | `p2p-kids-marketplace/src/screens/auth/ForgotPasswordScreen.tsx` | 0 | 5 | 5 (instrumentable) | 2 native alert buttons (Open Supabase Docs / OK) not instrumentable |
| ResetPasswordScreen | `p2p-kids-marketplace/src/screens/auth/ResetPasswordScreen.tsx` | 0 | 5 | 5 (instrumentable) | 1 native success alert; requirements card = static text |
| PaymentMethodsScreen | `p2p-kids-marketplace/src/screens/profile/PaymentMethodsScreen.tsx` | 0 | 8 | 5 interactive + 3 assertable | 4 action buttons + spinner + saved-card/empty-state/security containers; Stripe sheet + native alerts not instrumentable |
| Admin `/listings` | `p2p-kids-admin/src/app/listings/page.tsx` · `components/ListingSearch.tsx` · `components/ListingAnalytics.tsx` | 0 | 29 | ~26 interactive | approve/request-edits/reject use browser `confirm()`; actions surface via `alert()` — handle by text |
| TradeListScreen | `p2p-kids-marketplace/src/screens/trade/TradeListScreen.tsx` | 5 | 29 | ~28 interactive | pre-existing: `tab-active`, `tab-history`, `trade-row-<id>`, `trade-history-empty-state`, `history-load-more` |

### Locator key added (Sprint 1)

**ForgotPasswordScreen:** `forgot-email-input` · `forgot-send-reset-button` · `forgot-back-to-login` · `forgot-send-another-button` · `forgot-back-to-login-success`

**ResetPasswordScreen:** `reset-new-password-input` · `reset-confirm-password-input` · `reset-submit-button` · `reset-back-to-login` · `reset-request-new-email-button`

**PaymentMethodsScreen:** `pm-loading-spinner` · `pm-saved-card` · `pm-update-button` · `pm-remove-button` · `pm-empty-state` · `pm-add-button` · `pm-security-banner` · `pm-back-button`

**Admin /listings:** `listings-tab-search` · `listings-tab-analytics` · `listings-search-input` · `listings-seller-email-input` · `listings-status-select` · `listings-category-select` · `listings-sp-eligible-checkbox` · `btn-listings-search` · `btn-listings-clear-selection` · `listings-select-all` · `listings-row-<id>` · `listings-row-<id>-select` · `listings-view-<id>` · `btn-listings-actions-<id>` · `btn-listings-prev` · `btn-listings-next` · `listings-details-modal` · `listings-modal-close` · `btn-approve-<id>` · `btn-request-edits-<id>` · `btn-reject-<id>` · `btn-pause-<id>` · `btn-force-delete-<id>` · `btn-listings-close` · `listings-reason-input` · `btn-confirm-action` · `btn-cancel-action` · `btn-analytics-retry` · `btn-analytics-refresh`

**TradeListScreen (new):** `trade-summary-your-offers` · `trade-summary-in-progress` · `trade-summary-needs-action` · `trade-summary-completed` · `trade-bundle-<id>-view` (submitted/in-progress) · `trade-bundle-<id>-view-details` · `trade-bundle-<id>-card` · `trade-bundle-<id>-review-each` · `trade-bundle-<id>-accept-all` · `trade-bundle-<id>-decline-all` · `trade-offer-<id>-view` · `trade-offer-<id>-details` · `trade-offer-row-<id>` · `trade-offer-row-<id>` · `trade-offer-row-<id>-review` · `trade-row-<id>-view` · `trade-row-<id>-message` · `trade-history-row-<id>` · `trade-see-all` · `btn-accept-all-confirm` / `btn-decline-all-confirm` · `btn-bundle-modal-cancel` · `btn-pause-listing` · `btn-dismiss-prompt`

---

## Sprint 2 — Mobile remaining + admin money-critical

| Surface | Path | Before | After | Notes |
|---|---|---|---|---|
| SuspendedAccountScreen | `p2p-kids-marketplace/src/screens/auth/SuspendedAccountScreen.tsx` | 0 | 1 | `logout-button` |
| IssueReportModal | `p2p-kids-marketplace/src/screens/trade/IssueReportModal.tsx` | 0 | 8 | 5 reason options + other-description + submit + cancel |
| ReviewCard (report menu) | `p2p-kids-marketplace/src/components/ReviewCard.tsx` | 0 | 4 | menu + 3 report actions; report confirms are native `Alert.alert` |
| ReviewOfferScreen | `p2p-kids-marketplace/src/screens/trade/ReviewOfferScreen.tsx` | 1 | 6 | bundle toggle/rows, Accept Trade, Decline, Back to Offers; `accept-bundle-button` pre-existing |
| UserDashboardScreen | `p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx` | 11 | 17 | +6 (See All, subscription card, Upgrade, View All, Timeline, sell-sheet backdrop) |
| Admin `/trades/[id]` | `p2p-kids-admin/src/app/trades/[id]/TradeActions.tsx` | 2 | 11 | money-adjacent: force-cancel + partial-refund write-paths; 2 pre-existing (`partial-refund-button`, `confirm-partial-refund`) |
| Admin `/payouts` | `p2p-kids-admin/src/app/payouts/page.tsx` | 0 | 6 | money-critical: per-key inputs + save/reset + fee-calculator input + page container |
| Admin `/payouts/earnings` | `p2p-kids-admin/src/app/payouts/earnings/page.tsx` | 0 | 9 | money-critical: search/status/refresh/export, rows, trade links, retry, detail modal |

### Locator key added (Sprint 2)

**SuspendedAccountScreen:** `logout-button`

**IssueReportModal:** `issue-reason-no_show` · `issue-reason-not_as_described` · `issue-reason-no_meetup` · `issue-reason-no_agreement` · `issue-reason-other` · `issue-other-description-input` · `issue-submit-button` · `issue-cancel-button`

**ReviewCard:** `review-menu-button` · `review-report-spam` · `review-report-offensive` · `review-report-false-info`

**ReviewOfferScreen:** `bundle-context-banner` (pre-existing) · `review-bundle-toggle` · `review-bundle-item-<id>` · `accept-trade-button` · `decline-trade-button` · `back-to-offers-button` · `accept-bundle-button` (pre-existing)

**UserDashboardScreen:** `dashboard-see-all-discover` · `dashboard-subscription-card` · `dashboard-upgrade-kids-club-button` · `dashboard-view-all-trades` · `dashboard-view-timeline` · `sell-options-backdrop`

**Admin `/trades/[id]`:** `partial-refund-button` · `confirm-partial-refund` (pre-existing) · `btn-force-cancel-trade` · `force-cancel-reason-input` · `btn-confirm-force-cancel` · `btn-force-cancel-modal-cancel` · `refund-price-input` · `refund-fee-input` · `refund-tax-input` · `refund-reason-input` · `btn-refund-modal-cancel`

**Admin `/payouts`:** `payouts-config-page` · `payouts-input-<key>` · `btn-payouts-save-<key>` · `btn-payouts-reset-<key>` · `payouts-test-amount-input`

**Admin `/payouts/earnings`:** `payout-search-input` · `payout-status-filter` · `btn-payout-refresh` · `btn-payout-export` · `payout-row-<id>` · `payout-trade-link-<id>` · `btn-payout-retry-<id>` · `payout-detail-modal` · `btn-payout-modal-close`

## Sprint 3 — Admin review / dispute / node / id-badges

| Surface | Path | Before | After | Notes |
|---|---|---|---|---|
| `/reviews` | `src/app/reviews/page.tsx` | 0 | 11 | search/filters/sort, details toggle, keep/hide, pagination; keep/hide use browser `confirm()` |
| `/disputes` | `src/app/disputes/page.tsx` + `DisputeFilters.tsx` | 0 | 2 | View→ links + 3 filter tabs (single dynamic ids) |
| `/trades/disputes` | `DisputeViewer.tsx` · `DisputeActions.tsx` · `[tradeId]/page.tsx` | 0 | 16 | filters/search/pagination, 3 resolve actions (side-effecting), detail page + confirm modal |
| `/nodes` | `src/app/nodes/page.tsx` + `NodeFormModal.tsx` | 0 | 16 | Add/Edit/Toggle (side-effecting), KPI refresh, 8 form fields + modal buttons |
| `/settings/nodes` | `src/app/settings/nodes/page.tsx` | 0 | 7 | 5 numeric inputs + allow-adjust checkbox + Save; pre-existing `node-settings-config-link`/`last-updated-*` kept |
| `/id-badges` | `page.tsx` · `IDBadgeTabs.tsx` · `[requestId]/review/page.tsx` | 0 | 11 | search, 4 filter buttons, Review/View links, tabs, decision radios/reason/notes/submit |

### Locator key added (Sprint 3)

**/reviews:** `reviews-back-link` · `reviews-search-input` · `reviews-reason-filter` · `reviews-status-filter` · `reviews-sort-select` · `btn-reviews-retry` · `btn-review-details-<id>` · `btn-review-keep-<id>` · `btn-review-hide-<id>` · `btn-reviews-prev` · `btn-reviews-next`

**/disputes:** `dispute-view-link-<id>` · `disputes-tab-all|reported|under_review`

**/trades/disputes:** `disputes-status-select` · `disputes-search-input` · `disputes-reason-select` · `dispute-trade-link-<id>` · `btn-disputes-prev` · `btn-disputes-next` · `btn-dispute-mark-under-review-<id>` · `btn-dispute-resolve-complete-<id>` · `btn-dispute-resolve-refund-<id>` · `btn-dispute-back` · `dispute-confirm-modal` · `btn-dispute-confirm-cancel` · `btn-dispute-confirm-submit`

**/nodes:** `btn-add-node` · `btn-node-kpis-refresh` · `btn-edit-node-<id>` · `btn-toggle-node-<id>` · `node-form-modal` · `node-form-name|zip|city|state|latitude|longitude|radius|description|is-active` · `btn-node-form-cancel` · `btn-node-form-submit`

**/settings/nodes:** `node-settings-default-radius-input` · `node-settings-max-assignment-input` · `node-settings-distance-warning-input` · `node-settings-allow-user-radius-adjustment` · `node-settings-min-user-radius-input` · `node-settings-max-user-radius-input` · `btn-save-node-settings`

**/id-badges:** `id-badge-search-input` · `id-badge-filter-all|pending|approved|rejected` · `id-badge-review-<id>` · `id-badge-view-<id>` · `id-badges-tab-verification-queue|message-templates` · `id-badge-decision-approve|reject` · `id-badge-rejection-reason` · `id-badge-review-notes` · `id-badge-download-screenshot` · `btn-id-badge-submit`

## Sprint 4 — Admin config / monitoring / support / education + gap-fills

| Surface | Path | Before | After | Notes |
|---|---|---|---|---|
| `/support` + `/support/[id]` | `src/app/support/page.tsx` · `[id]/page.tsx` | 0 | 9 | refresh, filter tabs, View links, mark-as-read, pagination, detail back + mark-read |
| `/monitoring` | `src/app/monitoring/page.tsx` | 0 | 14 | run/diagnostics/refresh-list, trade links, acknowledge/add-note/re-run, trade + note modals (side-effecting) |
| `/config` | `src/app/config/page.tsx` | 0 | 5 | tab nav, per-key `ref-config-<key>` + `btn-save-<key>`, copy-snippet, SMS-stats refresh |
| `/payments` | `src/app/payments/page.tsx` | 4 | 5 | gap-fill: per-row trade link (search/status/refresh/row pre-existing) |
| `/cancellation-insights` | `CancellationInsightsClient.tsx` | 3 | 5 | gap-fill: modal close + retry (presets + custom dates pre-existing) |
| `/items/flagged` | `src/app/items/flagged/page.tsx` | 5 | 7 | gap-fill: filter buttons + rejection-reason input |
| `/education/faq` | `page.tsx` + `FAQTable` + `FAQForm` + `CategoryManager` | 0 | 23 | tabs, add, table row actions (toggle/move/edit/delete), form fields + status + submit/cancel, category manager |
| Verify-only (well-covered) | `/categories` (10) · `/sp-wallet` (22) · `/settings/trade-timing` (8) · `/action-center` (10) · `/tax/settings` (8) · `/monitoring/cron` (13) | — | — | confirmed instrumented; no changes |

### Locator key added (Sprint 4)

**/support:** `btn-support-refresh` · `support-filter-all|unread|read` · `support-view-<id>` · `btn-support-mark-read-<id>` · `btn-support-prev` · `btn-support-page-<n>` · `btn-support-next` · `btn-support-back` · `btn-support-mark-read`

**/monitoring:** `btn-monitor-run` · `btn-monitor-diagnostics` · `btn-monitor-refresh-list` · `btn-monitor-trade-<id>` · `btn-monitor-acknowledge-<id>` · `btn-monitor-add-note-<id>` · `btn-monitor-rerun-<id>` · `btn-monitor-trade-modal-close` · `btn-monitor-acknowledge-trade` · `btn-monitor-rerun-trade-modal` · `monitor-note-modal` · `monitor-note-input` · `btn-monitor-note-cancel` · `btn-monitor-note-submit`

**/config:** `config-tab-<cat>` · `ref-config-<key>` · `btn-save-<key>` · `btn-config-copy-setup-snippet` · `btn-config-sms-stats-refresh`

**/payments:** `payment-trade-link-<id>` (gap-fill)

**/cancellation-insights:** `btn-cancellation-insights-modal-close` · `btn-cancellation-insights-retry` (gap-fill)

**/items/flagged:** `flagged-filter-all|flagged|needs_edits|rejected` · `flagged-rejection-reason-input` (gap-fill)

**/education/faq:** `btn-faq-add` · `faq-tab-questions|categories|analytics` · `btn-faq-toggle-status-<id>` · `btn-faq-move-up-<id>` · `btn-faq-move-down-<id>` · `btn-faq-edit-<id>` · `btn-faq-delete-<id>` · `btn-faq-form-close` · `faq-form-category` · `faq-form-question` · `faq-form-answer` · `faq-form-status-draft|published` · `btn-faq-form-cancel` · `btn-faq-form-submit` · `btn-faq-cat-up-<id>` · `btn-faq-cat-down-<id>` · `faq-cat-rename-<id>` · `btn-faq-cat-save-<id>` · `btn-faq-cat-cancel-<id>` · `btn-faq-cat-edit-<id>` · `btn-faq-cat-delete-<id>` · `faq-cat-new-name-input` · `btn-faq-cat-add`

## Final rollup (Phase 9)

- **Sprint 0:** 4 decided cleanups (tax docs → BP-37, Trade Basket naming, 3 orphaned screens deleted, 3 stale test titles fixed) — no locators.
- **Sprints 1–4:** **238 new locator attributes** across **35 surfaces** (mobile RN `testID` + admin `data-testid`).
- **Verification:** mobile + admin `tsc --noEmit` green after every sprint; no new lint errors (pre-existing baselines only: mobile ~102 errors / admin ~0–3 warnings); all diffs additive-only (removals are pre-augmentation JSX tags); Sprint 0 widget tests 58/58; `verify-admin-config.sh` green.
- **Locator hints:** added to AUTH-TC-S01–S11, ADM-TC-B06/C06–C12, SUB-TC-M01–M07, TRD-TC-Y01–Y04, TRD-TC-L03–L05/L06–L08/L09.

---

## Remaining surfaces (later sprints)

| Sprint | Surfaces |
|---|---|
| 2 | Mobile: `ReviewOfferScreen` (1/6) · `UserDashboardScreen` (11/20) · `SuspendedAccountScreen` (0/1) · `IssueReportModal` (0) · `ReviewCard` report menu (0) · Admin money-critical: `/trades/[id]` · `/payouts` · `/payouts/earnings` |
| 3 | Admin: `/reviews` · `/disputes` + `/trades/disputes` · `/nodes` + `/settings/nodes` · `/id-badges` |
| 4 | Admin: `/config` · `/monitoring` · `/support` + `[id]` · `/education/faq` · gap-fills: `/payments`, `/cancellation-insights`, `/items/flagged` · verify well-covered: `/categories`, `/sp-wallet`, `/settings/trade-timing`, `/action-center`, `/tax/*`, `/monitoring/cron` |

## Phase 10 retrofit candidates (native, not instrumentable)

Stripe PaymentSheet · mobile `Alert.alert` (confirm/remove/errors) · browser `confirm()` (admin reject/request-edits) · browser `alert()` (admin action results).
