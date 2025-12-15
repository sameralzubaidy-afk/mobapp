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
