import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
// Re-enable UI providers now that sanitizer is in place to prevent token propagation to native
import { NativeBaseProvider } from 'native-base';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
