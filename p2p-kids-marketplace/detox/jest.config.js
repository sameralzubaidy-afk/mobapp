/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testRunner: 'jest-circus/runner',
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testTimeout: 600000,
  testMatch: ['<rootDir>/tests/**/*.e2e.ts'],
  maxWorkers: 1,
  transform: {
    '\\.tsx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|@expo|@sentry|react-native-.*|@react-native-.*|native-base|@stripe|react-native-gesture-handler)/)',
  ],
  verbose: true,
};
