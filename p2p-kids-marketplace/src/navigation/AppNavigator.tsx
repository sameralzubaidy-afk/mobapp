import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import BrowseItemsScreen from '@/screens/home/BrowseItemsScreen';
import SearchScreen from '@/screens/home/SearchScreen';
import CategoryBrowseScreen from '@/screens/home/CategoryBrowseScreen';
import ItemDetailScreen from '@/screens/home/ItemDetailScreen';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';
import SpWalletScreen from '@/screens/sp/SpWalletScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import PhoneVerificationScreen from '@/screens/auth/PhoneVerificationScreen';
import LandingScreen from '@/screens/auth/LandingScreen';
import SuspendedAccountScreen from '@/screens/auth/SuspendedAccountScreen';
// NOTE: Some profile/onboarding screens use expo-image-picker.
// Require them lazily to avoid startup crash when native module is unavailable.
const ProfileSetupScreen = require('@/screens/profile/ProfileSetupScreen').default;
const EditProfileScreen = require('@/screens/profile/EditProfileScreen').default;
import ProfileScreen from '@/screens/profile/ProfileScreen';
import BadgesScreen from '@/screens/profile/BadgesScreen';
import LeaderboardScreen from '@/screens/profile/LeaderboardScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '@/screens/auth/ResetPasswordScreen';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
const ProfileCompletionScreen = require('@/screens/onboarding/ProfileCompletionScreen').default;
import SubscriptionChoiceScreen from '@/screens/onboarding/SubscriptionChoiceScreen';
import LocationPickerScreen from '@/screens/onboarding/LocationPickerScreen';
import NodeSelectionScreen from '@/screens/onboarding/NodeSelectionScreen';
import FeatureHighlightsScreen from '@/screens/onboarding/FeatureHighlightsScreen';
import CreateListingScreen from '@/screens/listing/CreateListingScreen';
import EditListingScreen from '@/screens/listing/EditListingScreen';
import MyListingsScreen from '@/screens/listing/MyListingsScreen';
import TradeInitiationScreen from '@/screens/trade/TradeInitiationScreen';
import TradeSuccessScreen from '@/screens/trade/TradeSuccessScreen';
import TradeTimelineScreen from '@/screens/trade/TradeTimelineScreen';
import PayoutSettingsScreen from '@/screens/seller/PayoutSettingsScreen';
import SellerEarningsScreen from '@/screens/seller/SellerEarningsScreen';
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import { ReviewModerationScreen } from '@/screens/admin/ReviewModerationScreen';
import TrialConversionTestScreen from '@/screens/admin/TrialConversionTestScreen';
import ContinueKidsClubScreen from '@/screens/subscription/ContinueKidsClubScreen';
import { SubscriptionPaymentScreen } from '@/screens/subscription/SubscriptionPaymentScreen';
import SubscriptionStatusScreen from '@/screens/subscription/SubscriptionStatusScreen';
import SubscriptionSuccessScreen from '@/screens/subscription/SubscriptionSuccessScreen';
import ManageKidsClubScreen from '@/screens/subscription/ManageKidsClubScreen';
import KidsClubOverviewScreen from '@/screens/subscription/KidsClubOverviewScreen';
import TransactionHistoryScreen from '@/screens/profile/TransactionHistoryScreen';
import { SubmitReviewScreen } from '@/screens/review/SubmitReviewScreen';
import ReferralDashboardScreen from '@/screens/ReferralDashboardScreen';
const IDVerificationUploadScreen = require('@/screens/profile/IDVerificationUploadScreen').default;
import SettingsScreen from '@/screens/profile/SettingsScreen';
import NotificationPreferencesScreen from '@/screens/profile/NotificationPreferencesScreen';
import { AuthProvider, AuthContext } from '@/contexts/AuthContext';
import StripeProviderWrapper from '@/providers/StripeProviderWrapper';

const Stack = createStackNavigator();

// Deep linking configuration for password reset
const linking = {
  prefixes: ['p2pkidsmarketplace://', 'https://p2pkidsmarketplace.com'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Landing: '',
      Login: 'login',
      Signup: 'signup',
      Home: 'home',
      BrowseItems: 'browse',
      Search: 'search',
      PhoneVerification: 'phone-verification',
      SuspendedAccount: 'suspended-account',
      ProfileSetup: 'profile-setup',
      Profile: 'profile',
      EditProfile: 'edit-profile',
      ForgotPassword: 'forgot-password',
      Welcome: 'welcome',
      ProfileCompletion: 'profile-completion',
      SubscriptionChoice: 'subscription-choice',
      ContinueKidsClub: 'continue-kids-club',
      LocationPicker: 'location-picker',
      NodeSelection: 'node-selection',
      FeatureHighlights: 'feature-highlights',
      MyListings: 'my-listings',
      CreateListing: 'create-listing',
      EditListing: 'edit-listing',
      ListingDetail: 'listing/:listing_id',
      AdminDashboard: 'admin',
      IDVerificationUpload: 'id-verification-upload',
      ManageKidsClub: 'manage-kids-club',
      KidsClubOverview: 'kids-club-overview',
      TransactionHistory: 'billing-history',
    },
  },
};

/**
 * MODULE-03 AUTH-V2-003: RootNavigator
 *
 * Handles both authenticated and unauthenticated state transitions
 *
 * KEY FIX: Check BOTH session AND onboarding_completed status
 * - If session exists BUT onboarding not complete → show onboarding stack
 * - If session exists AND onboarding complete → show authenticated/dashboard stack
 * - If no session → show landing/auth stack
 */
function RootNavigator() {
  const { session, isLoading } = React.useContext(AuthContext);

  // Fail-open guard: if some startup network call hangs, do not block the entire UI forever.
  // We still prefer waiting for auth init, but after a short grace period, render the auth stack.
  const [forceRender, setForceRender] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      setForceRender(false);
      return;
    }

    const timer = setTimeout(() => {
      console.warn('[NAV] isLoading stuck >12s; forcing navigator render');
      setForceRender(true);
    }, 12000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  const navigationRef = React.useRef(createNavigationContainerRef<any>()).current;
  const lastRouteNameRef = React.useRef<string | undefined>(undefined);

  const logRouteChange = React.useCallback(() => {
    try {
      if (!navigationRef.isReady()) return;
      const route = navigationRef.getCurrentRoute();
      const name = route?.name;
      if (!name) return;

      if (lastRouteNameRef.current !== name) {
        lastRouteNameRef.current = name;
        // Keep logs short; large params can slow Android.
        // eslint-disable-next-line no-console
        console.log('[NAV] route:', name);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[NAV] Failed to read current route', e);
    }
  }, [navigationRef]);

  if (isLoading && !forceRender) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Determine which stack to show based on session + onboarding status
  const isAuthenticated = session !== null;
  const isSuspended = session?.user?.account_status === 'suspended';
  const isOnboardingComplete = session?.user?.onboarding_completed === true;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={logRouteChange}
      onStateChange={logRouteChange}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && isSuspended ? (
          // Authenticated + Suspended -> blocked account screen
          <Stack.Screen name="SuspendedAccount" component={SuspendedAccountScreen} />
        ) : isAuthenticated && isOnboardingComplete ? (
          // Authenticated + Onboarding Complete → Dashboard stack
          <>
            <Stack.Screen name="Home" component={UserDashboardScreen} />

            <Stack.Screen name="BrowseItems" component={BrowseItemsScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="CategoryBrowse" component={CategoryBrowseScreen} />
            <Stack.Screen name="ItemDetailScreen" component={ItemDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="SubscriptionChoice" component={SubscriptionChoiceScreen} />
            {/* MODULE-04: Listing screens */}
            <Stack.Screen name="MyListings" component={MyListingsScreen} />
            <Stack.Screen name="CreateListing" component={CreateListingScreen} />
            <Stack.Screen name="EditListing" component={EditListingScreen} />
            <Stack.Screen name="ListingDetail" component={ItemDetailScreen} />
            <Stack.Screen name="TradeInitiation" component={TradeInitiationScreen} />
            <Stack.Screen
              name="TradeList"
              component={require('@/screens/trade/TradeListScreen').default}
            />
            <Stack.Screen name="TradeDetail" component={TradeTimelineScreen} />
            <Stack.Screen name="TradeTimeline" component={TradeTimelineScreen} />
            <Stack.Screen name="TradeSuccess" component={TradeSuccessScreen} />
            {/* MODULE-07: Messaging screens */}
            <Stack.Screen
              name="Conversations"
              component={require('@/screens/messaging/ConversationsListScreen').default}
            />
            <Stack.Screen
              name="Chat"
              component={require('@/screens/messaging/ChatScreen').default}
            />
            {/* MODULE-06 (EXT): Seller Payout screens */}
            <Stack.Screen name="PayoutSettings" component={PayoutSettingsScreen} />
            <Stack.Screen name="SellerEarnings" component={SellerEarningsScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="ReviewModeration" component={ReviewModerationScreen} />
            <Stack.Screen
              name="TrialConversionTest"
              component={TrialConversionTestScreen}
              options={{ title: 'Trial Conversion Test - SUB-005' }}
            />
            <Stack.Screen
              name="ContinueKidsClub"
              component={ContinueKidsClubScreen}
              options={{ title: 'Continue Kids Club+ - SUB-006' }}
            />
            <Stack.Screen
              name="SubscriptionPayment"
              component={SubscriptionPaymentScreen}
              options={{ title: 'Subscription Payment - SUB-015' }}
            />
            <Stack.Screen
              name="SubscriptionSuccess"
              component={SubscriptionSuccessScreen}
              options={{ title: 'Subscription Success - SUB-016/017', headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionStatus"
              component={SubscriptionStatusScreen}
              options={{ title: 'Subscription Status - SUB-007' }}
            />
            <Stack.Screen
              name="ManageKidsClub"
              component={ManageKidsClubScreen}
              options={{ title: 'Manage Kids Club+ - SUB-008' }}
            />
            <Stack.Screen
              name="KidsClubOverview"
              component={KidsClubOverviewScreen}
              options={{ title: 'Kids Club+ - SUB-010' }}
            />
            <Stack.Screen
              name="TransactionHistory"
              component={TransactionHistoryScreen}
              options={{ title: 'Billing History - SUB-015' }}
            />
            <Stack.Screen name="Badges" component={BadgesScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            {/* MODULE-09: Swap Points screens */}
            <Stack.Screen name="SpWallet" component={SpWalletScreen} />
            {/* MODULE-08: Review screens */}
            <Stack.Screen name="SubmitReview" component={SubmitReviewScreen} />
            {/* MODULE-11: Referral screens */}
            <Stack.Screen name="ReferralDashboard" component={ReferralDashboardScreen} />
            {/* MODULE-10: ID Badge Verification */}
            <Stack.Screen name="IDVerificationUpload" component={IDVerificationUploadScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="NotificationPreferences"
              component={NotificationPreferencesScreen}
            />
            {/* Add more authenticated screens as needed */}
          </>
        ) : (
          // Unauthenticated OR Onboarding Incomplete → Onboarding/Auth stack
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="PhoneVerification" component={PhoneVerificationScreen} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
            <Stack.Screen name="SubscriptionChoice" component={SubscriptionChoiceScreen} />
            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
            <Stack.Screen name="NodeSelection" component={NodeSelectionScreen} />
            <Stack.Screen name="FeatureHighlights" component={FeatureHighlightsScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * AppNavigator with AuthProvider wrapper
 */
export default function AppNavigator() {
  return (
    <AuthProvider>
      <StripeProviderWrapper
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
        merchantIdentifier="merchant.com.p2pkidsmarketplace" // required for Apple Pay
      >
        <RootNavigator />
      </StripeProviderWrapper>
    </AuthProvider>
  );
}
