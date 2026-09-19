// File: p2p-kids-marketplace/src/services/__tests__/notifications.test.ts
// FIX-Task-65 items 3 + 6 — `registerForPushNotifications` must report a discriminated
// failure reason (instead of a bare `null`), the QA override must short-circuit safely,
// and the Android channel must use the brand green.
//
// Nothing tested this service before this task.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { colors } from '@/theme/colors';

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetExpoPushToken = jest.fn();
const mockSetNotificationChannel = jest.fn();
const mockOverride = jest.fn(async () => 'none');

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushToken(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannel(...args),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

// `isExpoGo` is captured at MODULE LOAD time in notifications.ts, so the Expo-Go branch
// is driven by flipping this holder and re-requiring the module (see the test below)
// rather than by mutating a live import.
const constantsHolder = { appOwnership: null as string | null };

jest.mock('expo-constants', () => ({
  get appOwnership() {
    return constantsHolder.appOwnership;
  },
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}));

jest.mock('@/navigation/AppNavigator', () => ({ navigationRef: { current: null } }));

jest.mock('../deepLink', () => ({ parseNotificationDeepLink: jest.fn() }));

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

jest.mock('@/services/devTestingService', () => ({
  getPushRegistrationReasonOverride: () => mockOverride(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const loadService = () => require('../notifications').registerForPushNotifications as () => Promise<
  { ok: true; token: string } | { ok: false; reason: string }
>;

let registerForPushNotifications = loadService();

describe('registerForPushNotifications — failure reasons (FIX-Task-65 item 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverride.mockResolvedValue('none');
    (Device as { isDevice: boolean }).isDevice = true;
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    mockSetNotificationChannel.mockResolvedValue(undefined);
    registerForPushNotifications = loadService();
  });

  it('returns { ok: true, token } on success', async () => {
    await expect(registerForPushNotifications()).resolves.toEqual({
      ok: true,
      token: 'ExponentPushToken[test]',
    });
  });

  it('returns not_device on a simulator (Device.isDevice === false)', async () => {
    (Device as { isDevice: boolean }).isDevice = false;

    await expect(registerForPushNotifications()).resolves.toEqual({
      ok: false,
      reason: 'not_device',
    });
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });

  it('returns permission_denied when the OS permission is not granted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });

    await expect(registerForPushNotifications()).resolves.toEqual({
      ok: false,
      reason: 'permission_denied',
    });
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });

  it('returns token_error when the Expo token request throws', async () => {
    mockGetExpoPushToken.mockRejectedValue(new Error('Default FirebaseApp is not initialized'));

    await expect(registerForPushNotifications()).resolves.toEqual({
      ok: false,
      reason: 'token_error',
    });
  });

  it('reports expo_go when the app runs inside Expo Go', async () => {
    constantsHolder.appOwnership = 'expo';
    jest.resetModules();
    try {
      const fresh = loadService();
      await expect(fresh()).resolves.toEqual({ ok: false, reason: 'expo_go' });
    } finally {
      constantsHolder.appOwnership = null;
      jest.resetModules();
      registerForPushNotifications = loadService();
    }
  });
});

describe('QA push-registration override (FIX-Task-65 item 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Device as { isDevice: boolean }).isDevice = true;
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    registerForPushNotifications = loadService();
  });

  it.each(['not_device', 'expo_go', 'permission_denied', 'token_error'] as const)(
    'forces the %s reason without touching any OS API',
    async (reason) => {
      mockOverride.mockResolvedValue(reason);

      await expect(registerForPushNotifications()).resolves.toEqual({ ok: false, reason });
      expect(mockGetPermissions).not.toHaveBeenCalled();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
      expect(mockGetExpoPushToken).not.toHaveBeenCalled();
      expect(mockSetNotificationChannel).not.toHaveBeenCalled();
    }
  );

  it('takes no action when the toggle is unset (fail-closed)', async () => {
    mockOverride.mockResolvedValue('none');

    await expect(registerForPushNotifications()).resolves.toEqual({
      ok: true,
      token: 'ExponentPushToken[test]',
    });
  });
});

describe('Android notification channel (FIX-Task-65 item 6)', () => {
  // `Platform.OS` is a plain data property in this RN/Jest environment (it is not a
  // getter), so it is swapped with defineProperty and restored afterwards.
  let restorePlatform: (() => void) | null = null;

  const setPlatform = (os: string) => {
    const original = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
    restorePlatform = () => {
      if (original) {
        Object.defineProperty(Platform, 'OS', original);
      }
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOverride.mockResolvedValue('none');
    (Device as { isDevice: boolean }).isDevice = true;
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    mockSetNotificationChannel.mockResolvedValue(undefined);
    registerForPushNotifications = loadService();
  });

  afterEach(() => {
    restorePlatform?.();
    restorePlatform = null;
  });

  it('uses the brand green (not the Material #4CAF50 literal) as lightColor', async () => {
    setPlatform('android');

    await registerForPushNotifications();

    expect(mockSetNotificationChannel).toHaveBeenCalledTimes(1);
    expect(mockSetNotificationChannel).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ lightColor: colors.primary[500] })
    );
    expect(colors.primary[500]).toBe('#5DBB8E');
  });

  it('does not create a channel on iOS', async () => {
    setPlatform('ios');

    await registerForPushNotifications();

    expect(mockSetNotificationChannel).not.toHaveBeenCalled();
  });
});
