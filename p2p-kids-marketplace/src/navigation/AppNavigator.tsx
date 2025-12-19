import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import HomeFeedScreen from '@/screens/home/HomeFeedScreen';
import BrowseItemsScreen from '@/screens/home/BrowseItemsScreen';
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
import { AuthProvider, AuthContext } from '@/contexts/AuthContext';

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
      HomeFeed: 'feed',
      BrowseItems: 'browse',
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
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && isOnboardingComplete ? (
          // Authenticated + Onboarding Complete → Dashboard stack
          <>
            <Stack.Screen name="Home" component={UserDashboardScreen} />
            <Stack.Screen name="HomeFeed" component={HomeFeedScreen} />
            <Stack.Screen name="BrowseItems" component={BrowseItemsScreen} />
            <Stack.Screen name="ItemDetailScreen" component={ItemDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="SubscriptionChoice" component={SubscriptionChoiceScreen} />
            {/* MODULE-04: Listing screens */}
            <Stack.Screen name="MyListings" component={MyListingsScreen} />
            <Stack.Screen name="CreateListing" component={CreateListingScreen} />
            <Stack.Screen name="EditListing" component={EditListingScreen} />
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
      <RootNavigator />
    </AuthProvider>
  );
}
