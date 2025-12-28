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
  children: React.ReactNode;
  publishableKey: string;
  merchantIdentifier?: string;
}) {
  // Validate publishable key
  if (!publishableKey || !publishableKey.startsWith('pk_')) {
    if (__DEV__) {
      console.error('[Stripe] Invalid or missing publishableKey:', publishableKey?.slice(0, 10));
    }
    return <>{children}</>;
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

  try {
    return (
      <StripeProvider
        publishableKey={publishableKey}
        merchantIdentifier={merchantIdentifier}
      >
        {children}
      </StripeProvider>
    );
  } catch (error) {
    if (__DEV__) {
      console.error('[Stripe] Failed to initialize StripeProvider:', error);
    }
    // Fallback: render children without Stripe context
    return <>{children}</>;
  }
}
