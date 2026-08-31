// File: src/components/__tests__/QaSetSpDeepLinkHandler.test.tsx
// Dev Task 77 item 3 — unit tests for the qa-set-sp deep-link handler.
//
// `p2pkidsmarketplace://qa-set-sp?listing=<id>&amount=<N>` sets the SP value on a
// cart-checkout item in ONE call (QA Task 15 friction fix — the per-item SP input
// isn't in the iOS AX tree, and each manual value entry cost ~4–5 tool calls).
// This test uses the REAL qaSpFixture registry: it registers a setter (as the
// checkout screen would), fires the deep link, and asserts the setter was invoked
// with the parsed listing/amount — plus the validation no-op cases.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import QaSetSpDeepLinkHandler from '../QaSetSpDeepLinkHandler';
import { registerQaSpSetter } from '@/services/qaSpFixture';

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

describe('QaSetSpDeepLinkHandler', () => {
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

  afterEach(() => {
    // Unregister any setter registered during the test to avoid cross-test leakage.
    registerQaSpSetter(null);
  });

  const parseAs = (listing: string, amount: string) => {
    mockParse.mockReturnValue({ path: 'qa-set-sp', queryParams: { listing, amount } });
  };

  const triggerUrl = (url: string) => {
    if (!urlListener) throw new Error('url listener not registered');
    urlListener({ url });
  };

  it('applies the SP amount to the matching listing via the registered setter', async () => {
    const setter = jest.fn(() => true);
    registerQaSpSetter(setter);
    parseAs('aaaaaaaa-0000-0000-0000-000000000001', '25');

    render(<QaSetSpDeepLinkHandler />);
    triggerUrl(
      'p2pkidsmarketplace://qa-set-sp?listing=aaaaaaaa-0000-0000-0000-000000000001&amount=25'
    );

    await waitFor(() => {
      expect(setter).toHaveBeenCalledWith('aaaaaaaa-0000-0000-0000-000000000001', 25);
    });
  });

  it('reacts to the cold-start initial URL', async () => {
    const setter = jest.fn(() => true);
    registerQaSpSetter(setter);
    parseAs('bbbbbbbb-0000-0000-0000-000000000002', '10');
    mockGetInitialURL.mockResolvedValue(
      'p2pkidsmarketplace://qa-set-sp?listing=bbbbbbbb-0000-0000-0000-000000000002&amount=10'
    );

    render(<QaSetSpDeepLinkHandler />);

    await waitFor(() => {
      expect(setter).toHaveBeenCalledWith('bbbbbbbb-0000-0000-0000-000000000002', 10);
    });
  });

  it('no-ops when no checkout setter is registered (listing not on screen)', async () => {
    const setter = jest.fn(() => false);
    registerQaSpSetter(setter);
    parseAs('cccccccc-0000-0000-0000-000000000003', '5');

    render(<QaSetSpDeepLinkHandler />);
    triggerUrl(
      'p2pkidsmarketplace://qa-set-sp?listing=cccccccc-0000-0000-0000-000000000003&amount=5'
    );

    await waitFor(() => {
      expect(setter).toHaveBeenCalled();
    });
  });

  it('rejects an invalid (non-UUID) listing id without calling the setter', async () => {
    const setter = jest.fn(() => true);
    registerQaSpSetter(setter);
    parseAs('not-a-uuid', '25');

    render(<QaSetSpDeepLinkHandler />);
    triggerUrl('p2pkidsmarketplace://qa-set-sp?listing=not-a-uuid&amount=25');

    await waitFor(() => expect(urlListener).toBeTruthy());
    expect(setter).not.toHaveBeenCalled();
  });
});
