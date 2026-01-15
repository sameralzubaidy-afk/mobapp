/**
 * Jest config for Expo / React Native
 */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // By default Jest ignores transforming node_modules. For Expo/React Native we must allow
  // transforming several packages that ship modern JS (ESM/TS) syntax.
  transformIgnorePatterns: [
    // allow transforming common RN / Expo packages which publish modern JS
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|expo|expo-.*|expo-modules-.*|@expo/vector-icons|@unimodules|native-base|react-native-.*|@sentry|@stripe|react-native-url-polyfill))',
  ],
};
