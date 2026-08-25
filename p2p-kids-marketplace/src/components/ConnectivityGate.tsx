// File: p2p-kids-marketplace/src/components/ConnectivityGate.tsx
// F03 (ACC-TC-F03): Real connectivity boundary for the Offline screen.
//
// The Offline screen is registered in the authenticated navigator but previously
// had no trigger. This gate listens for a LOST network connection during active
// (authenticated) use and navigates to the 'Offline' route. Exit is via the
// screen's "Try Again" button, which re-checks connectivity and returns to the
// prior screen on success (see OfflineScreen.tsx).
//
// Edge-triggered, not level-triggered: the FIRST event only records the baseline
// connection state so the gate never pushes Offline over the auth/Landing stack
// on app start (even if the device starts offline). Only a live transition
// connected -> disconnected while a user is signed in triggers navigation.
import { useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '@/hooks/useAuth';
import { navigationRef } from '@/navigation/navigationRef';

export default function ConnectivityGate() {
  const { session } = useAuth();
  // null = no baseline recorded yet (first listener event).
  const wasConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // Treat a missing/unknown reachability probe (null) as reachable so we only
      // flip to offline on a definitive drop.
      const isConnected = state.isConnected === true && state.isInternetReachable !== false;
      const wasConnected = wasConnectedRef.current;

      if (wasConnected === null) {
        wasConnectedRef.current = isConnected;
        return;
      }

      const justLostConnection = wasConnected && !isConnected;
      wasConnectedRef.current = isConnected;

      if (!justLostConnection) return;
      // Only surface the offline gate for an authenticated, in-app user — the
      // 'Offline' route is registered in the authenticated stack only.
      if (!session?.user) return;
      if (!navigationRef.isReady()) return;
      if (navigationRef.getCurrentRoute()?.name === 'Offline') return;

      navigationRef.navigate('Offline' as never);
    });

    return unsubscribe;
  }, [session?.user]);

  // Renders nothing — this is a behavioral gate only.
  return null;
}
