// File: src/components/__tests__/QaClearOverlaysDeepLinkHandler.test.tsx
// Dev Task 77 item 1 — unit tests for the dev-clear-overlays deep-link handler.
//
// `p2pkidsmarketplace://dev-clear-overlays` force-dismisses any stuck GlobalAlert
// and resets navigation to Home in ONE call (QA Task 15 friction fix — the stuck
// "Offer Declined" alert previously cost ~20 tool calls / a full app relaunch).
// This test asserts the handler:
//   - reacts to the foreground URL event,
//   - reacts to the cold-start initial URL,
//   - calls forceDismissAllGlobalAlerts + resets to Home in both cases,
//   - ignores unrelated URLs.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import QaClearOverlaysDeepLinkHandler from '../QaClearOverlaysDeepLinkHandler';
import { forceDismissAllGlobalAlerts } from '@/providers/GlobalAlertProvider';
import { navigationRef } from '@/navigation/navigationRef';

jest.mock('@/providers/GlobalAlertProvider', () => ({
  forceDismissAllGlobalAlerts: jest.fn(() => true),
}));

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), reset: jest.fn() },
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;
const mockForceDismiss = forceDismissAllGlobalAlerts as jest.Mock;
const mockIsReady = navigationRef.isReady as jest.Mock;
const mockReset = navigationRef.reset as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

describe('QaClearOverlaysDeepLinkHandler', () => {
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

  it('force-dismisses GlobalAlerts and resets to Home on the foreground deep link', async () => {
    parseAs('dev-clear-overlays');
    render(<QaClearOverlaysDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://dev-clear-overlays');

    await waitFor(() => {
      expect(mockForceDismiss).toHaveBeenCalledTimes(1);
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    });
  });

  it('reacts to the cold-start initial URL (app launched via the deep link)', async () => {
    parseAs('dev-clear-overlays');
    mockGetInitialURL.mockResolvedValue('p2pkidsmarketplace://dev-clear-overlays');
    render(<QaClearOverlaysDeepLinkHandler />);

    await waitFor(() => {
      expect(mockForceDismiss).toHaveBeenCalledTimes(1);
      expect(mockReset).toHaveBeenCalled();
    });
  });

  it('ignores unrelated deep links', async () => {
    parseAs('listing');
    render(<QaClearOverlaysDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://listing/abc-123');

    // Give any accidental processing a beat to run, then assert nothing happened.
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    expect(mockForceDismiss).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('does not reset navigation when the navigator is not ready (best-effort)', async () => {
    parseAs('dev-clear-overlays');
    mockIsReady.mockReturnValue(false);
    render(<QaClearOverlaysDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://dev-clear-overlays');

    await waitFor(() => {
      expect(mockForceDismiss).toHaveBeenCalledTimes(1);
    });
    expect(mockReset).not.toHaveBeenCalled();
  });
});
