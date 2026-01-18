import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// NOTE: Temporary workaround — NativeBaseProvider is disabled to avoid a runtime
// conversion error seen on iOS (string->float conversion for theme tokens). We
// will re-enable once we pin compatible NativeBase / React Native versions
// or update theme tokens to numeric values.
// import { NativeBaseProvider } from 'native-base';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { testSupabaseConnection } from './src/utils/testSupabase';
import StartupDebugOverlay from './src/components/StartupDebugOverlay';

export default function App() {
  useEffect(() => {
    console.log('[APP] App mounted');
    // Commented out: testSupabaseConnection can hang on Android
    // Connection is tested during auth initialization instead
    // testSupabaseConnection();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaProvider>
        {/* Temporarily render navigation without NativeBaseProvider */}
        <AppNavigator />
        <StatusBar style="auto" />
        {/* Debug overlay to show last startup step (only used in development) */}
        {__DEV__ ? <StartupDebugOverlay /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
