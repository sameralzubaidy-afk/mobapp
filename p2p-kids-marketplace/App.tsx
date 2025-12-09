import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
// Re-enable UI providers now that sanitizer is in place to prevent token propagation to native
import { NativeBaseProvider } from 'native-base';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Ensure react-native-screens Screen props are sanitized before they reach native.
// We monkey-patch early at app startup so any import/use of RNSScreen will go
// through our sanitizer. This avoids string tokens like 'large' accidentally
// being sent to native numeric props when third-party libs render RNSScreen.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rns = require('react-native-screens');
  if (rns && rns.Screen) {
    // Lazy-load sanitizer to avoid import cycles
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { sanitizePropsObject } = require('./src/utils/propSanitizer');

    const OrigScreen = rns.Screen;
    // Create wrapper that sanitizes props shallowly before forwarding
    const WrappedScreen = function WrappedScreen(props: any) {
      const sanitized = sanitizePropsObject(props || {});
      // Quick dev logging to detect suspicious string->number conversions
      if (process.env.NODE_ENV !== 'production') {
        Object.keys(sanitized).forEach((k) => {
          const v = sanitized[k];
          if (typeof v === 'string' && /large|medium|all/i.test(v)) {
            // eslint-disable-next-line no-console
            console.debug('[SafeScreen] sanitized prop', k, '=>', v);
          }
        });
      }
      // Preserve children and rest of props
      const React = require('react');
      return React.createElement(OrigScreen, sanitized);
    };

    // Replace the exported Screen with the wrapper
    rns.Screen = WrappedScreen;
  }
} catch (e) {
  // If react-native-screens is not present or fails, continue without crashing
  // (app will fallback to View for SafeScreen wrapper).
  // We intentionally swallow this error because not all environments have rn-screens.
}
import AppNavigator from './src/navigation/AppNavigator';
// import { testSupabaseConnection } from './src/utils/testSupabase';

export default function App() {
  // TEMPORARY: Disabled Supabase test - may trigger token conversion
  // useEffect(() => {
  //   testSupabaseConnection();
  // }, []);

  return (
    <SafeAreaProvider>
      <NativeBaseProvider>
        <View style={{ flex: 1 }}>
          <AppNavigator />
          <StatusBar style="auto" />
        </View>
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
}
