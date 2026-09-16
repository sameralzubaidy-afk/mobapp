/**
 * File: p2p-kids-marketplace/src/utils/__tests__/subscriptionWeb.test.ts
 * FIX-Task-41 item 4: emulator-aware web base host.
 *
 * `platformOS` is injected into both helpers so the Android rewrite is covered
 * without mocking react-native (the RN jest preset fixes Platform.OS).
 */
import { getJoinKidsClubWebUrl, toEmulatorReachableBase } from '../subscriptionWeb';

describe('toEmulatorReachableBase', () => {
  test('rewrites the host loopback to 10.0.2.2 on Android', () => {
    expect(toEmulatorReachableBase('http://localhost:3002', 'android')).toBe(
      'http://10.0.2.2:3002'
    );
    expect(toEmulatorReachableBase('http://127.0.0.1:3002', 'android')).toBe('http://10.0.2.2:3002');
  });

  test('leaves a real base untouched on Android', () => {
    expect(toEmulatorReachableBase('https://passitup.com', 'android')).toBe('https://passitup.com');
  });

  test('is a no-op on iOS (the simulator shares the host loopback)', () => {
    expect(toEmulatorReachableBase('http://localhost:3002', 'ios')).toBe('http://localhost:3002');
  });

  test('never rewrites a localhost-looking string that is not the host', () => {
    expect(toEmulatorReachableBase('https://passitup.com/x//localhost', 'android')).toBe(
      'https://passitup.com/x//localhost'
    );
  });
});

describe('getJoinKidsClubWebUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL;
    } else {
      process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL = originalEnv;
    }
  });

  test('uses the configured base and appends /join', () => {
    process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL = 'http://localhost:3002';
    expect(getJoinKidsClubWebUrl(null, 'ios')).toBe('http://localhost:3002/join');
  });

  test('resolves the emulator host on Android (item 4 regression)', () => {
    process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL = 'http://localhost:3002';
    expect(getJoinKidsClubWebUrl(undefined, 'android')).toBe('http://10.0.2.2:3002/join');
  });

  test('appends a lower-cased email hint when valid', () => {
    process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL = 'https://passitup.com/';
    expect(getJoinKidsClubWebUrl(' Parent@Example.com ', 'ios')).toBe(
      'https://passitup.com/join?email=parent%40example.com'
    );
  });

  test('ignores an invalid email hint', () => {
    process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL = 'https://passitup.com';
    expect(getJoinKidsClubWebUrl('not-an-email', 'ios')).toBe('https://passitup.com/join');
  });

  test('falls back to the production base when the env var is unset', () => {
    delete process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL;
    expect(getJoinKidsClubWebUrl(null, 'ios')).toBe('https://passitup.com/join');
  });
});
