import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
// NOTE: Temporary workaround — NativeBaseProvider is disabled to avoid a runtime
// conversion error seen on iOS (string->float conversion for theme tokens). We
// will re-enable once we pin compatible NativeBase / React Native versions
// or update theme tokens to numeric values.
// import { NativeBaseProvider } from 'native-base';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { testSupabaseConnection } from './src/utils/testSupabase';

export default function App() {
  useEffect(() => {
    testSupabaseConnection();
  }, []);

  return (
    <SafeAreaProvider>
        {/* Temporarily render navigation without NativeBaseProvider */}
        <AppNavigator />
        <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
