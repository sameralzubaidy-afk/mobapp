// Jest setup - early mocks

// AsyncStorage is mocked through jest's moduleNameMapper in jest.config.js

// Mock native expo modules that expect a device environment
(globalThis as any).jest?.mock && jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));

// Provide dummy Supabase env vars for unit tests so creating the client doesn't throw
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'anon-key';

// Mock the testSupabase util so we don't make network calls in unit tests
jest.mock('./src/utils/testSupabase', () => ({
  testSupabaseConnection: () => Promise.resolve(true),
}));

// Mock alert for tests
global.alert = global.alert || jest.fn();
