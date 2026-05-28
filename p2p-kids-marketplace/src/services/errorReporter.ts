// File: p2p-kids-marketplace/src/services/errorReporter.ts
// PROD-P004: Crash & error reporting (Sentry) abstraction.
//
// Design rules:
//  - Import is safe regardless of whether Sentry is initialized.
//  - All calls are no-ops if EXPO_PUBLIC_SENTRY_DSN is not configured,
//    so unit tests, Expo Go dev, and CI all work without a DSN.
//  - Native side (iOS/Android) requires `expo prebuild` + pod install
//    after adding `@sentry/react-native` — see PROD-P004 manual TC.
//  - Never let the reporter throw; wrap everything in try/catch so a
//    monitoring failure cannot itself crash the app.

import Constants from 'expo-constants';

// Lazy: only require Sentry when DSN is present so dev/test/CI without
// the native module still load cleanly.
type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (e: unknown, hint?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
  setUser: (user: { id?: string } | null) => void;
  addBreadcrumb: (b: Record<string, unknown>) => void;
};

let _sentry: SentryLike | null = null;
let _initialized = false;

function getDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN;
}

function getEnv(): string {
  return process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';
}

function loadSentry(): SentryLike | null {
  if (_sentry) return _sentry;
  try {
    // Use require so bundlers don't hard-fail if module is missing in
    // environments where it isn't linked (e.g. some test setups).
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('@sentry/react-native');
    _sentry = mod as SentryLike;
    return _sentry;
  } catch {
    return null;
  }
}

/**
 * Initialize the crash reporter. Safe to call once at app startup.
 * No-op when EXPO_PUBLIC_SENTRY_DSN is missing.
 */
export function initErrorReporter(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = getDsn();
  if (!dsn) {
    // eslint-disable-next-line no-console
    console.log('[errorReporter] EXPO_PUBLIC_SENTRY_DSN missing — reporter disabled');
    return;
  }

  const sentry = loadSentry();
  if (!sentry) {
    console.warn('[errorReporter] @sentry/react-native not available — reporter disabled');
    return;
  }

  try {
    sentry.init({
      dsn,
      environment: getEnv(),
      // Conservative sampling for MVP; tune later.
      tracesSampleRate: 0.1,
      enableAutoSessionTracking: true,
      // App version from expo-constants for release tagging.
      release: Constants.expoConfig?.version,
      dist: String(Constants.expoConfig?.runtimeVersion || ''),
      // Don't send default PII; we'll attach user.id explicitly via setUser.
      sendDefaultPii: false,
    });
  } catch (e) {
    console.warn('[errorReporter] init failed', e);
  }
}

/** Report a caught error. Always safe. */
export function captureException(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  try {
    const sentry = _sentry;
    if (sentry) {
      sentry.captureException(error, context);
      return;
    }
    // Fallback: at least log so dev can see it.
    // eslint-disable-next-line no-console
    console.error('[errorReporter:fallback]', error, context);
  } catch (e) {
    console.warn('[errorReporter] captureException failed', e);
  }
}

/** Report a message-level event (non-error). */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  try {
    const sentry = _sentry;
    if (sentry) {
      sentry.captureMessage(message, level);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[errorReporter:fallback:${level}]`, message);
  } catch (e) {
    console.warn('[errorReporter] captureMessage failed', e);
  }
}

/** Attach the current user (hashed/internal id only). Pass null to clear. */
export function setUser(user: { id?: string } | null): void {
  try {
    _sentry?.setUser(user);
  } catch (e) {
    console.warn('[errorReporter] setUser failed', e);
  }
}

/** Add a breadcrumb for context on the next captured event. */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  try {
    _sentry?.addBreadcrumb(breadcrumb);
  } catch (e) {
    console.warn('[errorReporter] addBreadcrumb failed', e);
  }
}

/** Test-only: reset internal state. Do not call from app code. */
export function __resetForTests(): void {
  _sentry = null;
  _initialized = false;
}

/** Test-only: returns whether the reporter has an active Sentry backend. */
export function __isActiveForTests(): boolean {
  return _sentry !== null;
}
