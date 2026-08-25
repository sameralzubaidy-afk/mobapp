// File: src/screens/profile/__tests__/LinkedAccountsScreen.test.tsx
// Screen-level tests for LinkedAccountsScreen (ACC-TC-C04 — "Email mismatch on
// link blocked").
//
// The C04 path is: dev/test builds read the session-local `qa_link_email_mismatch`
// toggle (getSimulatedLinkEmailMismatch) AFTER the simulated OAuth initiation;
// when armed for the provider (or 'all'), performLinking throws EmailMismatchError
// → the screen's existing catch shows the "Email Mismatch" alert and NO link is
// created. Fail-closed: unarmed/unknown → the simulated link-success "OAuth Flow"
// alert shows as before.

import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import LinkedAccountsScreen from '../LinkedAccountsScreen';
import { getLinkedProviders, countLoginMethods } from '@/services/accountService';
import { initiateSocialLogin } from '@/services/oauthService';
import { getSimulatedLinkEmailMismatch } from '@/services/devTestingService';

// Stable user reference (NOT a fresh object literal per render) — the screen
// keys loadLinkedAccounts off `user`, so a new object identity every render
// would re-trigger the load effect in an infinite loading loop.
const mockUser = { user_id: 'test-user-id', email: 'test@example.com' };
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/services/accountService', () => ({
  getLinkedProviders: jest.fn(),
  unlinkSocialAccount: jest.fn(),
  countLoginMethods: jest.fn(),
}));

jest.mock('@/services/oauthService', () => ({
  initiateSocialLogin: jest.fn(),
}));

jest.mock('@/services/devTestingService', () => ({
  getSimulatedLinkEmailMismatch: jest.fn(),
}));

jest.mock('@/services/errorReporter', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/components/auth/PasswordReauthModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockPasswordReauthModal() {
    return <View />;
  };
});

const mockGetLinkedProviders = getLinkedProviders as jest.Mock;
const mockCountLoginMethods = countLoginMethods as jest.Mock;
const mockInitiateSocialLogin = initiateSocialLogin as jest.Mock;
const mockGetSimulatedLinkEmailMismatch = getSimulatedLinkEmailMismatch as jest.Mock;

describe('LinkedAccountsScreen — ACC-TC-C04 email mismatch on link blocked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Password-less user (0 methods, 0 providers → hasPassword false) → Link
    // goes straight to performLinking (no password re-auth modal gate).
    mockGetLinkedProviders.mockResolvedValue([]);
    mockCountLoginMethods.mockResolvedValue(0);
    mockInitiateSocialLogin.mockResolvedValue({ url: 'https://example.com/oauth' });
    mockGetSimulatedLinkEmailMismatch.mockResolvedValue(null);
  });

  it('renders all three provider rows with Link buttons (no password set)', async () => {
    const { getByText, getByTestId } = render(
      <LinkedAccountsScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('Google')).toBeTruthy();
      expect(getByText('Facebook')).toBeTruthy();
      expect(getByText('Apple')).toBeTruthy();
      expect(getByTestId('google-link-button')).toBeTruthy();
      expect(getByTestId('facebook-link-button')).toBeTruthy();
      expect(getByTestId('apple-link-button')).toBeTruthy();
      expect(getByText('No password set')).toBeTruthy();
    });
  });

  it('C04: armed for the provider → Email Mismatch alert, no link created', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetSimulatedLinkEmailMismatch.mockResolvedValue('facebook');

    const { getByTestId } = render(<LinkedAccountsScreen navigation={{ goBack: jest.fn() }} />);
    await waitFor(() => expect(getByTestId('facebook-link-button')).toBeTruthy());

    fireEvent.press(getByTestId('facebook-link-button'));

    await waitFor(() => {
      expect(mockInitiateSocialLogin).toHaveBeenCalledWith('facebook');
      expect(alertSpy).toHaveBeenCalledWith(
        'Email Mismatch',
        expect.stringContaining(
          "The email on your facebook account doesn't match your account email"
        )
      );
    });
    // The provider card must not be left stuck on a spinner (linkingProvider cleared).
    await waitFor(() => expect(getByTestId('facebook-link-button')).toBeTruthy());

    alertSpy.mockRestore();
  });

  it('C04: armed with "all" → Email Mismatch alert for any provider', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetSimulatedLinkEmailMismatch.mockResolvedValue('all');

    const { getByTestId } = render(<LinkedAccountsScreen navigation={{ goBack: jest.fn() }} />);
    await waitFor(() => expect(getByTestId('google-link-button')).toBeTruthy());

    fireEvent.press(getByTestId('google-link-button'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Email Mismatch',
        expect.stringContaining("The email on your google account doesn't match your account email")
      );
    });

    alertSpy.mockRestore();
  });

  it('C04: unarmed (null) → simulated link-success "OAuth Flow" alert (fail-closed)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetSimulatedLinkEmailMismatch.mockResolvedValue(null);

    const { getByTestId } = render(<LinkedAccountsScreen navigation={{ goBack: jest.fn() }} />);
    await waitFor(() => expect(getByTestId('apple-link-button')).toBeTruthy());

    fireEvent.press(getByTestId('apple-link-button'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'OAuth Flow',
        expect.stringContaining('apple'),
        expect.any(Array) // OK button
      );
    });

    alertSpy.mockRestore();
  });
});
