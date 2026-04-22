export type RootStackParamList = {
  Landing: undefined;
  Home: undefined;
  Discover: undefined;
  Login: undefined;
  Signup: undefined;
  SuspendedAccount: undefined;
  PhoneVerification: undefined;
  ProfileSetup: undefined;
  Profile: { userId?: string } | undefined;
  EditProfile: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  // MODULE-04: Listing routes
  MyListings: undefined;
  CreateListing: undefined;
  EditListing: { listing_id: string };
  ListingDetail: { listing_id: string };
  ListingSafetyReview: { listing_id: string };
  CategoryBrowse: { category: string };
  // Subscription routes
  Subscription: undefined;
  SubscriptionChoice: undefined;
  // MODULE-11 SUB-006: Trial conversion
  ContinueKidsClub: undefined;
  // MODULE-11 SUB-008: Manage subscription
  ManageKidsClub: undefined;
  // MODULE-11 SUB-010: Kids Club+ overview
  KidsClubOverview: undefined;
  // MODULE-11 SUB-007: Subscription status/billing screen (manual verification)
  SubscriptionStatus: undefined;
  // MODULE-11 SUB-015: Subscription payment screen (Stripe Payment Sheet integration)
  SubscriptionPayment: { isRenewal?: boolean } | undefined;
  // MODULE-11 SUB-016/017: Subscription success screen (post-payment confirmation)
  SubscriptionSuccess: { isRenewal?: boolean } | undefined;
  // MODULE-11 SUB-015: Transaction History screen
  TransactionHistory: undefined;
  // Trade routes
  TradeInitiation: { itemId: string };
  TradeTimeline: { tradeId: string };
  TradeDetail: { tradeId: string };
  TradeList: undefined;
  TradeSuccess: { tradeId: string };
  // MODULE-07: Messaging routes
  Chat: { tradeId: string };
  // MODULE-06 (EXT): Seller Payout routes
  PayoutSettings: undefined;
  SellerEarnings: undefined;
  // Admin routes
  AdminDashboard: undefined;
  ReviewModeration: undefined;
  TrialConversionTest: undefined;
  // MODULE-08: Badge routes
  Badges: undefined;
  Leaderboard: undefined;
  // MODULE-08: Review routes
  SubmitReview: { tradeId: string; revieweeId: string; revieweeName: string };
  // MODULE-09: Swap Points routes
  SpWallet: undefined;
  SpWalletScreen: undefined;
  // MODULE-11: Referral routes
  ReferralDashboard: undefined;
  Settings: undefined;
  NotificationPreferences: undefined;
  // MODULE-14 NOTIF-V2-002: Push notification setup
  NotificationSetup: undefined;
  // MODULE-17: Notifications
  Notifications: undefined;
  NotificationDetail: { notificationId: string };
  // MODULE-13 SAFETY-010: TOS
  TermsOfService: { requireAcceptance?: boolean; onAccept?: () => void } | undefined;
  // MODULE-13 SAFETY-011: Privacy Policy
  PrivacyPolicy: { requireAcceptance?: boolean; onAccept?: () => void } | undefined;
  // MODULE-13 SAFETY-012: Liability Disclaimer
  LiabilityDisclaimer: undefined;
};
