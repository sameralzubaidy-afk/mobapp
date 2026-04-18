/**
 * Jest config for Expo / React Native
 */
const runDetoxE2E = process.env.RUN_DETOX_E2E === 'true';

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  // E2E/integration suites hit real Supabase and can exceed Jest's 5s default.
  // Use a safer global baseline; specific suites can still override when needed.
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    ...(runDetoxE2E ? {} : { '^detox$': '<rootDir>/src/__mocks__/detox.ts' }),
  },
  // By default Jest ignores transforming node_modules. For Expo/React Native we must allow
  // transforming several packages that ship modern JS (ESM/TS) syntax.
  transformIgnorePatterns: [
    // allow transforming common RN / Expo packages which publish modern JS
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|expo|expo-.*|expo-modules-.*|@expo/vector-icons|@unimodules|native-base|react-native-.*|@sentry|@stripe|react-native-url-polyfill))',
  ],
};
