export type RootStackParamList = {
  Landing: undefined;
  Home: undefined;
  Discover: undefined;
  Login: undefined;
  Signup: undefined;
  SuspendedAccount: undefined;
  PhoneVerification: undefined;
  ProfileSetup: undefined;
  Welcome: { userId?: string } | undefined;
  FeatureHighlights: { userId?: string } | undefined;
  Onboarding: undefined;
  Profile: { userId?: string } | undefined;
  SellerProfile: { userId: string; sellerVerificationStatus?: string };
  EditProfile: undefined;
  IDVerificationUpload: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  // MODULE-04: Listing routes
  MyListings: undefined;
  CreateListing: undefined;
  // MODULE-04 V3: Photo-first listing creation
  ItemCreate: { draftId?: string } | undefined;
  BulkListingCreate: { draftId?: string } | undefined;
  EditListing: { listing_id: string };
  ListingDetail: { listing_id: string };
  ListingSafetyReview: { listing_id: string };
  CategoryBrowse: { category: string };
  // Subscription routes
  Subscription: undefined;
  SubscriptionChoice: { userId?: string } | undefined;
  // MODULE-11 SUB-006: Trial conversion
  ContinueKidsClub: undefined;
  // MODULE-11 SUB-008: Manage subscription
  ManageKidsClub: undefined;
  // MODULE-11 SUB-010: Kids Club+ overview
  KidsClubOverview: undefined;
  // Profile & Payment Methods
  PaymentMethods: undefined;
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
  TradeReview: { tradeId: string };
  ReviewOffer: { tradeId: string };
  TradeTimeline: { tradeId: string };
  TradeDetail: { tradeId: string };
  TradeList: undefined;
  TradeDispute: { tradeId: string };
  TradeSuccess: {
    tradeId: string;
    role?: 'buyer' | 'seller';
    spUsed?: number;
    spAmountDollars?: number;
    remainingSP?: number;
    listingType?: 'cash_only' | 'accept_sp' | 'donate';
    totalSpToSeller?: number;
    spPendingReleaseDays?: number;
    tradeStatus?: 'initiated' | 'completed';
    counterpartyId?: string;
    counterpartyName?: string;
  };
  TradeV2ComponentsPreview: undefined;
  // MODULE-07: Messaging routes
  Conversations: undefined;
  Chat: { tradeId: string };
  // MODULE-06 (EXT): Seller Payout routes
  PayoutSettings: { showNoMethodModal?: boolean } | undefined;
  SellerEarnings: undefined;
  RequestPayout: undefined;
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
  // MODULE-15.1 FLOW-10/11: SP Transaction History
  SpTransactionHistory: undefined;
  // MODULE-11: Referral routes
  ReferralDashboard: undefined;
  Settings: undefined;
  NotificationPreferences: undefined;
  // MODULE-14 NOTIF-V2-002: Push notification setup
  NotificationSetup: undefined;
  // MODULE-17: Notifications
  Notifications: undefined;
  NotificationDetail: { notificationId: string };
  // MODULE-18 EDU-005: Help screen
  Help: { section?: string } | undefined;
  // MODULE-13 SAFETY-010: TOS
  TermsOfService: { requireAcceptance?: boolean; onAccept?: () => void } | undefined;
  // MODULE-13 SAFETY-011: Privacy Policy
  PrivacyPolicy: { requireAcceptance?: boolean; onAccept?: () => void } | undefined;
  // MODULE-13 SAFETY-012: Liability Disclaimer
  LiabilityDisclaimer: undefined;
  // MODULE-15.1 FLOW-25: Delete Account
  DeleteAccount: undefined;
  // MODULE-15.1 FLOW-07: Cart & Bundling
  Cart: undefined;
  CartCheckout: { bundleId: string; bundleMode?: boolean };
  BundleBuilder: { sellerId: string; sellerName?: string };
  // SELLER-GROUP-007: "More from this seller" page
  MoreFromThisSeller: { sellerId: string; excludeListingId?: string; returnToCart?: boolean };
  // MODULE-15.2 CART-018: Favorites
  Favorites: undefined;
  // MODULE-15.1 FLOW-12: Subscription Screens
  SubscriptionPlans: undefined;
  PlanComparison: undefined;
  UpgradePlan: undefined;
  CancelSubscription: undefined;
  SubscriptionExpired: { planName?: string; expiredDate?: string } | undefined;
  MySubscription: undefined;
  // MODULE-15.1 FLOW-19: Help & Support
  HelpSupport: undefined;
  Support: undefined;
  ContactSupport: undefined;
  FAQDetail: { faq: { id: string; category: string; question: string; answer: string } };
};
