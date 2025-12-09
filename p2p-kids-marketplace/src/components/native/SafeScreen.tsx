import React from 'react';
import { View, ViewProps } from 'react-native';
import { sanitizePropsObject } from '@/utils/propSanitizer';

// Try to import RNSScreen if available; otherwise fallback to View.
let RNSScreen: any = null;
try {
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  RNSScreen = require('react-native-screens').Screen;
} catch {
  RNSScreen = null;
}

export type SafeScreenProps = ViewProps & Record<string, any>;

export default function SafeScreen(props: SafeScreenProps) {
  const sanitized = sanitizePropsObject(props as any);

  if (RNSScreen) {
    const ScreenComp = RNSScreen;
    return <ScreenComp {...sanitized} />;
  }

  // Fallback for environments without react-native-screens available
  return <View {...(sanitized as ViewProps)} />;
}
