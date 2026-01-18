export type RootStackParamList = {
  Landing: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
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
  CategoryBrowse: { category: string };
  // Subscription routes
  Subscription: undefined;
  SubscriptionChoice: undefined;
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
  // MODULE-08: Badge routes
  Badges: undefined;
  Leaderboard: undefined;
  // MODULE-08: Review routes
  SubmitReview: { tradeId: string; revieweeId: string; revieweeName: string };
};
