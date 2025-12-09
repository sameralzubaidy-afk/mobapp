import React from 'react';
import { View, ViewProps } from 'react-native';
import { sanitizePropsObject } from '@/utils/propSanitizer';

// Try to import RNSScreen if available; otherwise fallback to View.
let RNSScreen: any = null;
try {
  // eslint-disable-next-line global-require
  RNSScreen = require('react-native-screens').Screen;
} catch (e) {
  RNSScreen = null;
}

export type SafeScreenProps = ViewProps & Record<string, any>;

export default function SafeScreen(props: SafeScreenProps) {
  let sanitized: any = props;
  try {
    if (typeof sanitizePropsObject === 'function') {
      sanitized = sanitizePropsObject(props as any) || props;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('SafeScreen sanitizer failed, falling back to raw props', err);
    sanitized = props;
  }

  if (RNSScreen) {
    const ScreenComp = RNSScreen;
    return <ScreenComp {...sanitized} />;
  }

  // Fallback for environments without react-native-screens available
  return <View {...(sanitized as ViewProps)} />;
}
