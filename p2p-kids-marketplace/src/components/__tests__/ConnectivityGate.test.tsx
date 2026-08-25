// File: p2p-kids-marketplace/src/components/__tests__/ConnectivityGate.test.tsx
// F03 (ACC-TC-F03): ConnectivityGate navigates to the Offline screen when the
// network drops during authenticated use, and does not navigate on app start,
// on reconnect, for unauthenticated users, or when already on Offline.

import React from 'react';
import { render, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import ConnectivityGate from '../ConnectivityGate';
import { navigationRef } from '@/navigation/navigationRef';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: jest.fn(() => true),
    getCurrentRoute: jest.fn(() => ({ name: 'Home' })),
    navigate: jest.fn(),
  },
}));

const addEventListenerMock = NetInfo.addEventListener as jest.Mock;

let capturedListener:
  | ((state: { isConnected: boolean; isInternetReachable: boolean | null }) => void)
  | undefined;

function emitConnection(state: { isConnected: boolean; isInternetReachable: boolean | null }) {
  act(() => {
    capturedListener?.(state);
  });
}

describe('ConnectivityGate (F03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedListener = undefined;
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'Home' });
    addEventListenerMock.mockImplementation(
      (
        listener: (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void
      ) => {
        capturedListener = listener;
        return jest.fn();
      }
    );
    (useAuth as jest.Mock).mockReturnValue({ session: { user: { id: 'user-001' } } });
  });

  it('does NOT navigate on the first (baseline) event even if connected', () => {
    render(<ConnectivityGate />);
    emitConnection({ isConnected: true, isInternetReachable: true });
    emitConnection({ isConnected: true, isInternetReachable: true });
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('navigates to Offline when connectivity drops during authenticated use', () => {
    render(<ConnectivityGate />);
    // Baseline: connected.
    emitConnection({ isConnected: true, isInternetReachable: true });
    // Drop.
    emitConnection({ isConnected: false, isInternetReachable: false });
    expect(navigationRef.navigate).toHaveBeenCalledWith('Offline');
  });

  it('does NOT navigate when connectivity is restored (reconnect)', () => {
    render(<ConnectivityGate />);
    emitConnection({ isConnected: true, isInternetReachable: true }); // baseline
    emitConnection({ isConnected: false, isInternetReachable: false }); // drop → offline
    emitConnection({ isConnected: true, isInternetReachable: true }); // restored
    // Only the drop should have triggered a single navigation.
    expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
    expect(navigationRef.navigate).toHaveBeenCalledWith('Offline');
  });

  it('does NOT navigate for an unauthenticated user', () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });
    render(<ConnectivityGate />);
    emitConnection({ isConnected: true, isInternetReachable: true }); // baseline
    emitConnection({ isConnected: false, isInternetReachable: false }); // drop
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does NOT navigate twice when already on the Offline screen', () => {
    render(<ConnectivityGate />);
    emitConnection({ isConnected: true, isInternetReachable: true }); // baseline
    // Drop while already on Offline.
    (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'Offline' });
    emitConnection({ isConnected: false, isInternetReachable: false });
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does NOT navigate while the navigation ref is not ready', () => {
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);
    render(<ConnectivityGate />);
    emitConnection({ isConnected: true, isInternetReachable: true }); // baseline
    emitConnection({ isConnected: false, isInternetReachable: false }); // drop
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });
});
