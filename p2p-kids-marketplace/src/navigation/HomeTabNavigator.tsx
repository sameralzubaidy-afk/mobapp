/**
 * File: p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx
 *
 * REDUCED to a single-screen container for UserDashboardScreen.
 * The native tab bar is gone — the PersistentTabBar (rendered at root
 * stack level in AppNavigator.tsx) handles all bottom-navigation.
 *
 * Tabs (Home, Discover, Inbox, Cart) are navigated via the root Stack
 * screens, not via this tab navigator.
 */

import React from 'react';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';

/**
 * Single-screen wrapper. The old tab navigator was removed: the
 * PersistentTabBar at the root stack level replaces it everywhere.
 */
export function HomeTabNavigator() {
  return <UserDashboardScreen />;
}

export default HomeTabNavigator;
