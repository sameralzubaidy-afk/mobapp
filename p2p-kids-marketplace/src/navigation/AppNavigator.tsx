import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import BrowseItemsScreen from '@/screens/home/BrowseItemsScreen';
import SearchScreen from '@/screens/home/SearchScreen';
import CategoryBrowseScreen from '@/screens/home/CategoryBrowseScreen';
import ItemDetailScreen from '@/screens/home/ItemDetailScreen';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import PhoneVerificationScreen from '@/screens/auth/PhoneVerificationScreen';
import LandingScreen from '@/screens/auth/LandingScreen';
import ProfileSetupScreen from '@/screens/profile/ProfileSetupScreen';
import EditProfileScreen from '@/screens/profile/EditProfileScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '@/screens/auth/ResetPasswordScreen';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
import ProfileCompletionScreen from '@/screens/onboarding/ProfileCompletionScreen';
import SubscriptionChoiceScreen from '@/screens/onboarding/SubscriptionChoiceScreen';
import LocationPickerScreen from '@/screens/onboarding/LocationPickerScreen';
import NodeSelectionScreen from '@/screens/onboarding/NodeSelectionScreen';
import FeatureHighlightsScreen from '@/screens/onboarding/FeatureHighlightsScreen';
import CreateListingScreen from '@/screens/listing/CreateListingScreen';
import EditListingScreen from '@/screens/listing/EditListingScreen';
import MyListingsScreen from '@/screens/listing/MyListingsScreen';
import TradeInitiationScreen from '@/screens/trade/TradeInitiationScreen';
import TradeSuccessScreen from '@/screens/trade/TradeSuccessScreen';
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
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
      ProfileSetup: 'profile-setup',
      Profile: 'profile',
      EditProfile: 'edit-profile',
      ForgotPassword: 'forgot-password',
      Welcome: 'welcome',
      ProfileCompletion: 'profile-completion',
      SubscriptionChoice: 'subscription-choice',
      LocationPicker: 'location-picker',
      NodeSelection: 'node-selection',
      FeatureHighlights: 'feature-highlights',
      MyListings: 'my-listings',
      CreateListing: 'create-listing',
      EditListing: 'edit-listing',
      ListingDetail: 'listing/:listing_id',
      AdminDashboard: 'admin',
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Determine which stack to show based on session + onboarding status
  const isAuthenticated = session !== null;
  const isOnboardingComplete = session?.user?.onboarding_completed === true;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={logRouteChange}
      onStateChange={logRouteChange}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && isOnboardingComplete ? (
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
            <Stack.Screen name="TradeList" component={require('@/screens/trade/TradeListScreen').default} />
            <Stack.Screen name="TradeDetail" component={require('@/screens/trade/TradeDetailScreen').default} />
            <Stack.Screen name="TradeSuccess" component={TradeSuccessScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
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
