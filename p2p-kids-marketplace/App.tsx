import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
// Initialize Sentry as early as possible
import Sentry from './src/utils/sentry';
import { StatusBar } from 'expo-status-bar';
import { NativeBaseProvider } from 'native-base';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { testSupabaseConnection } from './src/utils/testSupabase';

function App() {
  useEffect(() => {
    testSupabaseConnection();
    // Initialize analytics on startup
    import('./src/services/analytics').then(({ initAnalytics, trackEvent }) => {
      // Do not crash startup if amplitude is missing
      initAnalytics().then(() => {
        // Track an initial event for verification purposes
        try {
          trackEvent('app_initialized');
        } catch (e) {
          // ignore
        }
      });
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NativeBaseProvider>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
        <StatusBar style="auto" />
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
}

// Wrap App with Sentry's error boundary to capture React errors
export default Sentry?.wrap ? Sentry.wrap(App) : App;
