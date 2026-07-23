/**
 * Master orchestrator — runs ALL test suites in dependency order.
 * Detox reorders test files internally when run separately, so we import
 * them all here to guarantee sequential execution in the correct order.
 *
 * Each file self-registers its describe() block at import time.
 * --runInBand ensures one suite completes before the next starts.
 */

import './01-auth-login.e2e.ts';
import './02-auth-signup.e2e.ts';
import './03-listing-create.e2e.ts';
import './04a-trade-initiate.e2e.ts';
import './04b-trade-complete.e2e.ts';
import './05-sp-wallet.e2e.ts';
import './06-subscription.e2e.ts';
import './07-cart-checkout.e2e.ts';
import './08-cancel-trade.e2e.ts';
import './09-profile.e2e.ts';
import './10-discovery-browse.e2e.ts';
import './11-home-dashboard.e2e.ts';
import './12-notification-center.e2e.ts';
import './13-notification-preferences.e2e.ts';
import './14-help-support.e2e.ts';
import './15-settings-legal.e2e.ts';
import './16-id-verification.e2e.ts';
import './17-seller-trade-view.e2e.ts';
import './18-password-toggle.e2e.ts';
import './19-onboarding-carousel.e2e.ts';
import './20-filter-modal.e2e.ts';
import './21-category-filter.e2e.ts';
import './22-seller-trade-actions.e2e.ts';
import './23-forgot-password.e2e.ts';
import './24-messaging-inbox.e2e.ts';
import './25-sp-wallet-screen.e2e.ts';
import './26-sp-transaction-history.e2e.ts';
import './27-favorites.e2e.ts';
import './28-submit-review.e2e.ts';
import './29-trade-dispute.e2e.ts';
import './30-cart-screen.e2e.ts';
import './31-sell-action-sheet.e2e.ts';
import './32-referrals.e2e.ts';
import './33-payout-settings.e2e.ts';
import './34-my-listings.e2e.ts';
import './35-safe-meetup.e2e.ts';
import './36-trade-timeline.e2e.ts';
import './37-search-autocomplete.e2e.ts';
import './38-search-empty-state.e2e.ts';
import './39-badges.e2e.ts';
import './40-subscription-management.e2e.ts';
import './41-contact-support.e2e.ts';
import './42-edit-profile.e2e.ts';
import './43-cash-and-alternative-trades.e2e.ts';
import './44-offer-lifecycle.e2e.ts';
import './45-sp-reserve-transfer.e2e.ts';
import './46-sp-gating.e2e.ts';
import './47-dispute-e2e-flow.e2e.ts';
import './48-payout.e2e.ts';
import './49-completion-ctas.e2e.ts';
import './50-safety-ux.e2e.ts';
import './51-seller-consequences.e2e.ts';
import './52-value-stack.e2e.ts';
import './53-bundle-flows.e2e.ts';
import './54-cart-edge-cases.e2e.ts';
import './55-tax-checkout.e2e.ts';
import './56-reviews-detailed.e2e.ts';
import './57-refund-cancel.e2e.ts';
