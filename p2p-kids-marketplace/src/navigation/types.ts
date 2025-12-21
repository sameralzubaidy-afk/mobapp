export type RootStackParamList = {
  Landing: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  PhoneVerification: undefined;
  ProfileSetup: undefined;
  Profile: undefined;
  EditProfile: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  // MODULE-04: Listing routes
  MyListings: undefined;
  CreateListing: undefined;
  EditListing: { listing_id: string };
  ListingDetail: { listing_id: string };
  // Subscription routes
  Subscription: undefined;
  SubscriptionChoice: undefined;
};
