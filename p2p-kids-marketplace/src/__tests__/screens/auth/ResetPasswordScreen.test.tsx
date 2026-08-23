/**
 * FILE: ResetPasswordScreen regression test
 *
 * Regression (QA Group Q+S, 2026-08-23 — Phase 16 finding #1, reconfirmed live):
 * once `linkError` is set (e.g. from an expired-link fragment on mount), a
 * subsequent VALID reset deep link carrying a real `access_token` did NOT clear
 * it — the Link Error card persisted and the submit button stayed hidden, so a
 * genuinely valid reset link delivered after a prior error was unusable without
 * an app relaunch.
 *
 * Sequence under test (must not silently regress a third time):
 *   1. Mount with an expired-link fragment   -> linkError set (error card shown, submit hidden)
 *   2. A warm deep link with a real access_token arrives on the SAME instance
 *   3. linkError cleared, session set, submit button visible again
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ResetPasswordScreen from '../../../screens/auth/ResetPasswordScreen';
import { supabase } from '@/services/supabase/client';
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    reset: jest.fn(),
    getParent: () => ({ navigate: jest.fn() }),
  }),
  useRoute: () => ({ params: {} }),
}));

// Mock the supabase client the screen imports.
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(async () => ({ error: null })),
      getSession: jest.fn(async () => ({
        data: { session: { access_token: 'x', refresh_token: 'y' } },
        error: null,
      })),
      updateUser: jest.fn(async () => ({ error: null })),
    },
  },
}));

const EXPIRED_URL =
  'p2pkidsmarketplace://reset#error=otp_expired&error_description=The+link+has+expired';
const VALID_URL =
  'p2pkidsmarketplace://reset#access_token=VALID_TOKEN&refresh_token=VALID_REFRESH&type=recovery';

describe('ResetPasswordScreen — linkError recovery on valid token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The RN jest mock exposes jest.fn() for Linking; wire getInitialURL to a
    // deterministic value (BP-54: static import, no RN module mocking). The
    // screen registers its url listener on addEventListener, which we read
    // directly from the mock calls to deliver the warm deep link.
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({ error: null });
  });

  it('clears linkError and reveals the submit button when a valid token arrives after an expired-link error', async () => {
    // Step 1 — cold-start deep link carries an expired-link fragment.
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(EXPIRED_URL);

    const { getByTestId, queryByTestId } = render(<ResetPasswordScreen />);

    // Error state: Link Error card visible, submit button hidden.
    await waitFor(() => {
      expect(getByTestId('reset-request-new-email-button')).toBeTruthy();
      expect(queryByTestId('reset-submit-button')).toBeNull();
    });

    // Step 2 — a warm deep link with a real access_token arrives on the SAME
    // screen instance (no app relaunch). Grab the url listener registered on mount.
    const urlListener = (Linking.addEventListener as jest.Mock).mock.calls[0][1];
    expect(urlListener).toBeDefined();

    await act(async () => {
      urlListener({ url: VALID_URL });
    });

    // Step 3 — linkError cleared: error card gone, submit button visible, and
    // setSession was called with the tokenized link payload.
    await waitFor(() => {
      expect(queryByTestId('reset-request-new-email-button')).toBeNull();
      expect(getByTestId('reset-submit-button')).toBeTruthy();
    });

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'VALID_TOKEN',
      refresh_token: 'VALID_REFRESH',
    });
  });
});
