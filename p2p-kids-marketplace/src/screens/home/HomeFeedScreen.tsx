import React from 'react';
import { View, Text, ActivityIndicator, Alert, Button as RnButton } from 'react-native';
import { Button as NBButton } from 'native-base';
import { trackEvent } from '@/services/analytics';
import Sentry from '@/utils/sentry';

export function homeSendSentryTest() {
  try {
    throw new Error('dev_sentry_test_from_home')
  } catch (err) {
    Sentry.captureException(err)
    Alert.alert('Debug', 'Sentry test event sent')
  }
}

export function homeSendAmplitudeTest() {
  trackEvent('home_nb_lg_pressed')
  Alert.alert('Debug', 'NB lg pressed')
}

export default function HomeFeedScreen() {
  const showDevButtons = typeof __DEV__ !== 'undefined' ? __DEV__ : false
  const showTestButtons = !!process.env.JEST_WORKER_ID
  const showDebugButtons = showDevButtons || showTestButtons
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Home Feed</Text>
      {/* Use valid numeric styles and native-base sizes */}
      <View style={{ width: 100, height: 20, backgroundColor: 'tomato', marginTop: 12 }} />

      <NBButton size="lg" mt={4} onPress={homeSendAmplitudeTest} testID="nb-lg" accessibilityLabel="nb-lg">NB lg</NBButton>

      <NBButton size="md" mt={4} onPress={homeSendSentryTest} testID="nb-sentry" accessibilityLabel="nb-sentry">Send Sentry Test</NBButton>

      {showDebugButtons && (
        <>
          <RnButton title="RN Sentry Test" onPress={homeSendSentryTest} testID="rn-sentry-home" />
          <RnButton title="RN Amplitude Test" onPress={homeSendAmplitudeTest} testID="rn-amplitude-home" />
        </>
      )}

      {/* Debug repro #3: React Native ActivityIndicator with token */}
      <ActivityIndicator size={'large'} color="#3b82f6" style={{ marginTop: 12 }} />
    </View>
  );
}
