import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Linking from 'expo-linking';
import { ActivityIndicator, View } from 'react-native';
import HomeFeedScreen from '@/screens/home/HomeFeedScreen';
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
    },
  },
};

/**
 * MODULE-03 AUTH-V2-003: RootNavigator
 * 
 * Handles both authenticated and unauthenticated state transitions
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

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          // Authenticated stack
          <>
            <Stack.Screen name="Home" component={UserDashboardScreen} />
            <Stack.Screen name="HomeFeed" component={HomeFeedScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="SubscriptionChoice" component={SubscriptionChoiceScreen} />
            {/* Add more authenticated screens as needed */}
          </>
        ) : (
          // Unauthenticated stack
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
