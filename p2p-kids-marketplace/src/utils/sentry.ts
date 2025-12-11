// File: src/utils/sentry.ts
// Initialize Sentry for Expo React Native app
import * as Sentry from '@sentry/react-native';

// Do not crash the app if env var is missing
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const ENV = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

// Only initialize if a DSN is provided
if (SENTRY_DSN) {
  const RELEASE = process.env.EXPO_PUBLIC_RELEASE || process.env.RELEASE || '';
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    release: RELEASE || undefined,
    tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_RATE || 0.05),
    enableNative: true,
  });
  // Optional: tag integration version
  Sentry.setTag('app', 'p2p-kids-marketplace');
  if (process.env.EXPO_PUBLIC_RELEASE) Sentry.setTag('release', process.env.EXPO_PUBLIC_RELEASE);
} else {
  // eslint-disable-next-line no-console
  console.warn('Sentry DSN not configured (EXPO_PUBLIC_SENTRY_DSN). Errors will not be reported to Sentry.');
}

export default Sentry;
