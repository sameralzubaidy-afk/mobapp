import '@testing-library/jest-native/extend-expect';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { cleanup } from '@testing-library/react-native';

// Load environment variables for testing.
// Prefer staging env when running Supabase E2E.
dotenv.config({ path: path.join(__dirname, '.env.staging'), quiet: true });
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

// Make TypeScript happy in this test setup file (jest is a runtime global)
declare const jest: any;

// Silence native warnings that commonly appear in test runs
// Note: Do NOT enable fake timers globally.
// Many @testing-library/react-native helpers (e.g. waitFor) rely on real timers.
// Individual tests can opt-in with `jest.useFakeTimers()` when needed.

// Keep unit/E2E logs readable by default. Set JEST_VERBOSE_LOGS=true to opt in.
const shouldSilenceConsole = process.env.JEST_VERBOSE_LOGS !== 'true';
if (shouldSilenceConsole) {
  const noOp = () => {};
  (console as any).log = jest.fn(noOp);
  (console as any).info = jest.fn(noOp);
  (console as any).warn = jest.fn(noOp);
  (console as any).error = jest.fn(noOp);
  (console as any).debug = jest.fn(noOp);
}

afterEach(() => {
  // Ensure mounted trees/subscriptions are disposed between tests.
  cleanup();
});

// Mock native AsyncStorage for tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// TFV2-014: Mock react-native-safe-area-context so PersistentTabBar renders in tests
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    useSafeAreaInsets:    () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaProvider:     ({ children }: any) => children,
    SafeAreaView:         ({ children, style }: any) =>
      React.createElement('View', { style }, children),
    initialWindowMetrics: {
      frame:  { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    },
  };
});

// Mock native expo modules that expect a device environment
(globalThis as any).jest?.mock && jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));

// Provide lightweight mocks for native-base components used in unit tests so
// tests do not depend on the full NativeBase runtime or theme system.
if ((globalThis as any).jest?.mock) {
  jest.mock('native-base', () => {
    const React = require('react');

    const NativeBaseProvider = ({ children }: any) =>
      React.createElement(React.Fragment, null, children);
    const Button = (props: any) => React.createElement('button', props as any, props.children);

    return {
      __esModule: true,
      NativeBaseProvider,
      Button,
    };
  });
}

if ((globalThis as any).jest?.mock) {
  jest.mock('@stripe/stripe-react-native', () => {
    const { fn } = require('jest-mock');
    const retrieveSetupIntent = fn(async () => ({
      setupIntent: { paymentMethodId: 'pm_test_default' },
      error: null,
    }));
    return {
      __esModule: true,
      useStripe: fn(() => ({
        retrieveSetupIntent,
      })),
      initPaymentSheet: fn(async () => ({ error: null })),
      presentPaymentSheet: fn(async () => ({ error: null })),
      PaymentSheetError: {},
    };
  });
}

// Provide dummy Supabase env vars for unit tests so creating the client doesn't throw
// When RUN_SUPABASE_E2E=true, these will be loaded from .env file
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'anon-key';

// By default, prevent tests from making real Supabase/network calls.
// Opt-in to real Supabase E2E by setting `RUN_SUPABASE_E2E=true`.
const runSupabaseE2E = process.env.RUN_SUPABASE_E2E === 'true';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Network-backed E2E tests can intermittently fail with transient socket resets.
// Retry only short-lived transport errors to reduce flakiness without masking logic failures.
if (runSupabaseE2E && typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await originalFetch(...args);

        if ([502, 503, 504].includes(response.status) && attempt < 3) {
          await delay(attempt * 200);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isTransient = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(message);

        if (!isTransient || attempt === 3) {
          throw error;
        }

        await delay(attempt * 200);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Fetch failed after retries');
  };
}

if (!runSupabaseE2E && (globalThis as any).jest?.mock) {
  jest.mock(require.resolve('./src/config/supabase'), () => require('./src/__mocks__/supabase'));
  jest.mock('@/config/supabase', () => require('./src/__mocks__/supabase'));

  beforeEach(() => {
    const { __resetSupabaseMocks } = require('./src/__mocks__/supabase');
    if (typeof __resetSupabaseMocks === 'function') {
      __resetSupabaseMocks();
    }
  });

  jest.mock('@supabase/supabase-js', () => {
    const { fn } = require('jest-mock');

    const makeQueryBuilder = () => {
      const builder: any = {};
      // Make the query builder awaitable (Supabase queries are promise-like).
      builder.then = (onFulfilled: any, onRejected: any) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);

      builder.select = fn(() => builder);
      builder.insert = fn(() => builder);
      builder.update = fn(() => builder);
      builder.upsert = fn(() => builder);
      builder.delete = fn(() => builder);
      builder.eq = fn(() => builder);
      builder.neq = fn(() => builder);
      builder.or = fn(() => builder);
      builder.in = fn(() => builder);
      builder.ilike = fn(() => builder);
      builder.gte = fn(() => builder);
      builder.lte = fn(() => builder);
      builder.is = fn(() => builder);
      builder.not = fn(() => builder);
      builder.order = fn(() => builder);
      builder.limit = fn(async () => ({ data: [], error: null }));
      builder.single = fn(async () => ({ data: null, error: null }));
      builder.maybeSingle = fn(async () => ({ data: null, error: null }));
      return builder;
    };

    const makeChannel = () => {
      const channel: any = {};
      channel.on = fn(() => channel);
      channel.subscribe = fn(() => ({ unsubscribe: fn() }));
      channel.unsubscribe = fn();
      channel.track = fn(async () => ({ error: null }));
      channel.send = fn(async () => ({ error: null }));
      return channel;
    };

    const mockClient = {
      auth: {
        getUser: fn(async () => ({ data: { user: null }, error: null })),
        getSession: fn(async () => ({ data: { session: null }, error: null })),
        signUp: fn(async () => ({ data: { user: null, session: null }, error: null })),
        signInWithPassword: fn(async () => ({ data: { user: null, session: null }, error: null })),
        signOut: fn(async () => ({ error: null })),
      },
      from: fn(() => makeQueryBuilder()),
      rpc: fn(async () => ({ data: null, error: null })),
      functions: {
        invoke: fn(async () => ({ data: { success: true }, error: null })),
      },
      channel: fn(() => makeChannel()),
      removeChannel: fn(async () => ({ error: null })),
    };

    const createClient = fn(() => mockClient);
    class SupabaseClient {}

    return {
      __esModule: true,
      createClient,
      SupabaseClient,
    };
  });
}

// Mock the testSupabase util so we don't make network calls in unit tests
if ((globalThis as any).jest?.mock) {
  // jest.mock factories must not reference out-of-scope variables (Jest's runtime rule).
  // Return a simple async function instead of `jest.fn(...)` to avoid the "Invalid variable access: jest" error.
  jest.mock('./src/utils/testSupabase', () => ({
    testSupabaseConnection: async () => true,
  }));
}
