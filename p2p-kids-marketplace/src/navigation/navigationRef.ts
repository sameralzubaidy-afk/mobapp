// File: p2p-kids-marketplace/src/navigation/navigationRef.ts
// Shared navigation container ref, extracted from AppNavigator so that
// non-navigator components (e.g. QaLogoutDeepLinkHandler) can navigate without
// creating a circular import with AppNavigator (AppNavigator imports the
// handler, and the handler would otherwise need to import AppNavigator).
//
// AppNavigator attaches this ref to <NavigationContainer ref={navigationRef}>;
// consumers must guard with navigationRef.isReady() before navigating.
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();
