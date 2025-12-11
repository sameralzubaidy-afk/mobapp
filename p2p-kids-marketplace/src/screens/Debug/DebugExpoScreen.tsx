import React from 'react'
import { View, Text, Button, Alert } from 'react-native'
import AnalyticsHttp from '@/services/analytics-http'
import Sentry from '@/utils/sentry'
import * as SentryNative from '@sentry/react-native'
import Constants from 'expo-constants'

const fakeSentryCapture = (err: any) => {
  // For Expo Go, we don't have native Sentry; log and alert for dev
  // eslint-disable-next-line no-console
  console.warn('Sentry capture (Dev):', err)
  Alert.alert('Sentry (Dev)', 'Captured error (dev-only)')
}

export default function DebugExpoScreen() {
  const handleThrow = () => {
    try {
      throw new Error('Test error from DebugExpoScreen to verify Sentry capture (dev-only)')
    } catch (err) {
      fakeSentryCapture(err)
    }
  }

  const sendRealSentry = () => {
    try {
      const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || Constants.expoConfig?.extra?.EXPO_PUBLIC_SENTRY_DSN || ''
      // If the normal app Sentry util is not initialized (because we use the dev bundle), initialize a JS-only transport.
      if (!Sentry || typeof Sentry.captureException !== 'function') {
        if (!DSN) {
          Alert.alert('Sentry', 'Sentry DSN not configured; cannot send test event')
          return
        }
        SentryNative.init({ dsn: DSN, environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development', enableNative: false })
      }
      if (typeof SentryNative.captureException !== 'function') {
        Alert.alert('Sentry', 'Sentry not initialized or capture not available (Expo Go may not support native Sentry).')
        return
      }
      SentryNative.captureException(new Error('Test Sentry event from DebugExpoScreen (real)'))
      // Ensure the event flushes; note that flush timeout is approximate
      SentryNative.flush(2000)
      Alert.alert('Sentry', 'Invoked Sentry.captureException (check Sentry dashboard)')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Sentry capture call failed', e)
      Alert.alert('Sentry', 'capture failed (see Metro logs)')
    }
  }

  const sendEvent = () => {
    AnalyticsHttp.trackEventHttp('dev_analytics_test', { from: 'DebugExpoScreen' })
    Alert.alert('Amplitude (Dev)', 'HTTP event sent')
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Debug — Expo Go</Text>
      <Button title="Throw & Capture (Dev)" onPress={handleThrow} />
      <Button title="Send True Sentry Event (Real)" onPress={sendRealSentry} />
      <Button title="Send Amplitude Test Event (HTTP)" onPress={sendEvent} />
    </View>
  )
}
