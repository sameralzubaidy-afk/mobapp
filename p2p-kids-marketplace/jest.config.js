/**
 * Jest config for Expo / React Native
 */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup-mocks.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-env.ts'],
  // By default Jest ignores transforming node_modules. For Expo/React Native we must allow
  // transforming several packages that ship modern JS (ESM/TS) syntax.
  transformIgnorePatterns: [
    // allow transforming common RN / Expo packages which publish modern JS
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|expo|expo-.*|expo-modules-.*|@unimodules|native-base|react-native-.*|@sentry|@stripe|react-native-url-polyfill))',
  ],
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$": "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock",
  },
};
