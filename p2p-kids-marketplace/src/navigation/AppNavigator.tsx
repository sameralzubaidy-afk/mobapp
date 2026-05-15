import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as ExpoLinking from 'expo-linking';
import DiscoverScreen from '@/screens/home/DiscoverScreen';
import CategoryBrowseScreen from '@/screens/home/CategoryBrowseScreen';
import ItemDetailScreen from '@/screens/home/ItemDetailScreen';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';
import SpWalletScreen from '@/screens/sp/SpWalletScreen';
import SpTransactionHistoryScreen from '@/screens/sp/SpTransactionHistoryScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import PhoneVerificationScreen from '@/screens/auth/PhoneVerificationScreen';
import LandingScreen from '@/screens/auth/LandingScreen';
import SuspendedAccountScreen from '@/screens/auth/SuspendedAccountScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import BadgesScreen from '@/screens/profile/BadgesScreen';
import LeaderboardScreen from '@/screens/profile/LeaderboardScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '@/screens/auth/ResetPasswordScreen';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
import SubscriptionChoiceScreen from '@/screens/onboarding/SubscriptionChoiceScreen';
import FeatureHighlightsScreen from '@/screens/onboarding/FeatureHighlightsScreen';
// MODULE-18 EDU-004: Trading education onboarding carousel
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
import CreateListingScreen from '@/screens/listing/CreateListingScreen';
import ItemCreateScreen from '@/screens/ItemCreateScreen';
import BulkListingCreateScreen from '@/screens/BulkListingCreateScreen';
import EditListingScreen from '@/screens/listing/EditListingScreen';
import MyListingsScreen from '@/screens/listing/MyListingsScreen';
import ListingSafetyReviewScreen from '@/screens/listing/ListingSafetyReviewScreen';
import TradeOfferScreen from '@/screens/trade/TradeOfferScreen';
import TradeSuccessScreen from '@/screens/trade/TradeSuccessScreen';
import TradeTimelineScreen from '@/screens/trade/TradeTimelineScreen';
import TradeReviewScreen from '@/screens/trade/TradeReviewScreen';
import TradeDisputeScreen from '@/screens/trade/TradeDisputeScreen';
import CartScreen from '@/screens/cart/CartScreen';
import BundleBuilderScreen from '@/screens/cart/BundleBuilderScreen';
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
import SubscriptionPlansScreen from '@/screens/subscription/SubscriptionPlansScreen';
import PlanComparisonScreen from '@/screens/subscription/PlanComparisonScreen';
import UpgradePlanScreen from '@/screens/subscription/UpgradePlanScreen';
import CancelSubscriptionScreen from '@/screens/subscription/CancelSubscriptionScreen';
import SubscriptionExpiredScreen from '@/screens/subscription/SubscriptionExpiredScreen';
import MySubscriptionScreen from '@/screens/subscription/MySubscriptionScreen';
import TransactionHistoryScreen from '@/screens/profile/TransactionHistoryScreen';
import { SubmitReviewScreen } from '@/screens/review/SubmitReviewScreen';
import { ReferralsScreen } from "@/screens/referrals/ReferralsScreen";
import SettingsScreen from '@/screens/profile/SettingsScreen';
import LinkedAccountsScreen from '@/screens/profile/LinkedAccountsScreen';
import NotificationPreferencesScreen from '@/screens/profile/NotificationPreferencesScreen';
import { NotificationSetup } from '@/components/NotificationSetup';
import NotificationCenterScreen from '@/screens/notifications/NotificationCenterScreen';
import UnsubscribeScreen from '@/screens/UnsubscribeScreen';
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
// NOTE: Some profile/onboarding screens use expo-image-picker.
// Require them lazily to avoid startup crash when native module is unavailable.
const ProfileSetupScreen = require('@/screens/profile/ProfileSetupScreen').default;
const EditProfileScreen = require('@/screens/profile/EditProfileScreen').default;
const IDVerificationUploadScreen = require('@/screens/profile/IDVerificationUploadScreen').default;

const Stack = createStackNavigator();

// Deep linking configuration for password reset
const linking = {
  prefixes: [ExpoLinking.createURL('/'), 'p2pkidsmarketplace://', 'https://p2pkidsmarketplace.com'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Landing: '',
      Login: 'login',
      Signup: 'signup',
      Home: 'home',
      Discover: 'discover',
      Cart: 'cart',
      SpWallet: 'sp-wallet',
      SpTransactionHistory: 'sp-history',
      PhoneVerification: 'phone-verification',
      SuspendedAccount: 'suspended-account',
      ProfileSetup: 'profile-setup',
      Profile: 'profile',
      EditProfile: 'edit-profile',
      ForgotPassword: 'forgot-password',
      Welcome: 'welcome',
      SubscriptionChoice: 'subscription-choice',
      ContinueKidsClub: 'continue-kids-club',
      SubscriptionPlans: 'subscription-plans',
      PlanComparison: 'plan-comparison',
      UpgradePlan: 'upgrade-plan',
      CancelSubscription: 'cancel-subscription',
      SubscriptionExpired: 'subscription-expired',
      MySubscription: 'my-subscription',
      FeatureHighlights: 'feature-highlights',
      MyListings: 'my-listings',
      CreateListing: 'create-listing',
      ItemCreate: 'create-item',
      BundleBuilder: 'bundle-builder/:sellerId',
      BulkListingCreate: 'bulk-create',
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
      Unsubscribe: 'unsubscribe',
      LinkedAccounts: 'linked-accounts',
    },
  },
};

const navigationRef = createNavigationContainerRef<any>();

function isTransientNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String((error as { message?: unknown } | null)?.message || '');

  const normalized = message.toLowerCase();

  return (
    normalized.includes('network request failed') ||
    normalized.includes('fetch failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out')
  );
}

/**
 * MODULE-03 AUTH-V2-003: RootNavigator
 * MODULE-18 EDU-004: Onboarding carousel first-run gating
 *
 * Handles both authenticated and unauthenticated state transitions
 *
 * KEY FIX: Check BOTH session AND onboarding_completed status
 * - If session exists BUT onboarding carousel not complete → show carousel
 * - If session exists AND onboarding complete → show authenticated/dashboard stack
 * - If no session → show landing/auth stack
 */
function RootNavigator() {
  const { session, isLoading } = React.useContext(AuthContext);
  const [shouldShowOnboardingCarousel, setShouldShowOnboardingCarousel] = React.useState(false);
  const [onboardingCheckComplete, setOnboardingCheckComplete] = React.useState(false);
  const [onboardingCheckedUserId, setOnboardingCheckedUserId] = React.useState<string | null>(
    null
  );
  const currentUserId = session?.user?.user_id ?? session?.user?.id ?? null;

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

  // MODULE-18 EDU-004: Check if onboarding carousel should be shown
  React.useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      // Reset gate state whenever auth user changes to avoid stale decisions
      // leaking across logout/login transitions.
      setShouldShowOnboardingCarousel(false);
      setOnboardingCheckComplete(false);
      setOnboardingCheckedUserId(null);

      if (!currentUserId) {
        setShouldShowOnboardingCarousel(false);
        setOnboardingCheckComplete(true);
        setOnboardingCheckedUserId(null);
        return;
      }

      try {
        const { shouldShowOnboarding } = await import('@/services/educationAnalyticsService');
        const shouldShow = await shouldShowOnboarding(currentUserId);

        if (cancelled) {
          return;
        }

        setShouldShowOnboardingCarousel(shouldShow);
        setOnboardingCheckedUserId(currentUserId);
        setOnboardingCheckComplete(true);
      } catch (error) {
        if (isTransientNetworkError(error)) {
          console.warn('[NAV] Onboarding check skipped due transient network issue');
        } else {
          console.error('[NAV] Onboarding check error:', error);
        }

        if (cancelled) {
          return;
        }

        setShouldShowOnboardingCarousel(false);
        setOnboardingCheckedUserId(currentUserId);
        setOnboardingCheckComplete(true);
      }
    }

    void checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

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
    if (Constants?.appOwnership === 'expo') {
      return;
    }

    const Notifications = require('expo-notifications') as typeof import('expo-notifications');

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationDeepLinkData;
        handleNotificationNavigation(data, 'push');
      }
    );

    // Handle cold-start notification taps (app was killed, opened via notification)
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) {
          return;
        }

        const data = response.notification.request.content.data as NotificationDeepLinkData;
        handleNotificationNavigation(data, 'cold_start');
      })
      .catch((error) => {
        console.warn('[NAV] getLastNotificationResponseAsync failed', error);
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

  const onboardingDecisionReady =
    !currentUserId ||
    (onboardingCheckComplete && onboardingCheckedUserId === currentUserId);

  if ((isLoading && !forceRender) || !onboardingDecisionReady) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Determine which stack to show based on auth status.
  // Authenticated users should land in the dashboard stack immediately after login.
  const isAuthenticated = session !== null;
  const isSuspended = session?.user?.account_status === 'suspended';
  const isSubscriptionExpired = session?.subscription_status === 'expired';

  // MODULE-18 EDU-004: Show onboarding carousel if needed
  const showOnboardingCarousel = isAuthenticated && shouldShowOnboardingCarousel;
  const navigatorKey = `${currentUserId ?? 'guest'}:${showOnboardingCarousel ? 'onboarding' : 'home'}:${isSubscriptionExpired ? 'expired' : 'active'}`;
  const subscriptionHeaderOptions = {
    headerShown: true,
    headerTintColor: '#5DBB8E',
    headerBackTitleVisible: false,
    headerBackImage: () => <Text style={{ fontSize: 28, color: '#5DBB8E' }}>←</Text>,
    headerTitleAlign: 'center' as const,
    headerStyle: {
      backgroundColor: '#FFFFFF',
    },
    headerTitleStyle: {
      color: '#1A1A1A',
      fontWeight: '700' as const,
      fontSize: 18,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={onNavigationReady}
      onStateChange={onNavigationStateChange}
    >
      <Stack.Navigator
        key={navigatorKey}
        screenOptions={{ headerShown: false }}
        initialRouteName={isSubscriptionExpired ? 'SubscriptionExpired' : undefined}
      >
        {isAuthenticated && isSuspended ? (
          // Authenticated + Suspended -> blocked account screen
          <Stack.Screen
            name="SuspendedAccount"
            component={SuspendedAccountScreen}
            options={{ headerShown: false }}
          />
        ) : isAuthenticated ? (
          // Authenticated users -> Dashboard stack
          <>
            {showOnboardingCarousel ? (
              // MODULE-18 EDU-004: Onboarding carousel (first-run only)
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ headerShown: false }}
              />
            ) : null}

            <Stack.Screen
              name="Home"
              component={UserDashboardScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="Discover"
              component={DiscoverScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Cart"
              component={CartScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BundleBuilder"
              component={BundleBuilderScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CategoryBrowse"
              component={CategoryBrowseScreen}
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
            {/* MODULE-04 V3: Photo-first listing creation */}
            <Stack.Screen
              name="ItemCreate"
              component={ItemCreateScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BulkListingCreate"
              component={BulkListingCreateScreen}
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
              component={TradeOfferScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeReview"
              component={TradeReviewScreen}
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
              name="TradeDispute"
              component={TradeDisputeScreen}
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
              options={{ title: 'Trial Conversion Test' }}
            />
            <Stack.Screen
              name="ContinueKidsClub"
              component={ContinueKidsClubScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Continue Kids Club+' }}
            />
            <Stack.Screen
              name="SubscriptionPayment"
              component={SubscriptionPaymentScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Subscription Payment' }}
            />
            <Stack.Screen
              name="SubscriptionSuccess"
              component={SubscriptionSuccessScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Subscription Success' }}
            />
            <Stack.Screen
              name="SubscriptionStatus"
              component={SubscriptionStatusScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Subscription Status' }}
            />
            <Stack.Screen
              name="ManageKidsClub"
              component={ManageKidsClubScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Manage Kids Club+' }}
            />
            <Stack.Screen
              name="KidsClubOverview"
              component={SubscriptionPlansScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Kids Club+' }}
            />
            <Stack.Screen
              name="SubscriptionPlans"
              component={SubscriptionPlansScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Choose Your Plan' }}
            />
            <Stack.Screen
              name="PlanComparison"
              component={PlanComparisonScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Compare Plans' }}
            />
            <Stack.Screen
              name="UpgradePlan"
              component={UpgradePlanScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Upgrade Plan' }}
            />
            <Stack.Screen
              name="CancelSubscription"
              component={CancelSubscriptionScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Cancel Subscription' }}
            />
            <Stack.Screen
              name="SubscriptionExpired"
              component={SubscriptionExpiredScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Subscription Expired' }}
            />
            <Stack.Screen
              name="MySubscription"
              component={MySubscriptionScreen}
              options={{ ...subscriptionHeaderOptions, title: 'My Subscription' }}
            />
            <Stack.Screen
              name="TransactionHistory"
              component={TransactionHistoryScreen}
              options={{ ...subscriptionHeaderOptions, title: 'Billing History' }}
            />
            <Stack.Screen name="Badges" component={BadgesScreen} options={{ headerShown: false }} />
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
            {/* MODULE-15.1 FLOW-10/11: SP Transaction History */}
            <Stack.Screen
              name="SpTransactionHistory"
              component={SpTransactionHistoryScreen}
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
              component={ReferralsScreen}
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
            {/* MODULE-18 EDU-005: Help screen */}
            <Stack.Screen
              name="Help"
              component={require('@/screens/help/HelpScreen').default}
              options={{ headerShown: false }}
            />
            {/* MODULE-03 AUTH-V3-004: Linked Accounts Management */}
            <Stack.Screen
              name="LinkedAccounts"
              component={LinkedAccountsScreen}
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
            {/* MODULE-14 NOTIF-V2-009: Email Unsubscribe */}
            <Stack.Screen
              name="Unsubscribe"
              component={UnsubscribeScreen}
              options={{ title: 'Unsubscribe' }}
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
          // Unauthenticated users -> Onboarding/Auth stack
          <>
            <Stack.Screen
              name="Landing"
              component={LandingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
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
              name="SubscriptionChoice"
              component={SubscriptionChoiceScreen}
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
