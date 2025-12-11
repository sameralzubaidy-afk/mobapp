import '@testing-library/jest-native/extend-expect';

// Make TypeScript happy in this test setup file (jest is a runtime global)
declare const jest: any;

// Silence native warnings that commonly appear in test runs
jest.useFakeTimers && jest.useFakeTimers();

// Mock native AsyncStorage for tests
jest.mock('@react-native-async-storage/async-storage', () =>
	require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock native expo modules that expect a device environment
(globalThis as any).jest?.mock && jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));

// Provide dummy Supabase env vars for unit tests so creating the client doesn't throw
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'anon-key';

// Mock the testSupabase util so we don't make network calls in unit tests
jest.mock('./src/utils/testSupabase', () => ({
	testSupabaseConnection: () => Promise.resolve(true),
}));
