// File: src/components/__tests__/QaSubscriptionStatusDeepLinkHandler.test.tsx
// FIX-Task-52 item 7d (2026-09-17) — unit tests for the qa-subscription-status
// deep-link handler.
//
// `p2pkidsmarketplace://qa-subscription-status` opens the Subscription Status
// diagnostics screen, which has NO in-app navigation entry (it was reachable only
// via a push payload, which is why SUB-TC-E04 sat fixture-gated). This test
// asserts the handler:
//   - reacts to the foreground URL event,
//   - reacts to the cold-start initial URL,
//   - navigates to SubscriptionStatus in both cases,
//   - ignores unrelated URLs,
//   - does nothing when the navigator is not ready (no throw).

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import QaSubscriptionStatusDeepLinkHandler from '../QaSubscriptionStatusDeepLinkHandler';
import { navigationRef } from '@/navigation/navigationRef';

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;
const mockIsReady = navigationRef.isReady as jest.Mock;
const mockNavigate = navigationRef.navigate as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

describe('QaSubscriptionStatusDeepLinkHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    urlListener = null;

    mockAddEventListener.mockImplementation(
      (_type: string, handler: (e: { url: string }) => void) => {
        urlListener = handler;
        return { remove: jest.fn() };
      }
    );
    mockGetInitialURL.mockResolvedValue(null);
    mockIsReady.mockReturnValue(true);
  });

  const parseAs = (path: string) => {
    mockParse.mockReturnValue({ path, queryParams: {} });
  };

  const triggerUrl = (url: string) => {
    if (!urlListener) throw new Error('url listener not registered');
    urlListener({ url });
  };

  it('navigates to SubscriptionStatus on the foreground deep link', async () => {
    parseAs('qa-subscription-status');
    render(<QaSubscriptionStatusDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-subscription-status');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('SubscriptionStatus');
    });
  });

  it('navigates to SubscriptionStatus on the cold-start initial URL', async () => {
    parseAs('qa-subscription-status');
    mockGetInitialURL.mockResolvedValue('p2pkidsmarketplace://qa-subscription-status');

    render(<QaSubscriptionStatusDeepLinkHandler />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('SubscriptionStatus');
    });
  });

  it('ignores unrelated deep links', async () => {
    parseAs('some-other-screen');
    render(<QaSubscriptionStatusDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://some-other-screen');

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('does not throw when the navigator is not ready', async () => {
    parseAs('qa-subscription-status');
    mockIsReady.mockReturnValue(false);

    render(<QaSubscriptionStatusDeepLinkHandler />);

    expect(() => triggerUrl('p2pkidsmarketplace://qa-subscription-status')).not.toThrow();
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
