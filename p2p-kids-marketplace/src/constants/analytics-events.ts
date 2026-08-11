// Analytics event constants for tracking user actions

export const AUTH_EVENTS = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  SIGNUP_FAILED: 'signup_failed',
  LOGIN_STARTED: 'login_started',
  LOGIN_COMPLETED: 'login_completed',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  PHONE_VERIFICATION_STARTED: 'phone_verification_started',
  PHONE_VERIFICATION_COMPLETED: 'phone_verification_completed',
  PHONE_VERIFICATION_FAILED: 'phone_verification_failed',
};

export const LISTING_EVENTS = {
  LISTING_CREATED: 'listing_created',
  LISTING_UPDATED: 'listing_updated',
  LISTING_DELETED: 'listing_deleted',
  LISTING_VIEWED: 'listing_viewed',
};

export const TRANSACTION_EVENTS = {
  PURCHASE_INITIATED: 'purchase_initiated',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_FAILED: 'purchase_failed',
  TRANSACTION_RATED: 'transaction_rated',
};

export const SUBSCRIPTION_EVENTS = {
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
};

export const SP_EVENTS = {
  SP_EARNED: 'sp_earned',
  SP_SPENT: 'sp_spent',
  SP_EXPIRED: 'sp_expired',
};

export const REVIEW_EVENTS = {
  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_SKIPPED: 'review_skipped',
  REVIEW_EDITED: 'review_edited',
  REVIEW_REPORTED: 'review_reported',
};

/**
 * Global chrome (header + bottom nav) tap tracking.
 * Note: these are NEW events — the nav bar previously fired no analytics.
 */
export const NAV_EVENTS = {
  HOME_TAB_TAPPED: 'tab_home_tapped',
  DISCOVER_TAB_TAPPED: 'tab_discover_tapped',
  SELL_FAB_TAPPED: 'sell_fab_tapped',
  TRADES_TAB_TAPPED: 'tab_trades_tapped',
  BASKET_TAB_TAPPED: 'tab_basket_tapped',
};

export const HEADER_EVENTS = {
  NOTIFICATIONS_TAPPED: 'header_notifications_tapped',
  CHAT_TAPPED: 'header_chat_tapped',
  AVATAR_TAPPED: 'header_avatar_tapped',
};

/**
 * Home composer bar events.
 * composer_bar_submit carries a `has_text` param (true/false) to distinguish
 * submit-with-text vs submit-empty.
 */
export const COMPOSER_EVENTS = {
  BAR_TAPPED: 'composer_bar_tapped',
  SUBMITTED: 'composer_bar_submit',
};
