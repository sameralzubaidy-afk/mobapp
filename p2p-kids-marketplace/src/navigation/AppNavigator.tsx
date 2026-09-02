import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View } from 'react-native';
import Constants from 'expo-constants';
import * as ExpoLinking from 'expo-linking';
import { LoadingSpinner } from '@/components/ui';
import { navigationRef } from '@/navigation/navigationRef';
import { HomeTabNavigator } from '@/navigation/HomeTabNavigator';
import { CartProvider } from '@/contexts/CartContext';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import DiscoverScreen from '@/screens/home/DiscoverScreen';
import ConversationsListScreen from '@/screens/messaging/ConversationsListScreen';
import CategoryBrowseScreen from '@/screens/home/CategoryBrowseScreen';
import ItemDetailScreen from '@/screens/home/ItemDetailScreen';
import SpWalletScreen from '@/screens/sp/SpWalletScreen';
import SpTransactionHistoryScreen from '@/screens/sp/SpTransactionHistoryScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import PhoneVerificationScreen from '@/screens/auth/PhoneVerificationScreen';
import LandingScreen from '@/screens/auth/LandingScreen';
import SuspendedAccountScreen from '@/screens/auth/SuspendedAccountScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import SellerProfileScreen from '@/screens/profile/SellerProfileScreen';
import BadgesScreen from '@/screens/profile/BadgesScreen';
import LeaderboardScreen from '@/screens/profile/LeaderboardScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '@/screens/auth/ResetPasswordScreen';
import JoinKidsClubScreen from '@/screens/subscription/JoinKidsClubScreen';
// MODULE-18 EDU-004: Trading education onboarding carousel
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
import ItemCreateScreen from '@/screens/ItemCreateScreen';
import BulkListingCreateScreen from '@/screens/BulkListingCreateScreen';
import EditListingScreen from '@/screens/listing/EditListingScreen';
import MyListingsScreen from '@/screens/listing/MyListingsScreen';
import ListingSafetyReviewScreen from '@/screens/listing/ListingSafetyReviewScreen';
import TradeOfferScreen from '@/screens/trade/TradeOfferScreen';
import TradeSuccessScreen from '@/screens/trade/TradeSuccessScreen';
import TradeTimelineScreen from '@/screens/trade/TradeTimelineScreen';
import TradeReviewScreen from '@/screens/trade/TradeReviewScreen';
import ReviewOfferScreen from '@/screens/trade/ReviewOfferScreen';
import TradeListScreen from '@/screens/trade/TradeListScreen';
import TradeV2ComponentsPreviewScreen from '@/screens/trade/TradeV2ComponentsPreviewScreen';
import CartScreen from '@/screens/cart/CartScreen';
import CartCheckoutScreen from '@/screens/cart/CartCheckoutScreen';
import BundleBuilderScreen from '@/screens/cart/BundleBuilderScreen';
import MoreFromThisSellerScreen from '@/screens/home/MoreFromThisSellerScreen';
import FavoritesScreen from '@/screens/favorites/FavoritesScreen';
import PayoutSettingsScreen from '@/screens/seller/PayoutSettingsScreen';
import SellerEarningsScreen from '@/screens/seller/SellerEarningsScreen';
import RequestPayoutScreen from '@/screens/payouts/RequestPayoutScreen';
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import { ReviewModerationScreen } from '@/screens/admin/ReviewModerationScreen';
import TrialConversionTestScreen from '@/screens/admin/TrialConversionTestScreen';
import ContinueKidsClubScreen from '@/screens/subscription/ContinueKidsClubScreen';
import { SubscriptionPaymentScreen } from '@/screens/subscription/SubscriptionPaymentScreen';
import SubscriptionStatusScreen from '@/screens/subscription/SubscriptionStatusScreen';
import SubscriptionSuccessScreen from '@/screens/subscription/SubscriptionSuccessScreen';
import ManageKidsClubScreen from '@/screens/subscription/ManageKidsClubScreen';
import PlanComparisonScreen from '@/screens/subscription/PlanComparisonScreen';
import UpgradePlanScreen from '@/screens/subscription/UpgradePlanScreen';
import CancelSubscriptionScreen from '@/screens/subscription/CancelSubscriptionScreen';
import SubscriptionExpiredScreen from '@/screens/subscription/SubscriptionExpiredScreen';
import MySubscriptionScreen from '@/screens/subscription/MySubscriptionScreen';
import TransactionHistoryScreen from '@/screens/profile/TransactionHistoryScreen';
import { SubmitReviewScreen } from '@/screens/review/SubmitReviewScreen';
import { ReferralsScreen } from "@/screens/referrals/ReferralsScreen";
import SettingsScreen from '@/screens/profile/SettingsScreen';
import PaymentMethodsScreen from '@/screens/profile/PaymentMethodsScreen';
import LinkedAccountsScreen from '@/screens/profile/LinkedAccountsScreen';
import NotificationPreferencesScreen from '@/screens/profile/NotificationPreferencesScreen';
import { NotificationSetup } from '@/components/NotificationSetup';
import NotificationCenterScreen from '@/screens/notifications/NotificationCenterScreen';
import UnsubscribeScreen from '@/screens/UnsubscribeScreen';
import TermsOfServiceScreen from '@/screens/profile/TermsOfServiceScreen';
import PrivacyPolicyScreen from '@/screens/profile/PrivacyPolicyScreen';
import LiabilityDisclaimerScreen from '@/screens/settings/LiabilityDisclaimerScreen';
import DeleteAccountScreen from '@/screens/settings/DeleteAccountScreen';
// MODULE-15.1 FLOW-26: Misc / Edge-Case Screens
import OfflineScreen from '@/screens/error/OfflineScreen';
import LoadingScreen from '@/screens/LoadingScreen';
import SuccessScreen from '@/screens/feedback/SuccessScreen';
import ErrorScreen from '@/screens/feedback/ErrorScreen';
import ChatScreen from '@/screens/messaging/ChatScreen';
import HelpScreen from '@/screens/help/HelpScreen';
import HelpSupportMenuScreen from '@/screens/support/HelpSupportMenuScreen';
import FAQScreen from '@/screens/support/HelpScreen';
import ContactSupportScreen from '@/screens/support/ContactSupportScreen';
import FAQDetailScreen from '@/screens/support/FAQDetailScreen';
import { AuthProvider, AuthContext } from '@/contexts/AuthContext';
import StripeProviderWrapper from '@/providers/StripeProviderWrapper';
// QA-only logout deep link handler (dev/staging only) — see component for the security gate.
import QaLogoutDeepLinkHandler from '@/components/QaLogoutDeepLinkHandler';
import QaLoginAsDeepLinkHandler from '@/components/QaLoginAsDeepLinkHandler';
import QaForceTradeSuccessDeepLinkHandler from '@/components/QaForceTradeSuccessDeepLinkHandler';
import GlobalAlertProvider from '@/providers/GlobalAlertProvider';
// QA-only session-local toggle deep link handler (dev/staging only) — arms/disarms
// the A03/D02/C04 QA toggles via p2pkidsmarketplace://qa-dev-toggle. See component.
import QaDevToggleDeepLinkHandler from '@/components/QaDevToggleDeepLinkHandler';
// Dev Task 77 item 1: QA-only dev-clear-overlays handler — force-dismisses any
// stuck GlobalAlert/modal via p2pkidsmarketplace://dev-clear-overlays (1 call,
// no app relaunch). Inert in production builds (see component's security gate).
import QaClearOverlaysDeepLinkHandler from '@/components/QaClearOverlaysDeepLinkHandler';
// Dev Task 77 item 3: QA-only qa-set-sp handler — sets an SP value on a cart
// checkout item via p2pkidsmarketplace://qa-set-sp?listing=<id>&amount=<N> (1
// call, no type-and-clear). Inert in production builds (see component's gate).
import QaSetSpDeepLinkHandler from '@/components/QaSetSpDeepLinkHandler';
// Dev Task 84 item 2: QA-only qa-refresh handler — force-refetches the currently
// open screen via p2pkidsmarketplace://qa-refresh (1 call, no nav-away-and-back
// remount). Inert in production builds (see component's security gate).
import QaRefreshDeepLinkHandler from '@/components/QaRefreshDeepLinkHandler';
// Dev Task 84 item 3: QA-only qa-scroll-to handler — scrolls a target testID
// into view on the open screen via p2pkidsmarketplace://qa-scroll-to?testID=<id>
// and logs fresh viewport coords (1 call, no swipe/relist/OCR cycle). Inert in
// production builds (see component's security gate).
import QaScrollToDeepLinkHandler from '@/components/QaScrollToDeepLinkHandler';
// Dev Task 44 item 3: the iOS keyboard-done accessory is rendered ONCE at the app
// root so every TextInput carrying inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
// app-wide (including the shared TextInput components) gets the Done bar. Renders
// nothing on Android and is inert/empty otherwise.
import { KeyboardDoneAccessory } from '@/components/shared/KeyboardDoneAccessory';
// F03 (ACC-TC-F03): real connectivity boundary — navigates to Offline when the
// network drops during active (authenticated) use. Uses navigationRef.
import ConnectivityGate from '@/components/ConnectivityGate';
// J05 (ACC-TC-J05): soft-gate policy re-prompt — routes an authenticated user to
// the acceptance-mode TOS/Privacy screen when the current published policy is
// not accepted (also makes the J02 acceptance path reachable). Uses navigationRef.
import PolicyReacceptanceGate from '@/components/PolicyReacceptanceGate';
import {
  parseNotificationDeepLink,
  getFallbackRoute,
  canNavigateToRoute as checkRouteAvailability,
  logDeepLinkNavigation,
  type NotificationDeepLinkData,
} from '@/services/deepLink';
// MODULE-18 EDU-004: statically imported so the first-run onboarding gate check
// runs in every runtime (Metro AND Jest). A dynamic import() of this module
// throws in the Jest VM ('A dynamic import callback was invoked without
// --experimental-vm-modules'), which silently sent the gate to its catch path
// and hid the carousel — exactly the class of bug the regression test in
// src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx guards against.
import { shouldShowOnboarding } from '@/services/educationAnalyticsService';
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
      CartCheckout: 'cart/checkout',
      Favorites: 'favorites',
      SpWallet: 'sp-wallet',
      SpTransactionHistory: 'sp-history',
      PhoneVerification: 'phone-verification',
      SuspendedAccount: 'suspended-account',
      ProfileSetup: 'profile-setup',
      Profile: 'profile',
      SellerProfile: 'seller-profile/:userId',
      EditProfile: 'edit-profile',
      ForgotPassword: 'forgot-password',
      SubscriptionChoice: 'subscription-choice',
      JoinKidsClub: 'join-kids-club',
      ContinueKidsClub: 'continue-kids-club',
      SubscriptionPlans: 'subscription-plans',
      PlanComparison: 'plan-comparison',
      UpgradePlan: 'upgrade-plan',
      CancelSubscription: 'cancel-subscription',
      SubscriptionExpired: 'subscription-expired',
      MySubscription: 'my-subscription',
      MyListings: 'my-listings',
      ItemCreate: 'create-item',
      BundleBuilder: 'bundle-builder/:sellerId',
      MoreFromThisSeller: 'more-from-seller/:sellerId',
      BulkListingCreate: 'bulk-create',
      EditListing: 'edit-listing',
      ListingDetail: 'listing/:listing_id',
      ListingSafetyReview: 'listing-safety/:listing_id',
      TradeV2ComponentsPreview: 'trade-v2-preview',
      // Dev Task 77 item 5: wire TradeDetail/TradeTimeline into React Navigation
      // linking so `p2pkidsmarketplace://trade/<id>` (and the notification
      // service's `/trade/:id` path) navigates directly to the trade detail
      // screen instead of dead-ending. This is also a production improvement:
      // push notifications carrying a `/trade/<id>` deep_link now resolve via
      // the linking config on cold start, not just via the in-app notification
      // tap handler.
      TradeDetail: 'trade/:tradeId',
      TradeTimeline: 'trade/timeline/:tradeId',
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

export { navigationRef };

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
 *
 * Exported (not just local) so the regression test can render the REAL navigator
 * wiring with a controlled AuthContext — see
 * src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx.
 */
export function RootNavigator() {
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

    type ExpoNotificationResponse = {
      notification: { request: { content: { data: NotificationDeepLinkData } } };
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response: ExpoNotificationResponse) => {
        const data = response.notification.request.content.data as NotificationDeepLinkData;
        handleNotificationNavigation(data, 'push');
      }
    );

    // Handle cold-start notification taps (app was killed, opened via notification)
    void Notifications.getLastNotificationResponseAsync()
      .then((response: ExpoNotificationResponse | null) => {
        if (!response) {
          return;
        }

        const data = response.notification.request.content.data as NotificationDeepLinkData;
        handleNotificationNavigation(data, 'cold_start');
      })
      .catch((error: unknown) => {
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
        <LoadingSpinner fullScreen={false} />
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
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={onNavigationReady}
      onStateChange={onNavigationStateChange}
    >
      <CartProvider>
        <Stack.Navigator
          key={navigatorKey}
          screenOptions={{ headerShown: false }}
          initialRouteName={isSubscriptionExpired ? 'SubscriptionExpired' : undefined}
        >
          {isAuthenticated && isSuspended ? (
            // Authenticated + Suspended -> blocked account screen (support available)
            <>
              <Stack.Screen
                name="SuspendedAccount"
                component={SuspendedAccountScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ContactSupport"
                component={ContactSupportScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : isAuthenticated ? (
            // Authenticated users -> Dashboard stack
            <>
              {showOnboardingCarousel ? (
                // MODULE-18 EDU-004: Onboarding carousel (first-run only)
                <Stack.Screen
                  name="Onboarding"
                  component={OnboardingScreen}
                  options={{ headerShown: false }}
                  // MODULE-18 EDU-004 FIX: wire the child->parent gate-flip
                  // callback so PersistentTabBar mounts immediately after
                  // Skip / Get Started (no relaunch). OnboardingScreen calls
                  // route.params.onOnboardingFinished() inside navigateToHome().
                  initialParams={{
                    onOnboardingFinished: () =>
                      setShouldShowOnboardingCarousel(false),
                  }}
                />
              ) : null}

            <Stack.Screen
              name="Home"
              component={HomeTabNavigator}
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
              name="CartCheckout"
              component={CartCheckoutScreen}
              options={{ headerShown: false }}
            />
            {/* Inbox tab — root stack screen so PersistentTabBar can navigate to it */}
            <Stack.Screen
              name="InboxTab"
              component={ConversationsListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BundleBuilder"
              component={BundleBuilderScreen}
              options={{ headerShown: false }}
            />
            {/* SELLER-GROUP-007: "More from this seller" page */}
            <Stack.Screen
              name="MoreFromThisSeller"
              component={MoreFromThisSellerScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-15.2 CART-018: Favorites screen */}
            <Stack.Screen
              name="Favorites"
              component={FavoritesScreen}
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
              name="SellerProfile"
              component={SellerProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionChoice"
              component={JoinKidsClubScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="JoinKidsClub"
              component={JoinKidsClubScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-04: Listing screens */}
            <Stack.Screen
              name="MyListings"
              component={MyListingsScreen}
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
            {/* @deprecated Use ReviewOffer instead. TradeReview is the old broken screen
                that sets in_progress (wrong) instead of calling the EF.
                Kept only for backward compat with stale notification payloads. */}
            <Stack.Screen
              name="TradeReview"
              component={TradeReviewScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ReviewOffer"
              component={ReviewOfferScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TradeList"
              component={TradeListScreen}
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
            <Stack.Screen
              name="TradeV2ComponentsPreview"
              component={TradeV2ComponentsPreviewScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-07: Messaging screens */}
            <Stack.Screen
              name="Conversations"
              component={ConversationsListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-06 (EXT): Seller Payout screens */}
            <Stack.Screen
              name="PayoutSettings"
              component={PayoutSettingsScreen}
              options={{ headerShown: false }}
            />
            {/* DEPRECATED (Dev Task 86, 2026-09-02): SellerEarnings/RequestPayout have
                no live callers (their only caller was the dead PayoutDashboardScreen).
                Kept registered for safety; removal is tracked in each screen file. */}
            <Stack.Screen
              name="SellerEarnings"
              component={SellerEarningsScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-15.1 FLOW-22: Request Payout (redesigned) — DEPRECATED, see above */}
            <Stack.Screen
              name="RequestPayout"
              component={RequestPayoutScreen}
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
              options={{ headerShown: false }}
            />
            {/* DEPRECATED (Dev Task 86, 2026-09-02): SubscriptionPayment (in-app Stripe
                payment) and SubscriptionSuccess are dead — joining is web-first. Kept
                registered for legacy push/deep-link safety; removal tracked in each file. */}
            <Stack.Screen
              name="SubscriptionPayment"
              component={SubscriptionPaymentScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionSuccess"
              component={SubscriptionSuccessScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionStatus"
              component={SubscriptionStatusScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ManageKidsClub"
              component={ManageKidsClubScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="KidsClubOverview"
              component={JoinKidsClubScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionPlans"
              component={JoinKidsClubScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PlanComparison"
              component={PlanComparisonScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UpgradePlan"
              component={UpgradePlanScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CancelSubscription"
              component={CancelSubscriptionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SubscriptionExpired"
              component={SubscriptionExpiredScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MySubscription"
              component={MySubscriptionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TransactionHistory"
              component={TransactionHistoryScreen}
              options={{ headerShown: false }}
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
            <Stack.Screen
              name="PaymentMethods"
              component={PaymentMethodsScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-18 EDU-005: Help screen */}
            <Stack.Screen
              name="Help"
              component={HelpScreen}
              options={{ headerShown: false }}
            />
            {/* MODULE-15.1 FLOW-19: Help & Support screens */}
            <Stack.Screen
              name="HelpSupport"
              component={HelpSupportMenuScreen}
              options={{ headerShown: false }}
            />
            {/* FAQ screen — route "Support" must render the published-FAQ screen, not the "How to Earn SP" education screen */}
            <Stack.Screen
              name="Support"
              component={FAQScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ContactSupport"
              component={ContactSupportScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FAQDetail"
              component={FAQDetailScreen}
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
            {/* MODULE-15.1 FLOW-25: Delete Account Screen */}
            <Stack.Screen
              name="DeleteAccount"
              component={DeleteAccountScreen}
              options={{ title: 'Delete Account', headerShown: false }}
            />
            {/* MODULE-15.1 FLOW-26: Misc / Edge-Case Screens */}
            <Stack.Screen
              name="Offline"
              component={OfflineScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Loading"
              component={LoadingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Success"
              component={SuccessScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Error"
              component={ErrorScreen}
              options={{ headerShown: false }}
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
            {/* MODULE-15.1 FLOW-19: Contact Support reachable logged-OUT (unified support flow) */}
            <Stack.Screen
              name="ContactSupport"
              component={ContactSupportScreen}
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
              name="SubscriptionChoice"
              component={JoinKidsClubScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="JoinKidsClub"
              component={JoinKidsClubScreen}
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
            <Stack.Screen
              name="TradeV2ComponentsPreview"
              component={TradeV2ComponentsPreviewScreen}
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
        {/* Hide the floating pill during the first-run onboarding carousel
            (MODULE-18 EDU-004): that flow is gated by Skip/Continue → Home and
            shows its own bottom buttons, so the global nav must not overlap them.
            It re-appears automatically once the carousel completes and the
            navigator key flips to 'home'. */}
        {isAuthenticated && !isSuspended && !showOnboardingCarousel && <PersistentTabBar />}

        {/* F03 (ACC-TC-F03): real connectivity boundary — navigates to the
            Offline screen when the network drops during active (authenticated)
            use. Renders nothing. Uses the shared navigationRef. */}
        <ConnectivityGate />

        {/* J05 (ACC-TC-J05): soft-gate policy re-prompt — on authenticated app
            launch (post-onboarding), if the current published TOS/Privacy isn't
            accepted, navigates to the acceptance-mode screen once per user per
            session (J02 path). Decline/dismiss lets the user continue; the
            re-prompt returns on the next app launch. Renders nothing. */}
        {isAuthenticated && !isSuspended && !showOnboardingCarousel && (
          <PolicyReacceptanceGate enabled />
        )}
      </CartProvider>
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
        {/* QA-only logout deep link handler — must live inside AuthProvider (uses useAuth).
            Inert in production builds (see QaLogoutDeepLinkHandler gate). */}
        <QaLogoutDeepLinkHandler />
        {/* QA-only login-as deep link handler (Dev Task 51) — signs in a named QA
            persona + auto-accepts current TOS/Privacy in one call. Must live inside
            AuthProvider (uses useAuth → setSession). Inert in production builds. */}
        <QaLoginAsDeepLinkHandler />
        {/* QA-only force-trade-success deep link (Dev Task 51 item 5) — renders
            the TradeSuccess completion screen with explicit params (unblocks
            TRD-TC-H04). Must live inside AuthProvider (checks session). Inert in
            production builds. */}
        <QaForceTradeSuccessDeepLinkHandler />
        {/* QA-only session-local toggle handler (no auth dependency — safe anywhere).
            Inert in production builds (see QaDevToggleDeepLinkHandler gate). */}
        <QaDevToggleDeepLinkHandler />
        {/* Dev Task 77 item 1: QA-only dev-clear-overlays handler (no auth dependency —
            safe anywhere). Force-dismisses a stuck GlobalAlert/modal + resets to Home
            via p2pkidsmarketplace://dev-clear-overlays. Inert in production builds. */}
        <QaClearOverlaysDeepLinkHandler />
        {/* Dev Task 77 item 3: QA-only qa-set-sp handler (no auth dependency — safe
            anywhere). Sets an SP value on a cart-checkout item via
            p2pkidsmarketplace://qa-set-sp?listing=<id>&amount=<N>. Inert in production. */}
        <QaSetSpDeepLinkHandler />
        {/* Dev Task 84 item 2: QA-only qa-refresh handler (no auth dependency — safe
            anywhere). Force-refetches the currently-open screen via
            p2pkidsmarketplace://qa-refresh. Inert in production builds. */}
        <QaRefreshDeepLinkHandler />
        {/* Dev Task 84 item 3: QA-only qa-scroll-to handler (no auth dependency — safe
            anywhere). Scrolls a target into view via
            p2pkidsmarketplace://qa-scroll-to?testID=<id>. Inert in production builds. */}
        <QaScrollToDeepLinkHandler />
        {/* iOS keyboard-done accessory — mounted once at the root for every wired
            TextInput app-wide (Dev Task 44 item 3). Android: renders nothing. */}
        <KeyboardDoneAccessory />
        {/* Global branded alert provider (Dev Task 51 item 4): routes EVERY
            Alert.alert through an AX-exposed branded modal (buttons get
            accessible + accessibilityRole="button" + testID), so no native
            UIAlertController ever blocks QA automation. Use useGlobalAlert()
            inside screens for explicit per-button testIDs. */}
        <GlobalAlertProvider>
          <RootNavigator />
        </GlobalAlertProvider>
      </StripeProviderWrapper>
    </AuthProvider>
  );
}
