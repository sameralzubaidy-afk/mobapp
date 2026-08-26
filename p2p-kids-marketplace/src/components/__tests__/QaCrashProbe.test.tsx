// File: src/components/__tests__/QaCrashProbe.test.tsx
// Unit tests for the QA render-crash trigger (ACC-TC-L01-L04).
//
// QaCrashProbe reads the SESSION-LOCAL `qa_local_crash_trigger` toggle
// (devTestingService, AsyncStorage) and throws a controlled Error during
// render, which the root ErrorBoundary catches:
//   - 'once'    → throws once then disarms so "Try Again" recovers (L01 + L02)
//   - 'persist' → throws on every render while armed (fallback persists, L03)
//   - 'none' / unset → renders null (fail-closed)
//
// Mirrors ErrorBoundary.test.tsx conventions (mock the reporter, silence
// React's console.error for boundary-caught errors).

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from '../ErrorBoundary';
import QaCrashProbe from '../QaCrashProbe';
import { QA_CRASH_TRIGGER_KEY, setQaLocalValue } from '@/services/devTestingService';

jest.mock('../../services/errorReporter', () => ({
  captureException: jest.fn(),
}));

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  // React logs errors caught by boundaries — silence to keep test output clean.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('QaCrashProbe', () => {
  it('renders nothing when the toggle is unset (fail-closed)', () => {
    const { queryByTestId } = render(
      <ErrorBoundary>
        <QaCrashProbe screenName="Profile" />
      </ErrorBoundary>
    );
    expect(queryByTestId('error-boundary-fallback')).toBeNull();
  });

  it('once: render error → fallback → Try Again recovers (L01/L02)', async () => {
    await setQaLocalValue(QA_CRASH_TRIGGER_KEY, 'once');

    const { getByTestId, queryByTestId } = render(
      <ErrorBoundary>
        <QaCrashProbe screenName="Profile" />
      </ErrorBoundary>
    );

    await waitFor(() => expect(getByTestId('error-boundary-fallback')).toBeTruthy());

    // 'once' disarms itself, so Try Again remounts the probe and it renders null.
    fireEvent.press(getByTestId('error-boundary-retry'));

    await waitFor(() => expect(queryByTestId('error-boundary-fallback')).toBeNull());
  });

  it('persist: render error → fallback stays after Try Again (L03 containment)', async () => {
    await setQaLocalValue(QA_CRASH_TRIGGER_KEY, 'persist');

    const { getByTestId } = render(
      <ErrorBoundary>
        <QaCrashProbe screenName="Profile" />
      </ErrorBoundary>
    );

    await waitFor(() => expect(getByTestId('error-boundary-fallback')).toBeTruthy());

    // 'persist' stays armed → Try Again re-crashes → fallback persists (contained,
    // not a hard crash).
    fireEvent.press(getByTestId('error-boundary-retry'));

    await waitFor(() => expect(getByTestId('error-boundary-fallback')).toBeTruthy());
  });
});
