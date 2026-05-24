import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';
import GlobalAlertProvider from './src/providers/GlobalAlertProvider';
import StartupDebugOverlay from './src/components/StartupDebugOverlay';
import { NotificationAnalyticsService } from './src/services/notificationAnalytics';

// Suppress known-harmless warnings that cause heavy LogBox symbolication in dev
// mode (symbolication blocks the JS thread and can trigger Android ANR).
LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op',
  'Non-serializable values were found in the navigation state',
  'Sending `onAnimatedValueUpdate`',
  'SafeAreaView has been deprecated',
  'getItemById join failed, falling back to separate fetches',
]);

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  // Load Inter fonts
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Initialize once on mount — must NOT be inside the font effect or it fires
  // twice (once on mount, once when fontsLoaded flips), generating a duplicate-
  // init warning that triggers heavy LogBox symbolication → Android ANR.
  useEffect(() => {
    NotificationAnalyticsService.initialize();
  }, []);

  // Hide splash screen only after fonts are ready.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Show loading indicator while fonts load
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4A7C59" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaProvider>
        <GlobalAlertProvider>
          <AppNavigator />
          <StatusBar style="auto" />
          {/* Debug overlay to show last startup step (only used in development) */}
          {__DEV__ ? <StartupDebugOverlay /> : null}
        </GlobalAlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
