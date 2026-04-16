import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
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
import ListingSafetyReviewScreen from '@/screens/listing/ListingSafetyReviewScreen';
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
import { NotificationSetup } from '@/components/NotificationSetup';
import NotificationCenterScreen from '@/screens/notifications/NotificationCenterScreen';
import TermsOfServiceScreen from '@/screens/profile/TermsOfServiceScreen';
import PrivacyPolicyScreen from '@/screens/profile/PrivacyPolicyScreen';
import LiabilityDisclaimerScreen from '@/screens/settings/LiabilityDisclaimerScreen';
import { AuthProvider, AuthContext } from '@/contexts/AuthContext';
import StripeProviderWrapper from '@/providers/StripeProviderWrapper';
import {
  parseNotificationDeepLink,
  getFallbackRoute,
  canNavigateToRoute as checkRouteAvailability,
  logDeepLinkNavigation,
  type NotificationDeepLinkData,
} from '@/services/deepLink';

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
      ListingSafetyReview: 'listing-safety/:listing_id',
      AdminDashboard: 'admin',
      IDVerificationUpload: 'id-verification-upload',
      ManageKidsClub: 'manage-kids-club',
      KidsClubOverview: 'kids-club-overview',
      TransactionHistory: 'billing-history',
      NotificationSetup: 'notification-setup',
      Notifications: 'notifications',
    },
  },
};

const navigationRef = createNavigationContainerRef<any>();

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

  const lastRouteNameRef = React.useRef<string | undefined>(undefined);
  const pendingNotificationDataRef = React.useRef<NotificationDeepLinkData | null>(null);
  const notificationSourceRef = React.useRef<'push' | 'in_app' | 'cold_start'>('push');

  /**
   * MODULE-14 TASK NOTIF-V2-008: Enhanced notification navigation handler
   * Supports all notification types, deep link parsing, and stack management
   */
  const handleNotificationNavigation = React.useCallback(
    (
      rawData: NotificationDeepLinkData | null | undefined,
      source: 'push' | 'in_app' | 'cold_start' = 'push'
    ) => {
      if (!rawData) {
        return;
      }

      // Queue notification if navigator not ready (cold start scenario)
      if (!navigationRef.isReady()) {
        pendingNotificationDataRef.current = rawData;
        notificationSourceRef.current = source;
        return;
      }

      // Parse notification data to deep link target
      const target = parseNotificationDeepLink(rawData);

      // Log navigation for debugging and analytics
      logDeepLinkNavigation(source, rawData, target);

      // No valid target - use fallback to home
      if (!target) {
        console.warn('[NAV] Invalid deep link, falling back to Home');
        const fallback = getFallbackRoute();
        if (checkRouteAvailability(fallback.route, navigationRef.getRootState())) {
          navigationRef.navigate(fallback.route as never);
        }
        pendingNotificationDataRef.current = null;
        return;
      }

      // Check if target route is available in current navigation state
      if (!checkRouteAvailability(target.route, navigationRef.getRootState())) {
        // Route not available yet (e.g., auth screen not mounted) - queue for later
        pendingNotificationDataRef.current = rawData;
        notificationSourceRef.current = source;
        return;
      }

      // Navigate based on action type
      if (target.action === 'reset') {
        // Reset navigation stack (e.g., for post-logout onboarding reminders)
        navigationRef.reset({
          index: 0,
          routes: [{ name: target.route, params: target.params } as never],
        });
      } else {
        // Standard navigation (push to stack)
        if (target.params) {
          (navigationRef as any).navigate(target.route, target.params);
        } else {
          (navigationRef as any).navigate(target.route);
        }
      }

      // Clear pending notification
      pendingNotificationDataRef.current = null;
    },
    []
  );

  // Handle notification taps while app is running (foreground/background)
  React.useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationDeepLinkData;
      handleNotificationNavigation(data, 'push');
    });

    // Handle cold-start notification taps (app was killed, opened via notification)
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }

      const data = response.notification.request.content.data as NotificationDeepLinkData;
      handleNotificationNavigation(data, 'cold_start');
    });

    return () => {
      responseSubscription.remove();
    };
  }, [handleNotificationNavigation]);

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
    } catch (error) {
      console.warn('[NAV] route logging failed', error);
    }
  }, []);

  const onNavigationReady = React.useCallback(() => {
    logRouteChange();

    if (pendingNotificationDataRef.current) {
      handleNotificationNavigation(
        pendingNotificationDataRef.current,
        notificationSourceRef.current
      );
    }
  }, [handleNotificationNavigation, logRouteChange]);

  const onNavigationStateChange = React.useCallback(() => {
    logRouteChange();

    if (pendingNotificationDataRef.current) {
      handleNotificationNavigation(
        pendingNotificationDataRef.current,
        notificationSourceRef.current
      );
    }
  }, [handleNotificationNavigation, logRouteChange]);

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
      onReady={onNavigationReady}
      onStateChange={onNavigationStateChange}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && isSuspended ? (
          // Authenticated + Suspended -> blocked account screen
          <Stack.Screen
            name="SuspendedAccount"
            component={SuspendedAccountScreen}
            options={{ headerShown: false }}
          />
        ) : isAuthenticated && isOnboardingComplete ? (
          // Authenticated + Onboarding Complete → Dashboard stack
          <>
            <Stack.Screen
              name="Home"
              component={UserDashboardScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="BrowseItems"
              component={BrowseItemsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CategoryBrowse"
              component={CategoryBrowseScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemDetailScreen"
              component={ItemDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionChoice"
              component={SubscriptionChoiceScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-04: Listing screens */}
            <Stack.Screen
              name="MyListings"
              component={MyListingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateListing"
              component={CreateListingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditListing"
              component={EditListingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ListingDetail"
              component={ItemDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ListingSafetyReview"
              component={ListingSafetyReviewScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeInitiation"
              component={TradeInitiationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeList"
              component={require('@/screens/trade/TradeListScreen').default}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeDetail"
              component={TradeTimelineScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeTimeline"
              component={TradeTimelineScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeSuccess"
              component={TradeSuccessScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-07: Messaging screens */}
            <Stack.Screen
              name="Conversations"
              component={require('@/screens/messaging/ConversationsListScreen').default}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={require('@/screens/messaging/ChatScreen').default}
              options={{ headerShown: false }}
            />
            {/* MODULE-06 (EXT): Seller Payout screens */}
            <Stack.Screen
              name="PayoutSettings"
              component={PayoutSettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SellerEarnings"
              component={SellerEarningsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ReviewModeration"
              component={ReviewModerationScreen}
              options={{ headerShown: false }}
            />
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
            <Stack.Screen
              name="Badges"
              component={BadgesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Leaderboard"
              component={LeaderboardScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-09: Swap Points screens */}
            <Stack.Screen
              name="SpWallet"
              component={SpWalletScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-08: Review screens */}
            <Stack.Screen
              name="SubmitReview"
              component={SubmitReviewScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-11: Referral screens */}
            <Stack.Screen
              name="ReferralDashboard"
              component={ReferralDashboardScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-10: ID Badge Verification */}
            <Stack.Screen
              name="IDVerificationUpload"
              component={IDVerificationUploadScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NotificationPreferences"
              component={NotificationPreferencesScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-14 NOTIF-V2-002: Push notification setup screen */}
            <Stack.Screen
              name="NotificationSetup"
              component={NotificationSetup}
              options={{ title: 'Enable Notifications' }}
            />
            {/* MODULE-14 NOTIF-V2-006: In-App Notification Center */}
            <Stack.Screen
              name="Notifications"
              component={NotificationCenterScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-13 SAFETY-010: TOS screen */}
            <Stack.Screen
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{ title: 'Terms of Service' }}
            />
            {/* MODULE-13 SAFETY-011: Privacy Policy Screen */}
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{ title: 'Privacy Policy' }}
            />
            {/* MODULE-13 SAFETY-012: Liability Disclaimer Screen */}
            <Stack.Screen
              name="LiabilityDisclaimer"
              component={LiabilityDisclaimerScreen}
              options={{ title: 'Liability Disclaimer' }}
            />
            {/* Add more authenticated screens as needed */}
          </>
        ) : (
          // Unauthenticated OR Onboarding Incomplete → Onboarding/Auth stack
          <>
            <Stack.Screen
              name="Landing"
              component={LandingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PhoneVerification"
              component={PhoneVerificationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProfileSetup"
              component={ProfileSetupScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProfileCompletion"
              component={ProfileCompletionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionChoice"
              component={SubscriptionChoiceScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LocationPicker"
              component={LocationPickerScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NodeSelection"
              component={NodeSelectionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FeatureHighlights"
              component={FeatureHighlightsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-13 SAFETY-010: TOS screen (Unauthenticated access) */}
            <Stack.Screen
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{ title: 'Terms of Service' }}
            />
            {/* MODULE-13 SAFETY-011: Privacy Policy Screen (Unauthenticated access) */}
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{ title: 'Privacy Policy' }}
            />
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
