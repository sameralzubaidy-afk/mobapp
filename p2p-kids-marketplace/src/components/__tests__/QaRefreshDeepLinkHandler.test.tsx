// File: src/components/__tests__/QaRefreshDeepLinkHandler.test.tsx
// DEV-TASK-84 item 2 — unit tests for the qa-refresh deep-link handler.
//
// `p2pkidsmarketplace://qa-refresh` force-refetches the currently-open screen in
// ONE call (QA Task 17 F-3 — the stale Needs Action list after server-side
// fixture writes previously cost a nav-away-and-back remount, ~6-10 calls).
// This test asserts the handler:
//   - reacts to the foreground URL event,
//   - reacts to the cold-start initial URL,
//   - invokes the registered screen refresh via requestQaScreenRefresh,
//   - ignores unrelated URLs.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import QaRefreshDeepLinkHandler from '../QaRefreshDeepLinkHandler';
import { requestQaScreenRefresh } from '@/services/qaRefreshRegistry';

jest.mock('@/services/qaRefreshRegistry', () => ({
  requestQaScreenRefresh: jest.fn(() => true),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;
const mockRequestRefresh = requestQaScreenRefresh as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

describe('QaRefreshDeepLinkHandler', () => {
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
  });

  const parseAs = (path: string) => {
    mockParse.mockReturnValue({ path, queryParams: {} });
  };

  const triggerUrl = (url: string) => {
    if (!urlListener) throw new Error('url listener not registered');
    urlListener({ url });
  };

  it('triggers the registered screen refresh on the foreground deep link', async () => {
    parseAs('qa-refresh');
    render(<QaRefreshDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-refresh');

    await waitFor(() => {
      expect(mockRequestRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('reacts to the cold-start initial URL (app launched via the deep link)', async () => {
    parseAs('qa-refresh');
    mockGetInitialURL.mockResolvedValue('p2pkidsmarketplace://qa-refresh');
    render(<QaRefreshDeepLinkHandler />);

    await waitFor(() => {
      expect(mockRequestRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores unrelated deep links', async () => {
    parseAs('listing');
    render(<QaRefreshDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://listing/abc-123');

    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    expect(mockRequestRefresh).not.toHaveBeenCalled();
  });
});
