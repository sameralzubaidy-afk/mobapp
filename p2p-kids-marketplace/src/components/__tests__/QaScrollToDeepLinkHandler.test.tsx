// File: src/components/__tests__/QaScrollToDeepLinkHandler.test.tsx
// DEV-TASK-84 item 3 — unit tests for the qa-scroll-to deep-link handler.
//
// `p2pkidsmarketplace://qa-scroll-to?testID=<id>` scrolls the target element
// into view on the currently-open screen and logs fresh viewport coords in ONE
// call (QA Task 17 F-2/F-Z04 — bottom-anchored/unreliably-placed buttons
// previously cost a swipe-then-relist-then-OCR cycle). This test asserts the
// handler:
//   - parses the testID param and invokes the registered scroll handler,
//   - reacts to the cold-start initial URL,
//   - ignores unrelated URLs and missing testID params.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import QaScrollToDeepLinkHandler from '../QaScrollToDeepLinkHandler';
import { requestQaScrollTo } from '@/services/qaScrollRegistry';

jest.mock('@/services/qaScrollRegistry', () => ({
  requestQaScrollTo: jest.fn().mockResolvedValue({ handled: true, coords: { x: 220, y: 500 } }),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;
const mockRequestScrollTo = requestQaScrollTo as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

describe('QaScrollToDeepLinkHandler', () => {
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

  const parseAs = (path: string, queryParams: Record<string, string> = {}) => {
    mockParse.mockReturnValue({ path, queryParams });
  };

  const triggerUrl = (url: string) => {
    if (!urlListener) throw new Error('url listener not registered');
    urlListener({ url });
  };

  it('parses the testID param and scrolls the target on the foreground deep link', async () => {
    parseAs('qa-scroll-to', { testID: 'approve-cancel-request-button' });
    render(<QaScrollToDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-scroll-to?testID=approve-cancel-request-button');

    await waitFor(() => {
      expect(mockRequestScrollTo).toHaveBeenCalledTimes(1);
      expect(mockRequestScrollTo).toHaveBeenCalledWith('approve-cancel-request-button');
    });
  });

  it('reacts to the cold-start initial URL (app launched via the deep link)', async () => {
    parseAs('qa-scroll-to', { testID: 'withdraw-cancel-request-button' });
    mockGetInitialURL.mockResolvedValue(
      'p2pkidsmarketplace://qa-scroll-to?testID=withdraw-cancel-request-button'
    );
    render(<QaScrollToDeepLinkHandler />);

    await waitFor(() => {
      expect(mockRequestScrollTo).toHaveBeenCalledTimes(1);
      expect(mockRequestScrollTo).toHaveBeenCalledWith('withdraw-cancel-request-button');
    });
  });

  it('does not invoke the handler when the testID param is missing', async () => {
    parseAs('qa-scroll-to', {});
    render(<QaScrollToDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-scroll-to');

    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    expect(mockRequestScrollTo).not.toHaveBeenCalled();
  });

  it('ignores unrelated deep links', async () => {
    parseAs('listing');
    render(<QaScrollToDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://listing/abc-123');

    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    expect(mockRequestScrollTo).not.toHaveBeenCalled();
  });
});
