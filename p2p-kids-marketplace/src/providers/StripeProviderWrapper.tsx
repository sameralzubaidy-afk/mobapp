import React from 'react';
import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

import { StripeProvider } from '@stripe/stripe-react-native';

function isExpoGo() {
  // In Expo Go, appOwnership is typically 'expo'. In dev builds it's usually 'standalone'/'guest'.
  return Constants.appOwnership === 'expo';
}

function hasStripeNativeModule() {
  // Stripe RN module registers a native module. Name can differ by version/platform.
  const nativeModules: any = NativeModules;
  return Boolean(
    nativeModules?.StripeSdk ||
    nativeModules?.Stripe ||
    nativeModules?.RNStripe ||
    nativeModules?.StripeReactNative
  );
}

export default function StripeProviderWrapper({
  children,
  publishableKey,
  merchantIdentifier,
}: {
  children: React.ReactElement | React.ReactElement[];
  publishableKey: string;
  merchantIdentifier?: string;
}): React.ReactElement {
  // Validate publishable key. Always provide a fallback starting with 'pk_'
  // so that <StripeProvider> doesn't throw errors when hooks like useStripe() run.
  const isValidFormat =
    publishableKey &&
    publishableKey.startsWith('pk_') &&
    !publishableKey.includes('YOUR_KEY') &&
    !publishableKey.includes('your-key');

  const safePublishableKey = isValidFormat ? publishableKey : 'pk_test_TYaaAAAAAAAAAAAAAAAAAAAA'; // generic valid mock structure so Native SDK won't crash

  if (!isValidFormat) {
    if (__DEV__) {
      console.error('[Stripe] Invalid or missing publishableKey:', publishableKey?.slice(0, 10));
    }
    // We intentionally do NOT return <>{children}</> here, because downstream
    // components calling useStripe() would fatally crash due to missing StripeContext.
  }

  // Check for native module availability
  const hasNativeModule = hasStripeNativeModule();
  const inExpoGo = isExpoGo();

  if (inExpoGo && !hasNativeModule) {
    if (__DEV__) {
      console.warn(
        `[Stripe] Running in Expo Go without native module (platform=${Platform.OS}). ` +
          'Some Stripe features may not work. Use expo run:android for full functionality.'
      );
    }
    // Still try to provide Stripe context for basic operations
  }

  return (
    <StripeProvider
      publishableKey={safePublishableKey}
      merchantIdentifier={Platform.OS === 'ios' ? merchantIdentifier : undefined}
    >
      {children}
    </StripeProvider>
  );
}
