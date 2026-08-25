// File: src/components/__tests__/QaDevToggleDeepLinkHandler.test.tsx
// Unit tests for the QA dev-toggle deep-link handler.
//
// `p2pkidsmarketplace://qa-dev-toggle?key=<short>&value=<value>` arms a
// SESSION-LOCAL QA toggle (A03/D02/C04) via devTestingService.setQaLocalValue.
// This test exercises the REAL devTestingService storage path (the Supabase
// client no-ops without env vars) with only `expo-linking` mocked, so it covers
// URL parse → key mapping → value validation → AsyncStorage write → getter read.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import QaDevToggleDeepLinkHandler from '../QaDevToggleDeepLinkHandler';
import {
  getPushSimulationMode,
  getSimulatedNotificationPrefSaveError,
  getSimulatedLinkEmailMismatch,
  QA_PUSH_SIMULATION_KEY,
  QA_FORCE_PREF_SAVE_FAILURE_KEY,
  QA_LINK_EMAIL_MISMATCH_KEY,
} from '@/services/devTestingService';

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

describe('QaDevToggleDeepLinkHandler', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    urlListener = null;

    mockAddEventListener.mockImplementation(
      (_type: string, handler: (e: { url: string }) => void) => {
        urlListener = handler;
        return { remove: jest.fn() };
      }
    );
    mockGetInitialURL.mockResolvedValue(null);
  });

  const parseAs = (key: string, value: string) => {
    mockParse.mockReturnValue({
      path: 'qa-dev-toggle',
      queryParams: { key, value },
    });
  };

  const triggerUrl = (url: string) => {
    if (!urlListener) throw new Error('url listener not registered');
    urlListener({ url });
  };

  it('arms push_simulation via the foreground deep link (read-back through getter)', async () => {
    parseAs('push_simulation', 'token');
    render(<QaDevToggleDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=token');

    await waitFor(async () => {
      expect(await getPushSimulationMode()).toBe('token');
    });
  });

  it('arms pref_save_failure via the cold-start deep link', async () => {
    parseAs('pref_save_failure', 'save_failure');
    mockGetInitialURL.mockResolvedValue(
      'p2pkidsmarketplace://qa-dev-toggle?key=pref_save_failure&value=save_failure'
    );
    render(<QaDevToggleDeepLinkHandler />);

    await waitFor(async () => {
      const err = await getSimulatedNotificationPrefSaveError();
      expect(err).toBeInstanceOf(Error);
    });
  });

  it('arms link_email_mismatch=facebook (read-back through getter)', async () => {
    parseAs('link_email_mismatch', 'facebook');
    render(<QaDevToggleDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-dev-toggle?key=link_email_mismatch&value=facebook');

    await waitFor(async () => {
      expect(await getSimulatedLinkEmailMismatch()).toBe('facebook');
    });
  });

  it('rejects an invalid value — nothing written (fail-closed)', async () => {
    parseAs('push_simulation', 'nope');
    render(<QaDevToggleDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=nope');

    // Give the (rejected) handler a moment; nothing should be stored.
    await new Promise((r) => setTimeout(r, 20));
    await expect(AsyncStorage.getItem(QA_PUSH_SIMULATION_KEY)).resolves.toBeNull();
    await expect(getPushSimulationMode()).resolves.toBe('none');
  });

  it('rejects an unknown key — nothing written (fail-closed)', async () => {
    parseAs('bogus_key', 'token');
    render(<QaDevToggleDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-dev-toggle?key=bogus_key&value=token');

    await new Promise((r) => setTimeout(r, 20));
    await expect(AsyncStorage.getItem(QA_PUSH_SIMULATION_KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(QA_FORCE_PREF_SAVE_FAILURE_KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(QA_LINK_EMAIL_MISMATCH_KEY)).resolves.toBeNull();
  });

  it('ignores unrelated deep links', async () => {
    mockParse.mockReturnValue({ path: 'qa-logout', queryParams: {} });
    render(<QaDevToggleDeepLinkHandler />);

    triggerUrl('p2pkidsmarketplace://qa-logout');

    await new Promise((r) => setTimeout(r, 20));
    await expect(AsyncStorage.getItem(QA_PUSH_SIMULATION_KEY)).resolves.toBeNull();
  });
});
