// File: p2p-kids-marketplace/src/components/__tests__/NotificationSetup.test.tsx
// FIX-Task-65 items 2 / 3 / 4 / 8 — the design-system CTA + locators, the
// cause-specific push-registration copy, the permission-denied "Open Settings"
// affordance, and the deep-link-armed optional ("Maybe Later") variant.
//
// Before this task the screen had NO unit tests at all, a bare RN <Button> CTA and a
// single generic error string for four unrelated failure causes.

import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NotificationSetup, PUSH_FAILURE_COPY, getPushFailureCopy } from '../NotificationSetup';
import type { PushRegistrationFailureReason } from '@/services/notifications';

const mockRegister = jest.fn();
const mockSavePushToken = jest.fn();

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
  },
}));

jest.mock('@/services/notifications', () => ({
  registerForPushNotifications: () => mockRegister(),
  savePushToken: (userId: string, token: string) => mockSavePushToken(userId, token),
  createNotificationObserver: () => jest.fn(),
  sendLocalNotification: jest.fn(async () => undefined),
}));

const openSettingsMock = Linking.openSettings as unknown as jest.Mock;

const renderScreen = (props: Record<string, unknown> = {}) =>
  render(<NotificationSetup {...props} />);

const failWith = (reason: PushRegistrationFailureReason) =>
  mockRegister.mockResolvedValue({ ok: false, reason });

const pressEnable = async (screen: ReturnType<typeof renderScreen>) => {
  // The screen loads the auth user in a mount effect; pressing before that promise
  // settles would short-circuit into "User not authenticated".
  await act(async () => {});
  fireEvent.press(screen.getByTestId('notification-enable-button'));
  await waitFor(() => expect(screen.getByTestId('notification-error-message')).toBeTruthy());
};

describe('NotificationSetup (FIX-Task-65)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    failWith('not_device');
    mockSavePushToken.mockResolvedValue({ success: true });
    openSettingsMock.mockResolvedValue(undefined);
  });

  // ── item 2 + 4: the primary CTA is a design-system pill with a real locator ──────
  describe('primary CTA (items 2 + 4)', () => {
    it('exposes a deterministic testID and an AX button role', () => {
      const screen = renderScreen();
      const cta = screen.getByTestId('notification-enable-button');
      expect(cta.props.accessibilityRole).toBe('button');
      expect(cta.props.accessibilityLabel).toBe('Enable Notifications');
    });

    it('meets the 44pt minimum touch target as a filled pill', () => {
      const screen = renderScreen();
      const flat = StyleSheet.flatten(screen.getByTestId('notification-enable-button').props.style);
      // DS Button `large` = 52pt tall, pill radius, brand-green fill with white text.
      expect(flat.height).toBeGreaterThanOrEqual(44);
      expect(flat.borderRadius).toBe(flat.height / 2);
      expect(flat.backgroundColor).toBe('#5DBB8E');
    });

    it('no longer uses the bare React Native Button (title/color API)', () => {
      const screen = renderScreen();
      // A DS Button renders its label as a <Text> child; RN's <Button> has no children.
      expect(screen.getByText('Enable Notifications')).toBeTruthy();
      expect(screen.getByTestId('notification-enable-button').props.title).toBeUndefined();
    });
  });

  // ── item 3: one copy per cause ─────────────────────────────────────────────────
  describe('cause-specific push-registration copy (item 3)', () => {
    const CAUSES: [PushRegistrationFailureReason, string][] = [
      ['not_device', PUSH_FAILURE_COPY.not_device],
      ['expo_go', PUSH_FAILURE_COPY.expo_go],
      ['permission_denied', PUSH_FAILURE_COPY.permission_denied],
      ['token_error', PUSH_FAILURE_COPY.token_error],
    ];

    it.each(CAUSES)('renders the %s copy', async (reason, copy) => {
      failWith(reason);
      const screen = renderScreen();
      await pressEnable(screen);

      expect(screen.getByTestId('notification-error-message').props.children).toContain(copy);
      expect(screen.getByText(copy, { exact: false })).toBeTruthy();
    });

    it('never reuses the permissions hint for the simulator cause', async () => {
      failWith('not_device');
      const screen = renderScreen();
      await pressEnable(screen);

      expect(screen.queryByText('Make sure you granted permissions', { exact: false })).toBeNull();
      expect(screen.getByText('simulator/emulator', { exact: false })).toBeTruthy();
    });

    it('keeps the Android + web wording intact', () => {
      expect(getPushFailureCopy('token_error', 'android')).toContain('google-services.json');
      expect(getPushFailureCopy('token_error', 'ios')).toBe(PUSH_FAILURE_COPY.token_error);
      expect(getPushFailureCopy('not_device', 'web')).toBe(
        'Push notifications are not available on web'
      );
    });

    it('pins the approved MSG Round 1 §4.2 wording', () => {
      expect(PUSH_FAILURE_COPY).toEqual({
        not_device: 'Push notifications need a physical device. This is a simulator/emulator.',
        expo_go: "Push notifications aren't available in Expo Go. Use a development build.",
        permission_denied:
          'Notifications are turned off for Pass It Up. Enable them in Settings › Notifications.',
        token_error: 'Could not obtain push notification token. Make sure you granted permissions.',
      });
    });
  });

  // ── item 8: Open Settings only when the OS permission is the cause ─────────────
  describe('Open Settings affordance (item 8)', () => {
    it('shows it for permission_denied and opens the OS settings page', async () => {
      failWith('permission_denied');
      const screen = renderScreen();
      await pressEnable(screen);

      const openSettings = screen.getByTestId('notification-open-settings-button');
      expect(openSettings.props.accessibilityLabel).toBe('Open Settings');
      fireEvent.press(openSettings);
      expect(openSettingsMock).toHaveBeenCalledTimes(1);
    });

    it.each(['not_device', 'expo_go', 'token_error'] as const)(
      'hides it for %s',
      async (reason) => {
        failWith(reason);
        const screen = renderScreen();
        await pressEnable(screen);

        expect(screen.queryByTestId('notification-open-settings-button')).toBeNull();
      }
    );
  });

  // ── item 4 (extra): the optional variant was dead UI until now ─────────────────
  describe('optional variant (extra)', () => {
    it('hides "Maybe Later" by default — the route passes no props', () => {
      const screen = renderScreen();
      expect(screen.queryByTestId('notification-maybe-later-button')).toBeNull();
    });

    it('renders "Maybe Later" when the deep link arms isOptional, and completes via goBack', () => {
      const goBack = jest.fn();
      const screen = renderScreen({
        route: { params: { isOptional: '1' } },
        navigation: { goBack },
      });

      fireEvent.press(screen.getByTestId('notification-maybe-later-button'));
      expect(goBack).toHaveBeenCalledTimes(1);
    });

    it('still honours the legacy isOptional prop and onComplete callback', () => {
      const onComplete = jest.fn();
      const screen = renderScreen({ isOptional: true, onComplete });

      fireEvent.press(screen.getByTestId('notification-maybe-later-button'));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('keeps the error banner locatable in the optional variant', async () => {
      failWith('not_device');
      const screen = renderScreen({ isOptional: true });
      await pressEnable(screen);

      expect(screen.getByTestId('notification-error-section')).toBeTruthy();
      expect(
        screen.queryByText('Please try again or contact support', { exact: false })
      ).toBeNull();
    });
  });

  // ── success path keeps a locatable CTA ────────────────────────────────────────
  describe('success state (item 4)', () => {
    it('renders the Continue CTA and completes through navigation.goBack', async () => {
      mockRegister.mockResolvedValue({ ok: true, token: 'ExponentPushToken[test]' });
      // No `onComplete` prop → exercises the completion fallback this task added
      // (and avoids the component's 1.5s auto-complete timer leaking out of the test).
      const goBack = jest.fn();
      const screen = renderScreen({ navigation: { goBack } });

      await act(async () => {});
      fireEvent.press(screen.getByTestId('notification-enable-button'));
      await waitFor(() => expect(screen.getByTestId('notification-continue-button')).toBeTruthy());

      fireEvent.press(screen.getByTestId('notification-continue-button'));
      expect(goBack).toHaveBeenCalledTimes(1);
      expect(mockSavePushToken).toHaveBeenCalledWith('user-1', 'ExponentPushToken[test]');
    });
  });
});
