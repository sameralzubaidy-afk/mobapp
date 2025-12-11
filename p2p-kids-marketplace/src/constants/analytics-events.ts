// Authentication events
export const AUTH_EVENTS = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  SIGNUP_FAILED: 'signup_failed',
  LOGIN_STARTED: 'login_started',
  LOGIN_COMPLETED: 'login_completed',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
};

// Item listing events
export const ITEM_EVENTS = {
  LISTING_STARTED: 'listing_started',
  LISTING_COMPLETED: 'listing_completed',
  LISTING_VIEWED: 'listing_viewed',
  LISTING_FAVORITED: 'listing_favorited',
  LISTING_UNFAVORITED: 'listing_unfavorited',
  LISTING_SHARED: 'listing_shared',
};

// Trade events
export const TRADE_EVENTS = {
  TRADE_INITIATED: 'trade_initiated',
  TRADE_ACCEPTED: 'trade_accepted',
  TRADE_REJECTED: 'trade_rejected',
  TRADE_COMPLETED: 'trade_completed',
  TRADE_CANCELLED: 'trade_cancelled',
};

// Messaging events
export const MESSAGE_EVENTS = {
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_OPENED: 'conversation_opened',
};

// Points events
export const POINTS_EVENTS = {
  POINTS_EARNED: 'points_earned',
  POINTS_SPENT: 'points_spent',
  BOOST_PURCHASED: 'boost_purchased',
};

// Subscription events
export const SUBSCRIPTION_EVENTS = {
  SUBSCRIPTION_VIEWED: 'subscription_viewed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_COMPLETED: 'subscription_completed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
};
