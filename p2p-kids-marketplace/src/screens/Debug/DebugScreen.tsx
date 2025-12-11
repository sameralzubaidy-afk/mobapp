import React from 'react'
import { View, Text, Button } from 'react-native'
import Sentry from '../../utils/sentry'
import { trackEvent } from '@/services/analytics';

export default function DebugScreen() {
  const handleThrow = () => {
    try {
      throw new Error('Test error from DebugScreen to verify Sentry capture')
    } catch (err) {
      Sentry.captureException(err)
      // eslint-disable-next-line no-console
      console.warn('Captured error to Sentry (if configured)')
    }
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Debug — Sentry Test</Text>
      <Button title="Throw & Capture" onPress={handleThrow} />
      <Button title="Send Amplitude Test Event" onPress={() => { trackEvent('dev_analytics_test'); alert('Amplitude test event sent'); }} />
    </View>
  )
}
