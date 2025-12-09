import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NativeBaseProvider } from 'native-base';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { testSupabaseConnection } from './src/utils/testSupabase';

export default function App() {
  useEffect(() => {
    testSupabaseConnection();
  }, []);

  return (
    <SafeAreaProvider>
      <NativeBaseProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
}
