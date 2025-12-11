import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import DebugExpoScreen from './src/screens/Debug/DebugExpoScreen'
// Ensure Sentry gets initialized even in the dev entry so we can test events
// Note: in Expo Go, native transport isn't available; Sentry may fall back to JS transport.
import './src/utils/sentry'
import ErrorBoundaryDev from './src/components/ErrorBoundaryDev'
import { View } from 'react-native'

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundaryDev>
        <View style={{ flex: 1 }}>
          <DebugExpoScreen />
        </View>
      </ErrorBoundaryDev>
    </SafeAreaProvider>
  )
}
